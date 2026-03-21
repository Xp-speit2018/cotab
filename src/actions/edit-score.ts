import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
import type { ScoreMetadataField } from "@/stores/render-types";
import { engine } from "@/core/engine";

const transact = (fn: () => void) => engine.localEditYDoc(fn);
const getScoreMap = () => engine.getScoreMap();

function setScoreField(field: ScoreMetadataField, value: string): void {
  const yScore = getScoreMap();
  if (!yScore) return;
  transact(() => {
    yScore.set(field, value);
  });
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
      yScore.set("tempo", tempo);
    });
  },
};

actionRegistry.register(setTitleAction);
actionRegistry.register(setArtistAction);
actionRegistry.register(setTempoAction);

declare global {
  interface ActionMap {
    "edit.score.setMetadata": {
      args: { field: ScoreMetadataField; value: string };
      result: void;
    };
    "edit.score.setTitle": { args: string; result: void };
    "edit.score.setArtist": { args: string; result: void };
    "edit.score.setTempo": { args: number; result: void };
  }
}

export {};
