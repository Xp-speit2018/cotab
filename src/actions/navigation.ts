import { actionRegistry } from "./registry";
import type { ActionDefinition } from "./types";
import { getApi, getSnapGrids } from "@/stores/player-internals";
import { usePlayerStore } from "@/stores/player-store";

type NavAction = ActionDefinition<void>;

const navNextBeat: NavAction = {
  id: "nav.nextBeat",
  i18nKey: "actions.nav.nextBeat",
  category: "navigation",
  execute: (_args, _context) => {
    const store = usePlayerStore.getState();
    const sel = store.selectedBeat;
    const api = getApi();
    if (!sel || !api?.score) return;
    const track = api.score.tracks[sel.trackIndex];
    if (!track) return;
    const staff = track.staves[sel.staffIndex];
    if (!staff) return;
    const bar = staff.bars[sel.barIndex];
    if (!bar) return;
    const voice = bar.voices[sel.voiceIndex];
    if (!voice) return;

    if (sel.beatIndex < voice.beats.length - 1) {
      store.setSelection({ ...sel, beatIndex: sel.beatIndex + 1 });
    } else if (sel.barIndex < staff.bars.length - 1) {
      store.setSelection({ ...sel, barIndex: sel.barIndex + 1, beatIndex: 0 });
    }
  },
};

const navPrevBeat: NavAction = {
  id: "nav.prevBeat",
  i18nKey: "actions.nav.prevBeat",
  category: "navigation",
  execute: (_args, _context) => {
    const store = usePlayerStore.getState();
    const sel = store.selectedBeat;
    const api = getApi();
    if (!sel || !api?.score) return;
    const track = api.score.tracks[sel.trackIndex];
    if (!track) return;
    const staff = track.staves[sel.staffIndex];
    if (!staff) return;

    if (sel.beatIndex > 0) {
      store.setSelection({ ...sel, beatIndex: sel.beatIndex - 1 });
    } else if (sel.barIndex > 0) {
      const prevBar = staff.bars[sel.barIndex - 1];
      if (!prevBar) return;
      const voice = prevBar.voices[sel.voiceIndex];
      if (!voice) return;
      store.setSelection({
        ...sel,
        barIndex: sel.barIndex - 1,
        beatIndex: voice.beats.length - 1,
      });
    }
  },
};

const navMoveUp: NavAction = {
  id: "nav.moveUp",
  i18nKey: "actions.nav.moveUp",
  category: "navigation",
  execute: (_args, _context) => {
    const store = usePlayerStore.getState();
    const sel = store.selectedBeat;
    const api = getApi();
    if (!sel || !api?.score) return;
    const gridKey = `${sel.trackIndex}:${sel.staffIndex}`;
    const grid = getSnapGrids().get(gridKey);
    if (!grid || grid.positions.length === 0) return;

    if (sel.string === null) {
      store.setSelection({
        ...sel,
        string: grid.positions[grid.positions.length - 1]?.string ?? null,
      });
      return;
    }

    const curIdx = grid.positions.findIndex((p) => p.string === sel.string);
    if (curIdx > 0) {
      store.setSelection({ ...sel, string: grid.positions[curIdx - 1].string });
    }
  },
};

const navMoveDown: NavAction = {
  id: "nav.moveDown",
  i18nKey: "actions.nav.moveDown",
  category: "navigation",
  execute: (_args, _context) => {
    const store = usePlayerStore.getState();
    const sel = store.selectedBeat;
    const api = getApi();
    if (!sel || !api?.score) return;
    const gridKey = `${sel.trackIndex}:${sel.staffIndex}`;
    const grid = getSnapGrids().get(gridKey);
    if (!grid || grid.positions.length === 0) return;

    if (sel.string === null) {
      store.setSelection({
        ...sel,
        string: grid.positions[0]?.string ?? null,
      });
      return;
    }

    const curIdx = grid.positions.findIndex((p) => p.string === sel.string);
    if (curIdx >= 0 && curIdx < grid.positions.length - 1) {
      store.setSelection({ ...sel, string: grid.positions[curIdx + 1].string });
    }
  },
};

const navNextBar: NavAction = {
  id: "nav.nextBar",
  i18nKey: "actions.nav.nextBar",
  category: "navigation",
  execute: (_args, _context) => {
    const store = usePlayerStore.getState();
    const sel = store.selectedBeat;
    const api = getApi();
    if (!sel || !api?.score) return;
    const track = api.score.tracks[sel.trackIndex];
    if (!track) return;
    const staff = track.staves[sel.staffIndex];
    if (!staff) return;

    if (sel.barIndex < staff.bars.length - 1) {
      store.setSelection({ ...sel, barIndex: sel.barIndex + 1, beatIndex: 0 });
    }
  },
};

const navPrevBar: NavAction = {
  id: "nav.prevBar",
  i18nKey: "actions.nav.prevBar",
  category: "navigation",
  execute: (_args, _context) => {
    const store = usePlayerStore.getState();
    const sel = store.selectedBeat;
    const api = getApi();
    if (!sel || !api?.score) return;
    const track = api.score.tracks[sel.trackIndex];
    if (!track) return;
    const staff = track.staves[sel.staffIndex];
    if (!staff) return;

    if (sel.barIndex > 0) {
      const prevBar = staff.bars[sel.barIndex - 1];
      if (!prevBar) return;
      const voice = prevBar.voices[sel.voiceIndex];
      if (!voice) return;
      store.setSelection({
        ...sel,
        barIndex: sel.barIndex - 1,
        beatIndex: voice.beats.length - 1,
      });
    }
  },
};

const navNextStaff: NavAction = {
  id: "nav.nextStaff",
  i18nKey: "actions.nav.nextStaff",
  category: "navigation",
  execute: (_args, _context) => {
    const store = usePlayerStore.getState();
    const sel = store.selectedBeat;
    const api = getApi();
    if (!sel || !api?.score) return;
    const visible = store.visibleTrackIndices;

    const allStaves: Array<{ trackIndex: number; staffIndex: number }> = [];
    for (const ti of visible) {
      const track = api.score.tracks[ti];
      if (!track) continue;
      for (let si = 0; si < track.staves.length; si++) {
        allStaves.push({ trackIndex: ti, staffIndex: si });
      }
    }

    const curPos = allStaves.findIndex(
      (s) => s.trackIndex === sel.trackIndex && s.staffIndex === sel.staffIndex,
    );
    if (curPos >= 0 && curPos < allStaves.length - 1) {
      const next = allStaves[curPos + 1];
      const barIndex = Math.min(
        sel.barIndex,
        (api.score.tracks[next.trackIndex]?.staves[next.staffIndex]?.bars.length ?? 1) - 1,
      );
      store.setSelection({
        trackIndex: next.trackIndex,
        staffIndex: next.staffIndex,
        voiceIndex: 0,
        barIndex,
        beatIndex: 0,
        string: null,
      });
    }
  },
};

const navPrevStaff: NavAction = {
  id: "nav.prevStaff",
  i18nKey: "actions.nav.prevStaff",
  category: "navigation",
  execute: (_args, _context) => {
    const store = usePlayerStore.getState();
    const sel = store.selectedBeat;
    const api = getApi();
    if (!sel || !api?.score) return;
    const visible = store.visibleTrackIndices;

    const allStaves: Array<{ trackIndex: number; staffIndex: number }> = [];
    for (const ti of visible) {
      const track = api.score.tracks[ti];
      if (!track) continue;
      for (let si = 0; si < track.staves.length; si++) {
        allStaves.push({ trackIndex: ti, staffIndex: si });
      }
    }

    const curPos = allStaves.findIndex(
      (s) => s.trackIndex === sel.trackIndex && s.staffIndex === sel.staffIndex,
    );
    if (curPos > 0) {
      const prev = allStaves[curPos - 1];
      const barIndex = Math.min(
        sel.barIndex,
        (api.score.tracks[prev.trackIndex]?.staves[prev.staffIndex]?.bars.length ?? 1) - 1,
      );
      store.setSelection({
        trackIndex: prev.trackIndex,
        staffIndex: prev.staffIndex,
        voiceIndex: 0,
        barIndex,
        beatIndex: 0,
        string: null,
      });
    }
  },
};

const navActions: NavAction[] = [
  navNextBeat,
  navPrevBeat,
  navMoveUp,
  navMoveDown,
  navNextBar,
  navPrevBar,
  navNextStaff,
  navPrevStaff,
];

for (const def of navActions) {
  actionRegistry.register(def);
}

declare global {
  interface ActionMap {
    "nav.nextBeat": { args: void; result: void };
    "nav.prevBeat": { args: void; result: void };
    "nav.moveUp": { args: void; result: void };
    "nav.moveDown": { args: void; result: void };
    "nav.nextBar": { args: void; result: void };
    "nav.prevBar": { args: void; result: void };
    "nav.nextStaff": { args: void; result: void };
    "nav.prevStaff": { args: void; result: void };
  }
}

export {};

