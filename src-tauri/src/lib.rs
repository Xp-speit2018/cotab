use serde::{Deserialize, Serialize};
use std::{
    env, fs,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::Mutex,
    thread,
    time::Duration,
};
use tauri::{ipc::Channel, AppHandle, Manager};

const AGENT_HISTORY_VERSION: u32 = 1;
const AGENT_HISTORY_FILE: &str = "agent-history-v1.json";

struct CodexProcess {
    child: Child,
    stdin: Option<ChildStdin>,
    executable: PathBuf,
    version: String,
}

impl Drop for CodexProcess {
    fn drop(&mut self) {
        // Closing stdin lets app-server shut down cleanly before we terminate its
        // process group. npm-installed launchers otherwise leave the native
        // Codex child process orphaned when only the launcher is killed.
        self.stdin.take();
        for _ in 0..10 {
            if matches!(self.child.try_wait(), Ok(Some(_))) {
                return;
            }
            thread::sleep(Duration::from_millis(10));
        }
        terminate_process_tree(&mut self.child);
    }
}

#[derive(Default)]
struct CodexState {
    process: Mutex<Option<CodexProcess>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodexStatus {
    installed: bool,
    connected: bool,
    executable: Option<String>,
    version: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum CodexEvent {
    Message { message: String },
    Error { message: String },
    Closed,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentThreadBinding {
    thread_id: String,
    document_id: String,
    score_label: String,
    created_at: u64,
    last_opened_at: u64,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentHistoryIndex {
    version: u32,
    bindings: Vec<AgentThreadBinding>,
}

impl Default for AgentHistoryIndex {
    fn default() -> Self {
        Self {
            version: AGENT_HISTORY_VERSION,
            bindings: Vec::new(),
        }
    }
}

fn agent_history_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join(AGENT_HISTORY_FILE))
}

#[tauri::command]
fn load_agent_history(app: AppHandle) -> Result<AgentHistoryIndex, String> {
    let path = agent_history_path(&app)?;
    if !path.exists() {
        return Ok(AgentHistoryIndex::default());
    }
    let data = fs::read(&path).map_err(|error| error.to_string())?;
    let index: AgentHistoryIndex =
        serde_json::from_slice(&data).map_err(|error| error.to_string())?;
    if index.version != AGENT_HISTORY_VERSION {
        return Err(format!(
            "Unsupported Agent history version: {}.",
            index.version
        ));
    }
    Ok(index)
}

#[tauri::command]
fn save_agent_history(app: AppHandle, index: AgentHistoryIndex) -> Result<(), String> {
    if index.version != AGENT_HISTORY_VERSION {
        return Err(format!(
            "Unsupported Agent history version: {}.",
            index.version
        ));
    }
    let path = agent_history_path(&app)?;
    let temporary_path = path.with_extension("json.tmp");
    let data = serde_json::to_vec_pretty(&index).map_err(|error| error.to_string())?;
    fs::write(&temporary_path, data).map_err(|error| error.to_string())?;
    #[cfg(windows)]
    if path.exists() {
        fs::remove_file(&path).map_err(|error| error.to_string())?;
    }
    fs::rename(temporary_path, path).map_err(|error| error.to_string())
}

fn command_version(executable: &PathBuf) -> Option<String> {
    let output = Command::new(executable).arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let version = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    (!version.is_empty()).then_some(version)
}

fn codex_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(path) = env::var_os("COTAB_CODEX_PATH") {
        candidates.push(PathBuf::from(path));
    }
    candidates.push(PathBuf::from("codex"));

    if let Some(home) = env::var_os("HOME") {
        let home = PathBuf::from(home);
        candidates.push(home.join(".local/bin/codex"));
        candidates.push(home.join(".npm-global/bin/codex"));
    }
    candidates.push(PathBuf::from("/opt/homebrew/bin/codex"));
    candidates.push(PathBuf::from("/usr/local/bin/codex"));
    candidates
}

#[cfg(unix)]
fn codex_from_login_shell() -> Option<PathBuf> {
    let shell = env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_owned());
    let output = Command::new(shell)
        .args(["-lc", "command -v codex"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    (!path.is_empty()).then(|| PathBuf::from(path))
}

#[cfg(not(unix))]
fn codex_from_login_shell() -> Option<PathBuf> {
    None
}

fn detect_codex() -> Option<(PathBuf, String)> {
    for executable in codex_candidates()
        .into_iter()
        .chain(codex_from_login_shell())
    {
        if let Some(version) = command_version(&executable) {
            return Some((executable, version));
        }
    }
    None
}

fn status_from_process(process: &CodexProcess) -> CodexStatus {
    CodexStatus {
        installed: true,
        connected: true,
        executable: Some(process.executable.to_string_lossy().into_owned()),
        version: Some(process.version.clone()),
    }
}

fn configure_process_group(command: &mut Command) {
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
        command.creation_flags(CREATE_NEW_PROCESS_GROUP);
    }
}

#[cfg(unix)]
fn terminate_process_tree(child: &mut Child) {
    let process_group = -(child.id() as i32);
    // SAFETY: process_group is the negative ID of the isolated group created
    // for this child. No Rust memory is shared with the signal operation.
    unsafe {
        libc::kill(process_group, libc::SIGTERM);
    }
    for _ in 0..10 {
        if matches!(child.try_wait(), Ok(Some(_))) {
            return;
        }
        thread::sleep(Duration::from_millis(20));
    }
    // SAFETY: same isolated process group as above.
    unsafe {
        libc::kill(process_group, libc::SIGKILL);
    }
    let _ = child.wait();
}

#[cfg(windows)]
fn terminate_process_tree(child: &mut Child) {
    let _ = Command::new("taskkill")
        .args(["/PID", &child.id().to_string(), "/T", "/F"])
        .status();
    let _ = child.wait();
}

#[cfg(not(any(unix, windows)))]
fn terminate_process_tree(child: &mut Child) {
    let _ = child.kill();
    let _ = child.wait();
}

fn forward_stdout(stdout: impl std::io::Read + Send + 'static, channel: Channel<CodexEvent>) {
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            match line {
                Ok(message) => {
                    if channel.send(CodexEvent::Message { message }).is_err() {
                        return;
                    }
                }
                Err(error) => {
                    let _ = channel.send(CodexEvent::Error {
                        message: format!("Failed to read Codex app-server output: {error}"),
                    });
                    break;
                }
            }
        }
        let _ = channel.send(CodexEvent::Closed);
    });
}

fn forward_stderr(stderr: impl std::io::Read + Send + 'static) {
    thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            eprintln!("[codex app-server] {line}");
        }
    });
}

#[tauri::command]
fn get_codex_status(state: tauri::State<'_, CodexState>) -> Result<CodexStatus, String> {
    let mut slot = state
        .process
        .lock()
        .map_err(|_| "Codex process state is unavailable.".to_owned())?;
    if let Some(process) = slot.as_mut() {
        if process
            .child
            .try_wait()
            .map_err(|error| error.to_string())?
            .is_none()
        {
            return Ok(status_from_process(process));
        }
        *slot = None;
    }

    Ok(match detect_codex() {
        Some((executable, version)) => CodexStatus {
            installed: true,
            connected: false,
            executable: Some(executable.to_string_lossy().into_owned()),
            version: Some(version),
        },
        None => CodexStatus {
            installed: false,
            connected: false,
            executable: None,
            version: None,
        },
    })
}

#[tauri::command]
fn connect_local_codex(
    state: tauri::State<'_, CodexState>,
    on_event: Channel<CodexEvent>,
    local_resources: bool,
) -> Result<CodexStatus, String> {
    let mut slot = state
        .process
        .lock()
        .map_err(|_| "Codex process state is unavailable.".to_owned())?;

    // A channel belongs to one WebView connection. Always replace an existing
    // process so hot reloads and reconnects cannot inherit a stale channel.
    *slot = None;

    let (executable, version) = detect_codex()
        .ok_or_else(|| "Codex CLI was not found. Install it or set COTAB_CODEX_PATH.".to_owned())?;
    let mut command = Command::new(&executable);
    command
        .args(["app-server", "--stdio"])
        .arg("-c")
        .arg(if local_resources {
            "sandbox_permissions=[\"disk-full-read-access\"]"
        } else {
            "sandbox_permissions=[]"
        })
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    configure_process_group(&mut command);

    let mut child = command
        .spawn()
        .map_err(|error| format!("Failed to start Codex app-server: {error}"))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Codex app-server stdin is unavailable.".to_owned())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Codex app-server stdout is unavailable.".to_owned())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Codex app-server stderr is unavailable.".to_owned())?;

    forward_stdout(stdout, on_event);
    forward_stderr(stderr);

    let process = CodexProcess {
        child,
        stdin: Some(stdin),
        executable,
        version,
    };
    let status = status_from_process(&process);
    *slot = Some(process);
    Ok(status)
}

#[tauri::command]
fn pick_agent_write_root() -> Option<String> {
    rfd::FileDialog::new()
        .pick_folder()
        .map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
fn send_codex_message(
    state: tauri::State<'_, CodexState>,
    message: serde_json::Value,
) -> Result<(), String> {
    let mut slot = state
        .process
        .lock()
        .map_err(|_| "Codex process state is unavailable.".to_owned())?;
    let process = slot
        .as_mut()
        .ok_or_else(|| "Codex app-server is not connected.".to_owned())?;
    if let Some(status) = process
        .child
        .try_wait()
        .map_err(|error| error.to_string())?
    {
        *slot = None;
        return Err(format!("Codex app-server exited with status {status}."));
    }

    let line = serde_json::to_string(&message).map_err(|error| error.to_string())?;
    let stdin = process
        .stdin
        .as_mut()
        .ok_or_else(|| "Codex app-server stdin is closed.".to_owned())?;
    stdin
        .write_all(line.as_bytes())
        .and_then(|_| stdin.write_all(b"\n"))
        .and_then(|_| stdin.flush())
        .map_err(|error| format!("Failed to write to Codex app-server: {error}"))
}

#[tauri::command]
fn disconnect_local_codex(state: tauri::State<'_, CodexState>) -> Result<(), String> {
    let mut slot = state
        .process
        .lock()
        .map_err(|_| "Codex process state is unavailable.".to_owned())?;
    *slot = None;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(CodexState::default())
        .invoke_handler(tauri::generate_handler![
            load_agent_history,
            save_agent_history,
            get_codex_status,
            connect_local_codex,
            pick_agent_write_root,
            send_codex_message,
            disconnect_local_codex
        ])
        .run(tauri::generate_context!())
        .expect("error while running CoTab desktop shell");
}
