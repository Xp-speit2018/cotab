import * as Y from "yjs";
import { actionRegistry } from "@/core/actions/registry";
import type { ActionDefinition } from "@/core/actions/types";
import { engine } from "@/core/engine";
import type {
  AutomationSchema,
  SectionSchema,
} from "@/core/schema";
import { AutomationType, createAutomation } from "@/core/schema";

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

function scalarAction(
  id: string,
  field: string,
): ActionDefinition<number> {
  return {
    id,
    i18nKey: `actions.${id}`,
    category: "edit.masterBar",
    params: [
      { name: "value", type: "number", i18nKey: `actions.${id}.params.value` },
    ],
    execute: (value, _context) => {
      applyMasterBarUpdates({ [field]: value });
    },
  };
}

function booleanAction(
  id: string,
  field: string,
): ActionDefinition<boolean> {
  return {
    id,
    i18nKey: `actions.${id}`,
    category: "edit.masterBar",
    params: [
      { name: "value", type: "boolean", i18nKey: `actions.${id}.params.value` },
    ],
    execute: (value, _context) => {
      applyMasterBarUpdates({ [field]: value });
    },
  };
}

const setTimeSignatureNumeratorAction = scalarAction(
  "edit.masterBar.setTimeSignatureNumerator",
  "timeSignatureNumerator",
);
const setTimeSignatureDenominatorAction = scalarAction(
  "edit.masterBar.setTimeSignatureDenominator",
  "timeSignatureDenominator",
);
const setIsRepeatStartAction = booleanAction(
  "edit.masterBar.setIsRepeatStart",
  "isRepeatStart",
);
const setRepeatCountAction = scalarAction(
  "edit.masterBar.setRepeatCount",
  "repeatCount",
);
const setAlternateEndingsAction = scalarAction(
  "edit.masterBar.setAlternateEndings",
  "alternateEndings",
);
const setTripletFeelAction = scalarAction(
  "edit.masterBar.setTripletFeel",
  "tripletFeel",
);
const setIsFreeTimeAction = booleanAction(
  "edit.masterBar.setIsFreeTime",
  "isFreeTime",
);

const setSectionAction: ActionDefinition<SectionSchema | null> = {
  id: "edit.masterBar.setSection",
  i18nKey: "actions.edit.masterBar.setSection",
  category: "edit.masterBar",
  execute: (section, _context) => {
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
};

const setTempoAutomationsAction: ActionDefinition<AutomationSchema[]> = {
  id: "edit.masterBar.setTempoAutomations",
  i18nKey: "actions.edit.masterBar.setTempoAutomations",
  category: "edit.masterBar",
  execute: (automations, _context) => {
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
};

const setTempoAction: ActionDefinition<number | null> = {
  id: "edit.masterBar.setTempo",
  i18nKey: "actions.edit.masterBar.setTempo",
  category: "edit.masterBar",
  execute: (tempo, _context) => {
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
};

actionRegistry.register(setTimeSignatureNumeratorAction);
actionRegistry.register(setTimeSignatureDenominatorAction);
actionRegistry.register(setIsRepeatStartAction);
actionRegistry.register(setRepeatCountAction);
actionRegistry.register(setAlternateEndingsAction);
actionRegistry.register(setTripletFeelAction);
actionRegistry.register(setIsFreeTimeAction);
actionRegistry.register(setSectionAction);
actionRegistry.register(setTempoAutomationsAction);
actionRegistry.register(setTempoAction);

declare global {
  interface ActionMap {
    "edit.masterBar.setTimeSignatureNumerator": { args: number; result: void };
    "edit.masterBar.setTimeSignatureDenominator": { args: number; result: void };
    "edit.masterBar.setIsRepeatStart": { args: boolean; result: void };
    "edit.masterBar.setRepeatCount": { args: number; result: void };
    "edit.masterBar.setAlternateEndings": { args: number; result: void };
    "edit.masterBar.setTripletFeel": { args: number; result: void };
    "edit.masterBar.setIsFreeTime": { args: boolean; result: void };
    "edit.masterBar.setSection": { args: SectionSchema | null; result: void };
    "edit.masterBar.setTempoAutomations": {
      args: AutomationSchema[];
      result: void;
    };
    "edit.masterBar.setTempo": { args: number | null; result: void };
  }
}

export {};
