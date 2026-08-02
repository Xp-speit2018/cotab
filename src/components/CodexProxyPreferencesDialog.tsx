import { useEffect, useState, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { agentSession } from "@/agent/agent-session";
import { normalizeCodexProxyUrl } from "@/agent/codex-proxy-settings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CodexProxyPreferencesDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function CodexProxyPreferencesDialog({
  open,
  onOpenChange,
}: CodexProxyPreferencesDialogProps) {
  const { t } = useTranslation();
  const session = useSyncExternalStore(
    agentSession.subscribe,
    agentSession.getSnapshot,
  );
  const [enabled, setEnabled] = useState(session.proxy.enabled);
  const [url, setUrl] = useState(session.proxy.url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEnabled(session.proxy.enabled);
    setUrl(session.proxy.url);
    setError(null);
  }, [open, session.proxy.enabled, session.proxy.url]);

  const apply = async () => {
    let normalizedUrl = url.trim();
    if (enabled) {
      try {
        normalizedUrl = normalizeCodexProxyUrl(normalizedUrl);
      } catch {
        setError(t("agent.proxy.invalid"));
        return;
      }
    }

    setSaving(true);
    try {
      await agentSession.setProxy({ enabled, url: normalizedUrl });
      onOpenChange(false);
    } catch (applyError) {
      setError(
        applyError instanceof Error ? applyError.message : String(applyError),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("agent.proxy.title")}</DialogTitle>
          <DialogDescription>
            {t("toolbar.preferences.codexProxyDescription")}
          </DialogDescription>
        </DialogHeader>

        <label className="flex items-center gap-2 rounded-md py-1 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            className="h-3.5 w-3.5 accent-primary"
            onChange={(event) => setEnabled(event.currentTarget.checked)}
          />
          <span>{t("agent.proxy.enabled")}</span>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-xs font-medium text-muted-foreground">
            {t("agent.proxy.url")}
          </span>
          <input
            type="url"
            value={url}
            disabled={!enabled}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            aria-label={t("agent.proxy.url")}
            placeholder="http://127.0.0.1:9098"
            className="h-9 w-full rounded-md border bg-background px-2 font-mono text-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            onChange={(event) => setUrl(event.currentTarget.value)}
          />
        </label>
        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("sidebar.common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={
              saving ||
              session.phase === "connecting" ||
              session.phase === "working" ||
              (enabled && !url.trim())
            }
            onClick={() => void apply()}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("agent.proxy.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
