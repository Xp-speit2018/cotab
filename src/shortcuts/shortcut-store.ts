import { create } from "zustand";
import type { ShortcutBinding, KeyCombo, ShortcutCategory } from "./types";
import { SHORTCUT_CATEGORY_ORDER } from "./types";
import { getAllDefaultBindings } from "./default-bindings";
import { patchBehaviorReaders } from "./behaviors";
import { isDisallowed } from "./disallow-list";

const STORAGE_KEY = "cotab:shortcut-bindings";
const PERC_MAPPING_KEY = "cotab:percussion-digit-map";

export type PercussionDigitMap = Record<number, number>;

const DEFAULT_PERCUSSION_DIGIT_MAP: PercussionDigitMap = {
  1: 36, // Kick Drum
  2: 38, // Snare Drum
  3: 42, // Hi-Hat Closed
  4: 46, // Hi-Hat Open
  5: 44, // Hi-Hat Pedal
  6: 50, // Tom High
  7: 47, // Tom Medium
  8: 43, // Tom Low
  9: 49, // Crash Medium
  0: 57, // Crash High
};

function loadPercussionDigitMap(): PercussionDigitMap {
  if (typeof localStorage === "undefined") return { ...DEFAULT_PERCUSSION_DIGIT_MAP };
  try {
    const raw = localStorage.getItem(PERC_MAPPING_KEY);
    if (!raw) return { ...DEFAULT_PERCUSSION_DIGIT_MAP };
    const parsed = JSON.parse(raw) as PercussionDigitMap;
    return { ...DEFAULT_PERCUSSION_DIGIT_MAP, ...parsed };
  } catch {
    return { ...DEFAULT_PERCUSSION_DIGIT_MAP };
  }
}

function savePercussionDigitMap(map: PercussionDigitMap): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PERC_MAPPING_KEY, JSON.stringify(map));
}

interface UserOverride {
  id: string;
  keys: KeyCombo;
}

function loadOverrides(): UserOverride[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UserOverride[];
  } catch {
    return [];
  }
}

function saveOverrides(bindings: ShortcutBinding[]): void {
  if (typeof localStorage === "undefined") return;
  const overrides: UserOverride[] = bindings
    .filter((b) => b.keys !== b.defaultKeys)
    .map((b) => ({ id: b.id, keys: b.keys }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

function buildInitialBindings(): ShortcutBinding[] {
  const defaults = getAllDefaultBindings();
  const overrides = loadOverrides();
  const overrideMap = new Map(overrides.map((o) => [o.id, o.keys]));

  for (const binding of defaults) {
    const override = overrideMap.get(binding.id);
    if (override !== undefined) {
      binding.keys = override;
    }
  }

  patchBehaviorReaders(defaults);
  return defaults;
}

export interface ShortcutStoreState {
  bindings: ShortcutBinding[];
  /** Fast lookup: combo string -> binding */
  comboIndex: Map<KeyCombo, ShortcutBinding>;

  getBinding: (combo: KeyCombo) => ShortcutBinding | undefined;
  getBindingById: (id: string) => ShortcutBinding | undefined;
  getBindingsByCategory: (category: ShortcutCategory) => ShortcutBinding[];
  getCategories: () => ShortcutCategory[];
  setBindingKeys: (id: string, newKeys: KeyCombo) => void;
  resetOne: (id: string) => void;
  resetAll: () => void;
  findDuplicates: (combo: KeyCombo, excludeId?: string) => ShortcutBinding[];
  isConfigPanelOpen: boolean;
  setConfigPanelOpen: (open: boolean) => void;

  percussionDigitMap: PercussionDigitMap;
  setPercussionDigitMapping: (digit: number, gp7Id: number) => void;
  resetPercussionDigitMap: () => void;
  getPercussionGp7Id: (digit: number) => number | undefined;
}

function buildComboIndex(bindings: ShortcutBinding[]): Map<KeyCombo, ShortcutBinding> {
  const index = new Map<KeyCombo, ShortcutBinding>();
  for (const b of bindings) {
    if (b.keys && !b.placeholder) {
      index.set(b.keys.toLowerCase(), b);
    }
  }
  return index;
}

export const useShortcutStore = create<ShortcutStoreState>((set, get) => {
  const initial = buildInitialBindings();

  return {
    bindings: initial,
    comboIndex: buildComboIndex(initial),
    isConfigPanelOpen: false,

    getBinding: (combo) => get().comboIndex.get(combo.toLowerCase()),

    getBindingById: (id) => get().bindings.find((b) => b.id === id),

    getBindingsByCategory: (category) =>
      get().bindings.filter((b) => b.category === category),

    getCategories: () => {
      const used = new Set(get().bindings.map((b) => b.category));
      return SHORTCUT_CATEGORY_ORDER.filter((c) => used.has(c));
    },

    setBindingKeys: (id, newKeys) => {
      if (isDisallowed(newKeys)) return;

      set((state) => {
        const bindings = state.bindings.map((b) =>
          b.id === id ? { ...b, keys: newKeys } : b,
        );
        patchBehaviorReaders(bindings);
        saveOverrides(bindings);
        return { bindings, comboIndex: buildComboIndex(bindings) };
      });
    },

    resetOne: (id) => {
      set((state) => {
        const bindings = state.bindings.map((b) =>
          b.id === id ? { ...b, keys: b.defaultKeys } : b,
        );
        patchBehaviorReaders(bindings);
        saveOverrides(bindings);
        return { bindings, comboIndex: buildComboIndex(bindings) };
      });
    },

    resetAll: () => {
      const fresh = getAllDefaultBindings();
      patchBehaviorReaders(fresh);
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
      set({ bindings: fresh, comboIndex: buildComboIndex(fresh) });
    },

    findDuplicates: (combo, excludeId) => {
      if (!combo) return [];
      const lower = combo.toLowerCase();
      return get().bindings.filter(
        (b) => b.keys.toLowerCase() === lower && b.id !== excludeId && !b.placeholder,
      );
    },

    setConfigPanelOpen: (open) => set({ isConfigPanelOpen: open }),

    percussionDigitMap: loadPercussionDigitMap(),

    setPercussionDigitMapping: (digit, gp7Id) => {
      set((state) => {
        const map = { ...state.percussionDigitMap, [digit]: gp7Id };
        savePercussionDigitMap(map);
        return { percussionDigitMap: map };
      });
    },

    resetPercussionDigitMap: () => {
      const fresh = { ...DEFAULT_PERCUSSION_DIGIT_MAP };
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(PERC_MAPPING_KEY);
      }
      set({ percussionDigitMap: fresh });
    },

    getPercussionGp7Id: (digit) => get().percussionDigitMap[digit],
  };
});
