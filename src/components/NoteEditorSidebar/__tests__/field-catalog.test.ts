import { describe, expect, it } from "vitest";
import {
  INSPECTOR_FIELD_CATALOG,
  inspectorFieldsByStatus,
} from "../field-catalog";

describe("inspector field catalog", () => {
  it("classifies every retained model and nested value shape", () => {
    expect(Object.keys(INSPECTOR_FIELD_CATALOG)).toEqual([
      "bendPoint",
      "fermata",
      "section",
      "automation",
      "chord",
      "color",
      "instrumentArticulation",
      "lyrics",
      "playbackInformation",
      "tremoloPicking",
      "tuning",
      "note",
      "beat",
      "voice",
      "bar",
      "masterBar",
      "staff",
      "track",
      "score",
    ]);
  });

  it("never exposes internal representation through an interactive surface", () => {
    const policies = Object.values(INSPECTOR_FIELD_CATALOG)
      .flatMap((fields) => Object.values(fields));
    for (const policy of policies) {
      if (policy.status === "internal") {
        expect(policy.surface).toBe("hidden");
      }
      if (policy.status === "external") {
        expect(policy.surface).toBe("external");
      }
    }
  });

  it("records known semantic editors instead of raw scalar controls", () => {
    expect(INSPECTOR_FIELD_CATALOG.masterBar.alternateEndings).toMatchObject({
      surface: "popover",
      editor: "alternate-endings",
    });
    expect(INSPECTOR_FIELD_CATALOG.track.playbackInfo).toMatchObject({
      surface: "dialog",
      editor: "instrument",
    });
    expect(INSPECTOR_FIELD_CATALOG.beat.chordId).toMatchObject({
      surface: "resource",
      editor: "chord-picker",
    });
    expect(INSPECTOR_FIELD_CATALOG.note.bendPoints).toMatchObject({
      surface: "popover",
      editor: "bend-curve",
    });
  });

  it("has no partially implemented field UX", () => {
    expect(inspectorFieldsByStatus("partial")).toEqual([]);
    expect(inspectorFieldsByStatus("missing").length).toBeGreaterThan(0);
  });

  it("keeps playback-unsupported roundtrip fields out of the UX backlog", () => {
    expect(inspectorFieldsByStatus("roundtrip").map(({ model, field }) =>
      `${model}.${field}`)).toEqual([
      "note.durationPercent",
      "masterBar.fermata",
    ]);
  });
});
