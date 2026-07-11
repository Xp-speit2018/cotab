import { documentActionRegistry } from "./registry";
import type { DocumentActionDefinition } from "./types";
import type { ScoreMetadataField } from "@/core/schema";
import { AutomationType, createAutomation } from "@/core/schema";
import { engine } from "@/core/engine";
import * as Y from "yjs";

const transact = (fn: () => void) => engine.localEditYDoc(fn);
const getScoreMap = () => engine.getScoreMap();

function setScoreField(field: ScoreMetadataField, value: string): void {
  const yScore = getScoreMap();
  if (!yScore) return;
  transact(() => {
    yScore.set(field, value);
  });
}

function getOrCreateInitialTempoAutomation(
  yScore: Y.Map<unknown>,
): Y.Map<unknown> | null {
  const yMasterBars = yScore.get("masterBars") as
    | Y.Array<Y.Map<unknown>>
    | undefined;
  const yFirstMasterBar = yMasterBars?.get(0);
  if (!yFirstMasterBar) return null;

  let yAutomations = yFirstMasterBar.get("tempoAutomations") as
    | Y.Array<Y.Map<unknown>>
    | undefined;
  if (!yAutomations) {
    yAutomations = new Y.Array<Y.Map<unknown>>();
    yFirstMasterBar.set("tempoAutomations", yAutomations);
  }
  if (yAutomations.length === 0) {
    yAutomations.push([
      createAutomation(AutomationType.Tempo, 120, 0),
    ]);
  }
  return yAutomations.get(0);
}

const setMetadataAction: DocumentActionDefinition<{ field: ScoreMetadataField; value: string }> = {
  id: "document.score.setMetadata",
  i18nKey: "actions.edit.score.setMetadata",
  category: "document.score",
  params: [
    { name: "field", type: "string", i18nKey: "actions.edit.score.setMetadata.params.field" },
    { name: "value", type: "string", i18nKey: "actions.edit.score.setMetadata.params.value" },
  ],
  execute: ({ field, value }, _context) => {
    setScoreField(field, value);
  },
};

documentActionRegistry.register(setMetadataAction);

const setTitleAction: DocumentActionDefinition<string> = {
  id: "document.score.setTitle",
  i18nKey: "actions.edit.score.setTitle",
  category: "document.score",
  params: [
    { name: "value", type: "string", i18nKey: "actions.edit.score.setTitle.params.value" },
  ],
  execute: (value, _context) => {
    setScoreField("title", value);
  },
};

const setArtistAction: DocumentActionDefinition<string> = {
  id: "document.score.setArtist",
  i18nKey: "actions.edit.score.setArtist",
  category: "document.score",
  params: [
    { name: "value", type: "string", i18nKey: "actions.edit.score.setArtist.params.value" },
  ],
  execute: (value, _context) => {
    setScoreField("artist", value);
  },
};

const setTempoAction: DocumentActionDefinition<number> = {
  id: "document.score.setTempo",
  i18nKey: "actions.edit.score.setTempo",
  category: "document.score",
  params: [
    { name: "tempo", type: "number", i18nKey: "actions.edit.score.setTempo.params.tempo" },
  ],
  execute: (tempo, _context) => {
    const yScore = getScoreMap();
    if (!yScore || tempo <= 0) return;
    transact(() => {
      getOrCreateInitialTempoAutomation(yScore)?.set("value", tempo);
    });
  },
};

const setTempoLabelAction: DocumentActionDefinition<string> = {
  id: "document.score.setTempoLabel",
  i18nKey: "actions.edit.score.setTempoLabel",
  category: "document.score",
  params: [
    {
      name: "label",
      type: "string",
      i18nKey: "actions.edit.score.setTempoLabel.params.label",
    },
  ],
  execute: (label, _context) => {
    const yScore = getScoreMap();
    if (!yScore) return;
    transact(() => {
      getOrCreateInitialTempoAutomation(yScore)?.set("text", label);
    });
  },
};

documentActionRegistry.register(setTitleAction);
documentActionRegistry.register(setArtistAction);
documentActionRegistry.register(setTempoAction);
documentActionRegistry.register(setTempoLabelAction);

declare global {
  interface DocumentActionMap {
    "document.score.setMetadata": {
      args: { field: ScoreMetadataField; value: string };
      result: void;
    };
    "document.score.setTitle": { args: string; result: void };
    "document.score.setArtist": { args: string; result: void };
    "document.score.setTempo": { args: number; result: void };
    "document.score.setTempoLabel": { args: string; result: void };
  }
}

export {};
