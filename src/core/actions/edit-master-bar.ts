import * as Y from "yjs";
import { engine } from "@/core/engine";
import { AutomationType, createAutomation } from "@/core/schema";
import { actionArgs, defineDocumentAction } from "./definition";
import {
  automationSchema,
  finiteNumber,
  integer,
  sectionSchema,
  valueBooleanArgs,
  valueIntegerArgs,
} from "./args-schema";
import * as z from "zod";

const transact = (fn: () => void) => engine.localEditYDoc(fn);

function resolveSelectedMasterBar(): Y.Map<unknown> | null {
  const { barIndex } = engine.selector;
  if (barIndex === null) return null;
  return engine.resolveYMasterBar(barIndex);
}

function applyMasterBarUpdates(updates: Record<string, unknown>): void {
  const yMasterBar = resolveSelectedMasterBar();
  if (!yMasterBar) return;
  transact(() => {
    for (const [field, value] of Object.entries(updates)) {
      yMasterBar.set(field, value);
    }
  });
}

function scalarAction<const Id extends string>(
  id: Id,
  field: string,
){
  return defineDocumentAction({
    id,
    i18nKey: `actions.${id}`,
    category: "document.masterBar",
    argsSchema: valueIntegerArgs,
    execute: ({ value }) => {
      applyMasterBarUpdates({ [field]: value });
    },
  });
}

function booleanAction<const Id extends string>(
  id: Id,
  field: string,
){
  return defineDocumentAction({
    id,
    i18nKey: `actions.${id}`,
    category: "document.masterBar",
    argsSchema: valueBooleanArgs,
    execute: ({ value }) => {
      applyMasterBarUpdates({ [field]: value });
    },
  });
}

const setTimeSignatureNumeratorAction = scalarAction(
  "document.masterBar.setTimeSignatureNumerator",
  "timeSignatureNumerator",
);
const setTimeSignatureDenominatorAction = scalarAction(
  "document.masterBar.setTimeSignatureDenominator",
  "timeSignatureDenominator",
);
const setTimeSignatureAction = defineDocumentAction({
  id: "document.masterBar.setTimeSignature",
  i18nKey: "actions.edit.masterBar.setTimeSignature",
  category: "document.masterBar",
  argsSchema: actionArgs({
    numerator: integer.min(1).max(32),
    denominator: integer.min(1).max(64),
  }),
  execute: ({ numerator, denominator }) => {
    applyMasterBarUpdates({
      timeSignatureNumerator: numerator,
      timeSignatureDenominator: denominator,
    });
  },
});
const setIsRepeatStartAction = booleanAction(
  "document.masterBar.setIsRepeatStart",
  "isRepeatStart",
);
const setRepeatCountAction = scalarAction(
  "document.masterBar.setRepeatCount",
  "repeatCount",
);
const setAlternateEndingsAction = scalarAction(
  "document.masterBar.setAlternateEndings",
  "alternateEndings",
);
const setTripletFeelAction = scalarAction(
  "document.masterBar.setTripletFeel",
  "tripletFeel",
);
const setIsFreeTimeAction = booleanAction(
  "document.masterBar.setIsFreeTime",
  "isFreeTime",
);

const setSectionAction = defineDocumentAction({
  id: "document.masterBar.setSection",
  i18nKey: "actions.edit.masterBar.setSection",
  category: "document.masterBar",
  argsSchema: actionArgs({ section: sectionSchema.nullable() }),
  execute: ({ section }) => {
    const yMasterBar = resolveSelectedMasterBar();
    if (!yMasterBar) return;
    transact(() => {
      if (section === null) {
        yMasterBar.set("section", null);
        return;
      }
      const ySection = new Y.Map<unknown>();
      ySection.set("text", section.text);
      ySection.set("marker", section.marker);
      yMasterBar.set("section", ySection);
    });
  },
});

const setTempoAutomationsAction = defineDocumentAction({
  id: "document.masterBar.setTempoAutomations",
  i18nKey: "actions.edit.masterBar.setTempoAutomations",
  category: "document.masterBar",
  argsSchema: actionArgs({ automations: z.array(automationSchema) }),
  execute: ({ automations }) => {
    const yMasterBar = resolveSelectedMasterBar();
    if (!yMasterBar) return;
    transact(() => {
      let yAutomations = yMasterBar.get("tempoAutomations") as
        | Y.Array<Y.Map<unknown>>
        | undefined;
      if (!yAutomations) {
        yAutomations = new Y.Array<Y.Map<unknown>>();
        yMasterBar.set("tempoAutomations", yAutomations);
      }
      yAutomations.delete(0, yAutomations.length);
      for (const automation of automations) {
        const yAutomation = new Y.Map<unknown>();
        for (const [field, value] of Object.entries(automation)) {
          yAutomation.set(field, value);
        }
        yAutomations.push([yAutomation]);
      }
    });
  },
});

const setTempoAction = defineDocumentAction({
  id: "document.masterBar.setTempo",
  i18nKey: "actions.edit.masterBar.setTempo",
  category: "document.masterBar",
  argsSchema: actionArgs({ tempo: finiteNumber.positive().nullable() }),
  execute: ({ tempo }) => {
    const yMasterBar = resolveSelectedMasterBar();
    if (!yMasterBar) return;
    transact(() => {
      let yAutomations = yMasterBar.get("tempoAutomations") as
        | Y.Array<Y.Map<unknown>>
        | undefined;
      if (!yAutomations) {
        if (tempo === null) return;
        yAutomations = new Y.Array<Y.Map<unknown>>();
        yMasterBar.set("tempoAutomations", yAutomations);
      }

      let tempoIndex = -1;
      for (let i = 0; i < yAutomations.length; i++) {
        if (
          ((yAutomations.get(i).get("type") as number | undefined) ??
            AutomationType.Tempo) === AutomationType.Tempo
        ) {
          tempoIndex = i;
          break;
        }
      }

      if (tempo === null) {
        if (tempoIndex >= 0) yAutomations.delete(tempoIndex, 1);
        return;
      }
      if (tempoIndex >= 0) {
        yAutomations.get(tempoIndex).set("value", tempo);
      } else {
        yAutomations.push([
          createAutomation(AutomationType.Tempo, tempo, 0),
        ]);
      }
    });
  },
});

export const masterBarDocumentActions = [
  setTimeSignatureNumeratorAction,
  setTimeSignatureDenominatorAction,
  setTimeSignatureAction,
  setIsRepeatStartAction,
  setRepeatCountAction,
  setAlternateEndingsAction,
  setTripletFeelAction,
  setIsFreeTimeAction,
  setSectionAction,
  setTempoAutomationsAction,
  setTempoAction,
] as const;
