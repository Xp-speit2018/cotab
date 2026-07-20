import * as z from "zod";
import { AutomationType } from "@/core/schema";
import { actionArgs } from "./definition";

export const finiteNumber = z.number().finite();
export const integer = z.number().int();
export const nonNegativeInteger = integer.min(0);
export const positiveInteger = integer.min(1);

export const bendPointSchema = z.strictObject({
  offset: finiteNumber.min(0).max(60),
  value: finiteNumber.min(-12).max(12),
});

export const bendPointListSchema = z.array(bendPointSchema)
  .min(2)
  .max(16)
  .superRefine((points, context) => {
    for (let index = 1; index < points.length; index++) {
      if (points[index].offset < points[index - 1].offset) {
        context.addIssue({
          code: "custom",
          path: [index, "offset"],
          message: "Bend point offsets must be ordered",
        });
      }
    }
  })
  .describe("Ordered pitch-curve points; offsets use 0-60 note-relative units and values use quarter tones");

export const sectionSchema = z.strictObject({
  text: z.string(),
  marker: z.string(),
});

const beatAutomationMetadata = {
  isLinear: z.boolean(),
  ratioPosition: finiteNumber.min(0).max(1)
    .describe("Position within the master bar retained for alphaTab round trips"),
  text: z.string(),
  isVisible: z.boolean(),
};

export const beatAutomationSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...beatAutomationMetadata,
    type: z.literal(AutomationType.Volume),
    value: finiteNumber.min(0).max(16)
      .describe("Playback volume in alphaTab's 0-16 channel range"),
  }),
  z.strictObject({
    ...beatAutomationMetadata,
    type: z.literal(AutomationType.Instrument),
    value: integer.min(0).max(127)
      .describe("General MIDI program number"),
  }),
  z.strictObject({
    ...beatAutomationMetadata,
    type: z.literal(AutomationType.Balance),
    value: finiteNumber.min(0).max(16)
      .describe("Playback pan in alphaTab's 0-16 channel range"),
  }),
  z.strictObject({
    ...beatAutomationMetadata,
    type: z.literal(AutomationType.Bank),
    value: integer.min(0).max(16383)
      .describe("MIDI bank number"),
  }),
]);

export const beatAutomationListSchema = z.array(beatAutomationSchema)
  .max(4)
  .superRefine((automations, context) => {
    const seen = new Set<AutomationType>();
    for (let index = 0; index < automations.length; index++) {
      const type = automations[index].type;
      if (seen.has(type)) {
        context.addIssue({
          code: "custom",
          path: [index, "type"],
          message: "Beat automation types must be unique",
        });
      }
      seen.add(type);
    }
  })
  .describe("Unique playback parameter changes applied at the selected beat");

export const tempoAutomationSchema = z.strictObject({
  isLinear: z.boolean()
    .describe("Whether the tempo transition is marked as linear"),
  type: z.literal(AutomationType.Tempo),
  value: finiteNumber.positive().describe("Tempo in beats per minute"),
  ratioPosition: finiteNumber.min(0).max(1)
    .describe("Position within the master bar, from 0 at the start to 1 at the end"),
  text: z.string().describe("Optional tempo expression shown before the BPM"),
  isVisible: z.boolean().describe("Whether alphaTab renders the tempo marker"),
});

export const tempoAutomationListSchema = z.array(tempoAutomationSchema)
  .superRefine((automations, context) => {
    for (let index = 1; index < automations.length; index++) {
      if (automations[index].ratioPosition <= automations[index - 1].ratioPosition) {
        context.addIssue({
          code: "custom",
          path: [index, "ratioPosition"],
          message: "Tempo automation positions must be strictly increasing",
        });
      }
    }
  })
  .describe("Tempo changes ordered by their position within the master bar");

export const percussionMappingSchema = z.strictObject({
  articulationIndex: nonNegativeInteger.describe(
    "Index in the track percussion articulation list",
  ),
  outputMidiNumber: integer.min(0).max(127)
    .describe("MIDI percussion note produced during playback"),
});

export const percussionMappingListSchema = z.array(percussionMappingSchema)
  .superRefine((mappings, context) => {
    const seen = new Set<number>();
    for (let index = 0; index < mappings.length; index++) {
      if (seen.has(mappings[index].articulationIndex)) {
        context.addIssue({
          code: "custom",
          path: [index, "articulationIndex"],
          message: "Percussion articulation indices must be unique",
        });
      }
      seen.add(mappings[index].articulationIndex);
    }
  });

export const chordSchema = z.strictObject({
  name: z.string(),
  firstFret: integer,
  strings: z.array(integer),
  barreFrets: z.array(integer),
  showName: z.boolean(),
  showDiagram: z.boolean(),
  showFingering: z.boolean(),
});

export const tuningSchema = z.strictObject({
  isStandard: z.boolean(),
  name: z.string(),
  tunings: z.array(integer),
});

export const tremoloPickingSchema = z.strictObject({
  marks: integer,
  style: integer,
});

export const valueNumberArgs = actionArgs({ value: finiteNumber });
export const valueIntegerArgs = actionArgs({ value: integer });
export const valueBooleanArgs = actionArgs({ value: z.boolean() });
export const valueStringArgs = actionArgs({ value: z.string() });
