import * as alphaTab from "@coderline/alphatab";
import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
import { getApi } from "@/stores/render-api";

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "untitled";
}

const exportGpAction: ActionDefinition = {
  id: "file.exportGp",
  i18nKey: "actions.file.exportGp",
  category: "file",
  execute: (_args, _context) => {
    const score = getApi()?.score;
    if (!score) return;

    const exporter = new alphaTab.exporter.Gp7Exporter();
    const data = exporter.export(score, null);

    const filename = `${sanitizeFilename(score.title || "untitled")}.gp`;
    const blob = new Blob([data], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  },
  isEnabled: () => getApi()?.score != null,
};

actionRegistry.register(exportGpAction);

declare global {
  interface ActionMap {
    "file.exportGp": { args: void; result: void };
  }
}

export {};
