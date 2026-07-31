use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    env, fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{ipc::Channel, AppHandle, Manager};
use url::Url;

const AGENT_HISTORY_VERSION: u32 = 1;
const AGENT_HISTORY_FILE: &str = "agent-history-v1.json";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalStoredDocument {
    locator: String,
    display_name: String,
    revision: String,
    data: Vec<u8>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalStorageTarget {
    locator: String,
    display_name: String,
    revision: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PickedLocalScoreFile {
    kind: String,
    document: LocalStoredDocument,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WebDavRequest {
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Vec<u8>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WebDavResponse {
    status: u16,
    status_text: String,
    headers: HashMap<String, String>,
    body: Vec<u8>,
}

#[derive(Default)]
struct WebDavHttpState {
    client: reqwest::Client,
}

#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum LocalWriteResult {
    Saved {
        revision: String,
    },
    Conflict {
        current: Option<LocalStoredDocument>,
    },
}

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

fn content_revision(data: &[u8]) -> String {
    format!("{:x}", Sha256::digest(data))
}

fn display_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

fn read_local_document_path(path: &Path) -> Result<Option<LocalStoredDocument>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let data = fs::read(path).map_err(|error| error.to_string())?;
    Ok(Some(LocalStoredDocument {
        locator: path.to_string_lossy().into_owned(),
        display_name: display_name(path),
        revision: content_revision(&data),
        data,
    }))
}

fn write_local_document_path(
    path: &Path,
    data: Vec<u8>,
    expected_revision: Option<String>,
) -> Result<LocalWriteResult, String> {
    let current = read_local_document_path(path)?;
    let current_revision = current.as_ref().map(|document| document.revision.as_str());
    if current_revision != expected_revision.as_deref() {
        return Ok(LocalWriteResult::Conflict { current });
    }

    let parent = path
        .parent()
        .ok_or_else(|| "Local document path has no parent directory.".to_owned())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let temporary_name = format!(
        ".{}.cotab-tmp-{}-{nonce}",
        display_name(path),
        std::process::id()
    );
    let temporary_path = parent.join(temporary_name);
    let write_result = (|| -> Result<(), String> {
        let mut file = fs::File::create(&temporary_path).map_err(|error| error.to_string())?;
        file.write_all(&data).map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        Ok(())
    })();
    if let Err(error) = write_result {
        let _ = fs::remove_file(&temporary_path);
        return Err(error);
    }
    #[cfg(windows)]
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    if let Err(error) = fs::rename(&temporary_path, path) {
        let _ = fs::remove_file(&temporary_path);
        return Err(error.to_string());
    }
    Ok(LocalWriteResult::Saved {
        revision: content_revision(&data),
    })
}

#[tauri::command]
async fn webdav_request(
    state: tauri::State<'_, WebDavHttpState>,
    request: WebDavRequest,
) -> Result<WebDavResponse, String> {
    let url = Url::parse(&request.url).map_err(|error| error.to_string())?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return Err("WebDAV requests must use HTTP or HTTPS.".to_owned());
    }
    let method = match request.method.as_str() {
        "GET" => reqwest::Method::GET,
        "HEAD" => reqwest::Method::HEAD,
        "PUT" => reqwest::Method::PUT,
        _ => return Err(format!("Unsupported WebDAV method: {}.", request.method)),
    };
    let mut builder = state.client.request(method, url);
    for (name, value) in request.headers {
        builder = builder.header(name, value);
    }
    if !request.body.is_empty() {
        builder = builder.body(request.body);
    }
    let response = builder.send().await.map_err(|error| error.to_string())?;
    let status = response.status();
    let status_text = status.canonical_reason().unwrap_or_default().to_owned();
    let headers = response
        .headers()
        .iter()
        .filter_map(|(name, value)| {
            value
                .to_str()
                .ok()
                .map(|value| (name.as_str().to_owned(), value.to_owned()))
        })
        .collect();
    let body = response
        .bytes()
        .await
        .map_err(|error| error.to_string())?
        .to_vec();
    Ok(WebDavResponse {
        status: status.as_u16(),
        status_text,
        headers,
        body,
    })
}

#[tauri::command]
fn pick_local_score_file() -> Result<Option<PickedLocalScoreFile>, String> {
    let Some(path) = rfd::FileDialog::new()
        .add_filter(
            "CoTab and Guitar Pro",
            &["cotab", "gp", "gp3", "gp4", "gp5", "gpx"],
        )
        .pick_file()
    else {
        return Ok(None);
    };
    let document = read_local_document_path(&path)?
        .ok_or_else(|| "Selected document no longer exists.".to_owned())?;
    let extension = path
        .extension()
        .map(|value| value.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();
    Ok(Some(PickedLocalScoreFile {
        kind: if extension == "cotab" {
            "cotab".to_owned()
        } else {
            "guitarPro".to_owned()
        },
        document,
    }))
}

#[tauri::command]
fn pick_local_document_path(suggested_name: String) -> Result<Option<LocalStorageTarget>, String> {
    let Some(mut path) = rfd::FileDialog::new()
        .add_filter("CoTab document", &["cotab"])
        .set_file_name(suggested_name)
        .save_file()
    else {
        return Ok(None);
    };
    if path
        .extension()
        .map(|value| !value.to_string_lossy().eq_ignore_ascii_case("cotab"))
        .unwrap_or(true)
    {
        path.set_extension("cotab");
    }
    let current = read_local_document_path(&path)?;
    Ok(Some(LocalStorageTarget {
        locator: path.to_string_lossy().into_owned(),
        display_name: display_name(&path),
        revision: current.map(|document| document.revision),
    }))
}

#[tauri::command]
fn read_local_document(locator: String) -> Result<Option<LocalStoredDocument>, String> {
    read_local_document_path(Path::new(&locator))
}

#[tauri::command]
fn write_local_document(
    locator: String,
    data: Vec<u8>,
    expected_revision: Option<String>,
) -> Result<LocalWriteResult, String> {
    write_local_document_path(Path::new(&locator), data, expected_revision)
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

fn normalize_proxy_url(proxy_url: Option<String>) -> Result<Option<String>, String> {
    let Some(proxy_url) = proxy_url else {
        return Ok(None);
    };
    let proxy_url = proxy_url.trim();
    if proxy_url.is_empty() {
        return Ok(None);
    }
    let parsed = Url::parse(proxy_url)
        .map_err(|_| "Codex proxy must be a valid HTTP or HTTPS URL.".to_owned())?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none() {
        return Err("Codex proxy must be a valid HTTP or HTTPS URL.".to_owned());
    }
    Ok(Some(proxy_url.to_owned()))
}

fn configure_proxy_environment(command: &mut Command, proxy_url: Option<&str>) {
    for key in [
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
    ] {
        if let Some(proxy_url) = proxy_url {
            command.env(key, proxy_url);
        } else {
            command.env_remove(key);
        }
    }
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
    web_resources: bool,
    proxy_url: Option<String>,
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
    let proxy_url = normalize_proxy_url(proxy_url)?;
    let mut command = Command::new(&executable);
    command
        .args(["app-server", "--stdio"])
        // CoTab supplies its score tools through app-server dynamic tools. Do
        // not inherit account Apps or the remote plugin catalog without a
        // corresponding CoTab permission surface.
        .args(["-c", "features.apps=false"])
        .args(["-c", "features.remote_plugin=false"])
        .args([
            "-c",
            if web_resources {
                "web_search=\"live\""
            } else {
                "web_search=\"disabled\""
            },
        ])
        .arg("-c")
        .arg(if local_resources {
            "sandbox_permissions=[\"disk-full-read-access\"]"
        } else {
            "sandbox_permissions=[]"
        })
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    // Proxy is an explicit CoTab setting. Disabled means a direct app-server
    // connection, even when the desktop process inherited proxy variables.
    configure_proxy_environment(&mut command, proxy_url.as_deref());
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
        .manage(WebDavHttpState::default())
        .invoke_handler(tauri::generate_handler![
            load_agent_history,
            save_agent_history,
            pick_local_score_file,
            pick_local_document_path,
            read_local_document,
            write_local_document,
            webdav_request,
            get_codex_status,
            connect_local_codex,
            pick_agent_write_root,
            send_codex_message,
            disconnect_local_codex
        ])
        .run(tauri::generate_context!())
        .expect("error while running CoTab desktop shell");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_codex_proxy_urls() {
        assert_eq!(normalize_proxy_url(None).unwrap(), None);
        assert_eq!(normalize_proxy_url(Some("  ".to_owned())).unwrap(), None);
        assert_eq!(
            normalize_proxy_url(Some(" http://localhost:9098 ".to_owned())).unwrap(),
            Some("http://localhost:9098".to_owned())
        );
        assert_eq!(
            normalize_proxy_url(Some("https://proxy.example:8443".to_owned())).unwrap(),
            Some("https://proxy.example:8443".to_owned())
        );
        assert!(normalize_proxy_url(Some("socks5://localhost:9099".to_owned())).is_err());
        assert!(normalize_proxy_url(Some("not-a-url".to_owned())).is_err());
    }

    #[test]
    fn configures_both_proxy_environment_casings() {
        let mut command = Command::new("codex");
        configure_proxy_environment(&mut command, Some("http://localhost:9098"));
        let environment = command
            .get_envs()
            .map(|(key, value)| {
                (
                    key.to_string_lossy().into_owned(),
                    value.map(|value| value.to_string_lossy().into_owned()),
                )
            })
            .collect::<std::collections::HashMap<_, _>>();
        for key in [
            "HTTP_PROXY",
            "HTTPS_PROXY",
            "ALL_PROXY",
            "http_proxy",
            "https_proxy",
            "all_proxy",
        ] {
            assert_eq!(
                environment.get(key),
                Some(&Some("http://localhost:9098".to_owned()))
            );
        }
    }

    #[test]
    fn removes_inherited_proxy_environment_when_disabled() {
        let mut command = Command::new("codex");
        configure_proxy_environment(&mut command, None);
        let environment = command
            .get_envs()
            .map(|(key, value)| (key.to_string_lossy().into_owned(), value))
            .collect::<std::collections::HashMap<_, _>>();
        for key in [
            "HTTP_PROXY",
            "HTTPS_PROXY",
            "ALL_PROXY",
            "http_proxy",
            "https_proxy",
            "all_proxy",
        ] {
            assert!(environment.contains_key(key));
            assert_eq!(environment[key], None);
        }
    }

    #[test]
    fn local_document_write_uses_content_revisions() {
        let directory = env::temp_dir().join(format!(
            "cotab-storage-test-{}-{}",
            std::process::id(),
            std::thread::current().name().unwrap_or("thread")
        ));
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join("score.cotab");

        let first = write_local_document_path(&path, vec![1, 2, 3], None).unwrap();
        let first_revision = match first {
            LocalWriteResult::Saved { revision } => revision,
            LocalWriteResult::Conflict { .. } => panic!("unexpected conflict"),
        };
        assert_eq!(
            read_local_document_path(&path).unwrap().unwrap().revision,
            first_revision
        );

        let conflict = write_local_document_path(&path, vec![4, 5, 6], None).unwrap();
        assert!(matches!(conflict, LocalWriteResult::Conflict { .. }));

        let second = write_local_document_path(&path, vec![4, 5, 6], Some(first_revision)).unwrap();
        assert!(matches!(second, LocalWriteResult::Saved { .. }));
        assert_eq!(fs::read(&path).unwrap(), vec![4, 5, 6]);

        fs::remove_dir_all(directory).unwrap();
    }
}
