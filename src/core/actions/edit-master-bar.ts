import * as Y from "yjs";
import { documentActionRegistry } from "@/core/actions/registry";
import type { DocumentActionDefinition } from "@/core/actions/types";
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
): DocumentActionDefinition<number> {
  return {
    id,
    i18nKey: `actions.${id}`,
    category: "document.masterBar",
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
): DocumentActionDefinition<boolean> {
  return {
    id,
    i18nKey: `actions.${id}`,
    category: "document.masterBar",
    params: [
      { name: "value", type: "boolean", i18nKey: `actions.${id}.params.value` },
    ],
    execute: (value, _context) => {
      applyMasterBarUpdates({ [field]: value });
    },
  };
}

const setTimeSignatureNumeratorAction = scalarAction(
  "document.masterBar.setTimeSignatureNumerator",
  "timeSignatureNumerator",
);
const setTimeSignatureDenominatorAction = scalarAction(
  "document.masterBar.setTimeSignatureDenominator",
  "timeSignatureDenominator",
);
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

const setSectionAction: DocumentActionDefinition<SectionSchema | null> = {
  id: "document.masterBar.setSection",
  i18nKey: "actions.edit.masterBar.setSection",
  category: "document.masterBar",
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

const setTempoAutomationsAction: DocumentActionDefinition<AutomationSchema[]> = {
  id: "document.masterBar.setTempoAutomations",
  i18nKey: "actions.edit.masterBar.setTempoAutomations",
  category: "document.masterBar",
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

const setTempoAction: DocumentActionDefinition<number | null> = {
  id: "document.masterBar.setTempo",
  i18nKey: "actions.edit.masterBar.setTempo",
  category: "document.masterBar",
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

documentActionRegistry.register(setTimeSignatureNumeratorAction);
documentActionRegistry.register(setTimeSignatureDenominatorAction);
documentActionRegistry.register(setIsRepeatStartAction);
documentActionRegistry.register(setRepeatCountAction);
documentActionRegistry.register(setAlternateEndingsAction);
documentActionRegistry.register(setTripletFeelAction);
documentActionRegistry.register(setIsFreeTimeAction);
documentActionRegistry.register(setSectionAction);
documentActionRegistry.register(setTempoAutomationsAction);
documentActionRegistry.register(setTempoAction);

declare global {
  interface DocumentActionMap {
    "document.masterBar.setTimeSignatureNumerator": { args: number; result: void };
    "document.masterBar.setTimeSignatureDenominator": { args: number; result: void };
    "document.masterBar.setIsRepeatStart": { args: boolean; result: void };
    "document.masterBar.setRepeatCount": { args: number; result: void };
    "document.masterBar.setAlternateEndings": { args: number; result: void };
    "document.masterBar.setTripletFeel": { args: number; result: void };
    "document.masterBar.setIsFreeTime": { args: boolean; result: void };
    "document.masterBar.setSection": { args: SectionSchema | null; result: void };
    "document.masterBar.setTempoAutomations": {
      args: AutomationSchema[];
      result: void;
    };
    "document.masterBar.setTempo": { args: number | null; result: void };
  }
}

export {};
