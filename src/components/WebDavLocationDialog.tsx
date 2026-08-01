import { useEffect, useId, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  Cloud,
  FileMusic,
  Folder,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  createWebDavConnection,
  finishWebDavLocation,
  getWebDavConnection,
  normalizeWebDavBaseUrl,
  removeWebDavProfile,
  useWebDavLocation,
  type WebDavConnectionConfig,
} from "@/storage/webdav-location";
import {
  listWebDavDirectory,
  type WebDavDirectoryEntry,
} from "@/storage/webdav-provider";

function normalizeDocumentPath(path: string, operation: "open" | "save"): string {
  const trimmed = path.trim().replace(/^\/+/, "");
  const lower = trimmed.toLowerCase();
  if (
    operation === "save" &&
    trimmed &&
    !lower.endsWith(".cotab") &&
    !lower.endsWith(".gp")
  ) {
    return `${trimmed}.cotab`;
  }
  return trimmed;
}

function parentDirectory(path: string): string {
  const segments = path.replace(/\/$/, "").split("/").filter(Boolean);
  segments.pop();
  return segments.length > 0 ? `${segments.join("/")}/` : "";
}

function formatFileSize(size: number | null): string | null {
  if (size === null) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function WebDavLocationDialog() {
  const { t } = useTranslation();
  const request = useWebDavLocation((state) => state.request);
  const profiles = useWebDavLocation((state) => state.profiles);
  const nameId = useId();
  const baseUrlId = useId();
  const usernameId = useId();
  const passwordId = useId();
  const pathId = useId();
  const [profileId, setProfileId] = useState("");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [directory, setDirectory] = useState("");
  const [entries, setEntries] = useState<readonly WebDavDirectoryEntry[]>([]);
  const [browseStatus, setBrowseStatus] = useState<
    "idle" | "loading" | "ready"
  >("idle");
  const browseRequestRef = useRef(0);

  const resetBrowser = () => {
    browseRequestRef.current += 1;
    setDirectory("");
    setEntries([]);
    setBrowseStatus("idle");
  };

  useEffect(() => {
    if (!request) return;
    setProfileId(request.initialConfig.id);
    setName(request.initialConfig.name);
    setBaseUrl(request.initialConfig.baseUrl);
    setUsername(request.initialConfig.username);
    setPassword(request.initialConfig.password);
    setPath(request.suggestedName);
    resetBrowser();
    setError(null);
  }, [request]);

  const editConnection = (config: WebDavConnectionConfig) => {
    setProfileId(config.id);
    setName(config.name);
    setBaseUrl(config.baseUrl);
    setUsername(config.username);
    setPassword(config.password);
    resetBrowser();
    setError(null);
  };

  const browse = async (nextDirectory: string) => {
    let normalizedBaseUrl: string;
    try {
      normalizedBaseUrl = normalizeWebDavBaseUrl(baseUrl).href;
    } catch {
      setError(t("storage.webdav.invalidServer"));
      return;
    }

    const browseRequest = ++browseRequestRef.current;
    setBrowseStatus("loading");
    setError(null);
    try {
      const nextEntries = await listWebDavDirectory({
        id: profileId,
        name: name.trim() || "WebDAV",
        baseUrl: normalizedBaseUrl,
        username: username.trim(),
        password,
      }, nextDirectory);
      if (browseRequest !== browseRequestRef.current) return;
      setDirectory(nextDirectory);
      setEntries(nextEntries);
      setBrowseStatus("ready");
    } catch (browseError) {
      if (browseRequest !== browseRequestRef.current) return;
      setBrowseStatus("idle");
      setError(
        browseError instanceof Error
          ? browseError.message
          : t("storage.webdav.browseFailed"),
      );
    }
  };

  const submit = () => {
    if (!request) return;
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError(t("storage.webdav.connectionNameRequired"));
      return;
    }
    let normalizedBaseUrl: string;
    try {
      normalizedBaseUrl = normalizeWebDavBaseUrl(baseUrl).href;
    } catch {
      setError(t("storage.webdav.invalidServer"));
      return;
    }

    const normalizedPath = normalizeDocumentPath(path, request.operation);
    if (!normalizedPath) {
      setError(t("storage.webdav.pathRequired"));
      return;
    }

    finishWebDavLocation({
      config: {
        id: profileId,
        name: normalizedName,
        baseUrl: normalizedBaseUrl,
        username: username.trim(),
        password,
      },
      path: normalizedPath,
    });
  };

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) finishWebDavLocation(null);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            {request?.operation === "open"
              ? t("storage.webdav.openTitle")
              : t("storage.webdav.saveTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("storage.webdav.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <span className="text-xs font-medium">
              {t("storage.webdav.savedServers")}
            </span>
            <div className="divide-y rounded-md border">
              {profiles.map((profile) => (
                <div key={profile.id} className="flex min-w-0 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto min-w-0 flex-1 justify-start rounded-none px-3 py-2 text-left"
                    aria-pressed={profile.id === profileId}
                    onClick={() => {
                      const config = getWebDavConnection(profile.id);
                      if (config) editConnection(config);
                    }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col items-start">
                      <span className="max-w-full truncate font-medium">
                        {profile.name}
                      </span>
                      <span className="max-w-full truncate text-xs font-normal text-muted-foreground">
                        {profile.baseUrl}
                      </span>
                    </span>
                    {profile.id === profileId && (
                      <Check className="h-4 w-4 shrink-0" />
                    )}
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mr-1 h-8 w-8 shrink-0"
                        aria-label={t("storage.webdav.deleteConnection", {
                          name: profile.name,
                        })}
                        onClick={() => {
                          const wasSelected = profile.id === profileId;
                          removeWebDavProfile(profile.id);
                          if (wasSelected) editConnection(createWebDavConnection());
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t("storage.webdav.deleteConnection", {
                        name: profile.name,
                      })}
                    </TooltipContent>
                  </Tooltip>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start rounded-none px-3"
                onClick={() => editConnection(createWebDavConnection())}
              >
                <Plus className="h-4 w-4" />
                {t("storage.webdav.newConnection")}
              </Button>
            </div>
          </div>
          <label htmlFor={nameId} className="block space-y-1">
            <span className="text-xs font-medium">
              {t("storage.webdav.connectionName")}
            </span>
            <Input
              id={nameId}
              value={name}
              autoComplete="off"
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </label>
          <label htmlFor={baseUrlId} className="block space-y-1">
            <span className="text-xs font-medium">
              {t("storage.webdav.server")}
            </span>
            <Input
              id={baseUrlId}
              inputMode="url"
              value={baseUrl}
              placeholder="localhost:6065 or https://cloud.example.com/dav/"
              autoComplete="url"
              onChange={(event) => {
                setBaseUrl(event.currentTarget.value);
                resetBrowser();
              }}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label htmlFor={usernameId} className="block space-y-1">
              <span className="text-xs font-medium">
                {t("storage.webdav.username")}
              </span>
              <Input
                id={usernameId}
                value={username}
                autoComplete="username"
                onChange={(event) => {
                  setUsername(event.currentTarget.value);
                  resetBrowser();
                }}
              />
            </label>
            <div className="space-y-1">
              <label htmlFor={passwordId} className="block text-xs font-medium">
                {t("storage.webdav.password")}
              </label>
              <PasswordInput
                id={passwordId}
                value={password}
                autoComplete="current-password"
                revealLabel={t("storage.webdav.revealPassword")}
                onChange={(event) => {
                  setPassword(event.currentTarget.value);
                  resetBrowser();
                }}
              />
            </div>
          </div>
          {request?.operation === "open" && (
            <div className="space-y-1">
              {browseStatus === "idle" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void browse("")}
                >
                  <FolderOpen className="h-4 w-4" />
                  {t("storage.webdav.browseServer")}
                </Button>
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <div className="flex h-9 items-center gap-1 border-b px-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={!directory || browseStatus === "loading"}
                          aria-label={t("storage.webdav.parentDirectory")}
                          onClick={() => void browse(parentDirectory(directory))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t("storage.webdav.parentDirectory")}
                      </TooltipContent>
                    </Tooltip>
                    <span className="min-w-0 flex-1 truncate px-1 text-xs text-muted-foreground">
                      /{directory}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={browseStatus === "loading"}
                          aria-label={t("storage.webdav.refreshDirectory")}
                          onClick={() => void browse(directory)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t("storage.webdav.refreshDirectory")}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div
                    className="max-h-44 min-h-20 overflow-y-auto p-1"
                    aria-label={t("storage.webdav.remoteFiles")}
                  >
                    {browseStatus === "loading" ? (
                      <div className="flex h-20 items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("storage.webdav.loadingDirectory")}
                      </div>
                    ) : entries.length === 0 ? (
                      <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">
                        {t("storage.webdav.emptyDirectory")}
                      </div>
                    ) : entries.map((entry) => {
                      const isDirectory = entry.kind === "directory";
                      const supported = isDirectory ||
                        entry.name.toLowerCase().endsWith(".cotab");
                      const size = formatFileSize(entry.size);
                      return (
                        <Button
                          key={`${entry.kind}:${entry.path}`}
                          type="button"
                          variant={path === entry.path ? "secondary" : "ghost"}
                          className="h-9 w-full justify-start gap-2 px-2"
                          disabled={!supported}
                          onClick={() => {
                            if (isDirectory) {
                              void browse(entry.path);
                            } else {
                              setPath(entry.path);
                              setError(null);
                            }
                          }}
                        >
                          {isDirectory
                            ? <Folder className="h-4 w-4 shrink-0" />
                            : <FileMusic className="h-4 w-4 shrink-0" />}
                          <span className="min-w-0 flex-1 truncate text-left">
                            {entry.name}
                          </span>
                          {size && (
                            <span className="shrink-0 text-[10px] font-normal text-muted-foreground">
                              {size}
                            </span>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <label htmlFor={pathId} className="block space-y-1">
            <span className="text-xs font-medium">
              {t("storage.webdav.documentPath")}
            </span>
            <Input
              id={pathId}
              value={path}
              placeholder="Scores/song.cotab"
              autoComplete="off"
              onChange={(event) => setPath(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
            />
          </label>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => finishWebDavLocation(null)}
          >
            {t("storage.webdav.cancel")}
          </Button>
          <Button onClick={submit}>
            {request?.operation === "open"
              ? <FolderOpen className="h-4 w-4" />
              : <Save className="h-4 w-4" />}
            {request?.operation === "open"
              ? t("storage.webdav.open")
              : t("storage.webdav.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
