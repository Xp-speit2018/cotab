import * as Y from "yjs";
import * as z from "zod";
import { engine } from "@/core/engine";
import { AutomationType, createAutomation } from "@/core/schema";
import { actionArgs, defineDocumentAction } from "./definition";
import {
  finiteNumber,
  positiveInteger,
  valueStringArgs,
} from "./args-schema";

const transact = (fn: () => void) => engine.localEditYDoc(fn);
const getScoreMap = () => engine.getScoreMap();

const scoreMetadataFieldSchema = z.enum([
  "title",
  "subTitle",
  "artist",
  "album",
  "words",
  "music",
  "copyright",
  "tab",
  "instructions",
  "notices",
]);

function setScoreField(
  field: z.output<typeof scoreMetadataFieldSchema>,
  value: string,
): void {
  const yScore = getScoreMap();
  if (!yScore) return;
  transact(() => {
    yScore.set(field, value);
  });
}

function replaceNumberArray(
  owner: Y.Map<unknown>,
  key: string,
  values: readonly number[],
): void {
  let array = owner.get(key) as Y.Array<number> | undefined;
  if (!array) {
    array = new Y.Array<number>();
    owner.set(key, array);
  } else if (array.length > 0) {
    array.delete(0, array.length);
  }
  if (values.length > 0) array.push([...values]);
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
    yAutomations.push([createAutomation(AutomationType.Tempo, 120, 0)]);
  }
  return yAutomations.get(0);
}

const setMetadataAction = defineDocumentAction({
  id: "document.score.setMetadata",
  i18nKey: "actions.edit.score.setMetadata",
  category: "document.score",
  argsSchema: actionArgs({
    field: scoreMetadataFieldSchema,
    value: z.string(),
  }),
  execute: ({ field, value }) => {
    setScoreField(field, value);
  },
});

const setTitleAction = defineDocumentAction({
  id: "document.score.setTitle",
  i18nKey: "actions.edit.score.setTitle",
  category: "document.score",
  argsSchema: valueStringArgs,
  execute: ({ value }) => {
    setScoreField("title", value);
  },
});

const setArtistAction = defineDocumentAction({
  id: "document.score.setArtist",
  i18nKey: "actions.edit.score.setArtist",
  category: "document.score",
  argsSchema: valueStringArgs,
  execute: ({ value }) => {
    setScoreField("artist", value);
  },
});

const setTempoAction = defineDocumentAction({
  id: "document.score.setTempo",
  i18nKey: "actions.edit.score.setTempo",
  category: "document.score",
  argsSchema: actionArgs({ tempo: finiteNumber.positive() }),
  execute: ({ tempo }) => {
    const yScore = getScoreMap();
    if (!yScore) return;
    transact(() => {
      getOrCreateInitialTempoAutomation(yScore)?.set("value", tempo);
    });
  },
});

const setTempoLabelAction = defineDocumentAction({
  id: "document.score.setTempoLabel",
  i18nKey: "actions.edit.score.setTempoLabel",
  category: "document.score",
  argsSchema: actionArgs({ label: z.string() }),
  execute: ({ label }) => {
    const yScore = getScoreMap();
    if (!yScore) return;
    transact(() => {
      getOrCreateInitialTempoAutomation(yScore)?.set("text", label);
    });
  },
});

const setDefaultSystemsLayoutAction = defineDocumentAction({
  id: "document.score.setDefaultSystemsLayout",
  i18nKey: "actions.edit.score.setDefaultSystemsLayout",
  category: "document.score",
  argsSchema: actionArgs({ value: positiveInteger }),
  execute: ({ value }) => {
    const yScore = getScoreMap();
    if (!yScore) return;
    transact(() => {
      yScore.set("defaultSystemsLayout", value);
    });
  },
});

const setSystemsLayoutAction = defineDocumentAction({
  id: "document.score.setSystemsLayout",
  i18nKey: "actions.edit.score.setSystemsLayout",
  category: "document.score",
  argsSchema: actionArgs({ value: z.array(positiveInteger) }),
  execute: ({ value }) => {
    const yScore = getScoreMap();
    if (!yScore) return;
    transact(() => {
      replaceNumberArray(yScore, "systemsLayout", value);
    });
  },
});

export const scoreDocumentActions = [
  setMetadataAction,
  setTitleAction,
  setArtistAction,
  setTempoAction,
  setTempoLabelAction,
  setDefaultSystemsLayoutAction,
  setSystemsLayoutAction,
] as const;
