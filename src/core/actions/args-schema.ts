import * as z from "zod";
import { actionArgs } from "./definition";

export const finiteNumber = z.number().finite();
export const integer = z.number().int();
export const nonNegativeInteger = integer.min(0);

export const bendPointSchema = z.strictObject({
  offset: finiteNumber,
  value: finiteNumber,
});

export const sectionSchema = z.strictObject({
  text: z.string(),
  marker: z.string(),
});

export const automationSchema = z.strictObject({
  isLinear: z.boolean(),
  type: integer,
  value: finiteNumber,
  ratioPosition: finiteNumber,
  text: z.string(),
  isVisible: z.boolean(),
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
