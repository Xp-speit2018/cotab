import type * as alphaTab from "@coderline/alphatab";

import { getApi, setPendingSelection } from "./player-api";
import type { PendingSelection, PercSnapGroup, SnapGrid } from "./player-types";
import {
  applyBarWarningStyles,
  createTrackFromPreset,
  extractBarInfo,
  extractStaffInfo,
  extractTrackInfo,
  extractVoiceInfo,
  formatPitch,
  getTrack,
  insertBarAtIndex,
  isBarEmptyAllTracks,
  resolveBeat,
} from "./player-helpers";
import {
  ALPHATAB_PERCUSSION_DEFS,
  DRUM_STAFFLINE_DEFAULTS,
  PERC_SNAP_GROUPS,
  ESSENTIAL_ARTICULATION_GROUPS,
  ESSENTIAL_GP7_IDS,
  GP7_ARTICULATION_MAP,
  GP7_DEF_BY_ID,
  GP7_STAFF_LINE_MAP,
  gp7IdToPercussionArticulation,
  resolveGp7Id,
} from "./percussion-data";
import {
  getSnapGrids,
  updateSnapGridOverlay,
} from "./snap-grid";
import { QUARTER_TICKS, SCORE_FIELD_TO_STATE, TRACK_PRESETS } from "./player-types";
import { snapPositionToPitch } from "./player-helpers";

export type { alphaTab };

export type { PendingSelection, PercSnapGroup, SnapGrid };

export {
  // core API access
  getApi,
  setPendingSelection,
  getTrack,
  resolveBeat,
  getSnapGrids,
  updateSnapGridOverlay,
  // types / constants
  QUARTER_TICKS,
  TRACK_PRESETS,
  SCORE_FIELD_TO_STATE,
  // helpers
  applyBarWarningStyles,
  createTrackFromPreset,
  insertBarAtIndex,
  isBarEmptyAllTracks,
  extractTrackInfo,
  extractStaffInfo,
  extractVoiceInfo,
  extractBarInfo,
  formatPitch,
  snapPositionToPitch,
  // percussion data
  ALPHATAB_PERCUSSION_DEFS,
  DRUM_STAFFLINE_DEFAULTS,
  GP7_DEF_BY_ID,
  GP7_ARTICULATION_MAP,
  GP7_STAFF_LINE_MAP,
  ESSENTIAL_GP7_IDS,
  ESSENTIAL_ARTICULATION_GROUPS,
  PERC_SNAP_GROUPS,
  gp7IdToPercussionArticulation,
  resolveGp7Id,
};

