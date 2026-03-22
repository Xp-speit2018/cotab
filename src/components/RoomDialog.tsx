import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { engine } from "@/core/engine";
import { useEditorStore } from "@/stores/editor-store";
import { usePlayerStore } from "@/stores/render-store";

export function RoomDialog() {
  const { t } = useTranslation();
  const open = usePlayerStore((s) => s.roomDialogOpen);
  const connected = useEditorStore((s) => s.connected);
  const roomCode = useEditorStore((s) => s.roomCode);
  const peers = useEditorStore((s) => s.peers);
  const connectionStatus = useEditorStore((s) => s.connectionStatus);
  const connectionError = useEditorStore((s) => s.connectionError);
  const storedUserName = useEditorStore((s) => s.userName);

  const [tab, setTab] = useState<"create" | "join">("create");
  const [joinCode, setJoinCode] = useState("");
  const [userName, setUserName] = useState("");
  const [copied, setCopied] = useState(false);

  const isConnecting = connectionStatus === "connecting";

  const handleOpenChange = (value: boolean) => {
    usePlayerStore.setState({ roomDialogOpen: value });
  };

  const handleCreate = async () => {
    const name = userName.trim() || "Anonymous";
    await engine.createRoom(name);
  };

  const handleJoin = async () => {
    const code = joinCode.trim();
    if (!code) return;
    const name = userName.trim() || "Anonymous";
    await engine.connect(code, name);
  };

  const handleDisconnect = async () => {
    await engine.disconnect();
  };

  const handleCopyCode = async () => {
    if (!roomCode) return;
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("room.dialogTitle")}</DialogTitle>
        </DialogHeader>

        {connected ? (
          <div className="space-y-4 py-2">
            {/* Connected state */}
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium">{t("room.connected")}</span>
            </div>

            {/* Room code */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                {t("room.roomCode")}
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded border bg-muted px-3 py-1.5 font-mono text-sm">
                  {roomCode}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopyCode}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Display name */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                {t("room.userName")}
              </label>
              <p className="text-sm">{storedUserName}</p>
            </div>

            {/* Peers */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                {t("room.peers")}
              </label>
              {peers.length > 0 ? (
                <ul className="space-y-1">
                  {peers.map((peer) => (
                    <li key={peer.id} className="text-sm">
                      {peer.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("room.noPeers")}
                </p>
              )}
            </div>

            <Button
              variant="destructive"
              className="w-full"
              onClick={handleDisconnect}
            >
              {t("room.disconnect")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Tab selector */}
            <div className="flex gap-1 rounded-lg border p-1">
              <button
                type="button"
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === "create"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setTab("create")}
              >
                {t("room.createTab")}
              </button>
              <button
                type="button"
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === "join"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setTab("join")}
              >
                {t("room.joinTab")}
              </button>
            </div>

            {/* Username input (shared) */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                {t("room.userName")}
              </label>
              <Input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder={t("room.userNamePlaceholder")}
              />
            </div>

            {tab === "join" && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  {t("room.roomCode")}
                </label>
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder={t("room.roomCodePlaceholder")}
                  maxLength={6}
                />
              </div>
            )}

            {/* Error */}
            {connectionError && (
              <p className="text-sm text-destructive">
                {t(`room.${connectionError}`)}
              </p>
            )}

            {/* Action button */}
            {tab === "create" ? (
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("room.connecting")}
                  </>
                ) : (
                  t("room.createRoom")
                )}
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={handleJoin}
                disabled={isConnecting || !joinCode.trim()}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("room.connecting")}
                  </>
                ) : (
                  t("room.joinRoom")
                )}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
