import { useEffect, useId, useState } from "react";
import { Cloud, FolderOpen, Save } from "lucide-react";
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
import {
  finishWebDavLocation,
  useWebDavLocation,
} from "@/storage/webdav-location";

function normalizeDocumentPath(path: string, operation: "open" | "save"): string {
  const trimmed = path.trim().replace(/^\/+/, "");
  if (operation === "save" && trimmed && !trimmed.toLowerCase().endsWith(".cotab")) {
    return `${trimmed}.cotab`;
  }
  return trimmed;
}

export function WebDavLocationDialog() {
  const { t } = useTranslation();
  const request = useWebDavLocation((state) => state.request);
  const baseUrlId = useId();
  const usernameId = useId();
  const passwordId = useId();
  const pathId = useId();
  const [baseUrl, setBaseUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!request) return;
    setBaseUrl(request.initialConfig.baseUrl);
    setUsername(request.initialConfig.username);
    setPassword(request.initialConfig.password);
    setPath(request.suggestedName);
    setError(null);
  }, [request]);

  const submit = () => {
    if (!request) return;
    let normalizedBaseUrl: string;
    try {
      const url = new URL(baseUrl.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error();
      }
      if (!url.pathname.endsWith("/")) url.pathname += "/";
      url.search = "";
      url.hash = "";
      normalizedBaseUrl = url.href;
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
      <DialogContent className="sm:max-w-md">
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
          <label htmlFor={baseUrlId} className="block space-y-1">
            <span className="text-xs font-medium">
              {t("storage.webdav.server")}
            </span>
            <Input
              id={baseUrlId}
              type="url"
              value={baseUrl}
              placeholder="https://cloud.example.com/dav/files/user/"
              autoComplete="url"
              onChange={(event) => setBaseUrl(event.currentTarget.value)}
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
                onChange={(event) => setUsername(event.currentTarget.value)}
              />
            </label>
            <label htmlFor={passwordId} className="block space-y-1">
              <span className="text-xs font-medium">
                {t("storage.webdav.password")}
              </span>
              <Input
                id={passwordId}
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.currentTarget.value)}
              />
            </label>
          </div>
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
