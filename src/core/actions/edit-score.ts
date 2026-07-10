import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
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

const setMetadataAction: ActionDefinition<{ field: ScoreMetadataField; value: string }> = {
  id: "edit.score.setMetadata",
  i18nKey: "actions.edit.score.setMetadata",
  category: "edit.score",
  params: [
    { name: "field", type: "string", i18nKey: "actions.edit.score.setMetadata.params.field" },
    { name: "value", type: "string", i18nKey: "actions.edit.score.setMetadata.params.value" },
  ],
  execute: ({ field, value }, _context) => {
    setScoreField(field, value);
  },
};

actionRegistry.register(setMetadataAction);

const setTitleAction: ActionDefinition<string> = {
  id: "edit.score.setTitle",
  i18nKey: "actions.edit.score.setTitle",
  category: "edit.score",
  params: [
    { name: "value", type: "string", i18nKey: "actions.edit.score.setTitle.params.value" },
  ],
  execute: (value, _context) => {
    setScoreField("title", value);
  },
};

const setArtistAction: ActionDefinition<string> = {
  id: "edit.score.setArtist",
  i18nKey: "actions.edit.score.setArtist",
  category: "edit.score",
  params: [
    { name: "value", type: "string", i18nKey: "actions.edit.score.setArtist.params.value" },
  ],
  execute: (value, _context) => {
    setScoreField("artist", value);
  },
};

const setTempoAction: ActionDefinition<number> = {
  id: "edit.score.setTempo",
  i18nKey: "actions.edit.score.setTempo",
  category: "edit.score",
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

const setTempoLabelAction: ActionDefinition<string> = {
  id: "edit.score.setTempoLabel",
  i18nKey: "actions.edit.score.setTempoLabel",
  category: "edit.score",
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

actionRegistry.register(setTitleAction);
actionRegistry.register(setArtistAction);
actionRegistry.register(setTempoAction);
actionRegistry.register(setTempoLabelAction);

declare global {
  interface ActionMap {
    "edit.score.setMetadata": {
      args: { field: ScoreMetadataField; value: string };
      result: void;
    };
    "edit.score.setTitle": { args: string; result: void };
    "edit.score.setArtist": { args: string; result: void };
    "edit.score.setTempo": { args: number; result: void };
    "edit.score.setTempoLabel": { args: string; result: void };
  }
}

export {};
