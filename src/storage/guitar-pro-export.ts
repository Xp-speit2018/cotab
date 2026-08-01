import * as alphaTab from "@coderline/alphatab";

import { getApi } from "@/stores/render-api";

export function exportCurrentScoreAsGp7(): Uint8Array {
  const score = getApi()?.score;
  if (!score) throw new Error("No rendered score is available to export.");
  return new alphaTab.exporter.Gp7Exporter().export(score, null);
}
