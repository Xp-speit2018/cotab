import type * as alphaTab from "@coderline/alphatab";

import {
  applyBarWarningStyles,
  createTrackFromPreset,
  DRUM_STAFFLINE_DEFAULTS,
  extractBarInfo,
  extractStaffInfo,
  extractTrackInfo,
  extractVoiceInfo,
  formatPitch,
  getApi,
  getSnapGrids,
  getTrack,
  gp7IdToPercussionArticulation,
  GP7_STAFF_LINE_MAP,
  insertBarAtIndex,
  isBarEmptyAllTracks,
  PendingSelection,
  resolveBeat,
  resolveGp7Id,
  SCORE_FIELD_TO_STATE,
  setPendingSelection,
  snapPositionToPitch,
  SnapGrid,
  TRACK_PRESETS,
  updateSnapGridOverlay,
} from "./player-store";

export type { alphaTab };

export type { PendingSelection, SnapGrid };

export {
  applyBarWarningStyles,
  createTrackFromPreset,
  DRUM_STAFFLINE_DEFAULTS,
  extractBarInfo,
  extractStaffInfo,
  extractTrackInfo,
  extractVoiceInfo,
  formatPitch,
  getApi,
  getSnapGrids,
  getTrack,
  gp7IdToPercussionArticulation,
  GP7_STAFF_LINE_MAP,
  insertBarAtIndex,
  isBarEmptyAllTracks,
  resolveBeat,
  resolveGp7Id,
  SCORE_FIELD_TO_STATE,
  setPendingSelection,
  snapPositionToPitch,
  TRACK_PRESETS,
  updateSnapGridOverlay,
};

