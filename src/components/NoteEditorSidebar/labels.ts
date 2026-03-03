import {
  AccentuationType,
  BendType,
  VibratoType,
  SlideInType,
  SlideOutType,
  HarmonicType,
  GraceType,
  PickStroke,
  BrushType,
  DynamicValue,
  CrescendoType,
  FadeType,
  WhammyType,
  GolpeType,
  WahPedal,
  TripletFeel,
  KeySignatureType,
  NoteOrnament,
  NoteAccidentalMode,
  Ottavia,
  Duration,
  FermataType,
  BendStyle,
  Fingers,
} from "@/core/schema";

/**
 * Compact label for a duration value.
 * These are standard music notation abbreviations and are NOT translated.
 */
export function durationLabel(d: Duration): string {
  switch (d) {
    case Duration.QuadrupleWhole:
      return "4W";
    case Duration.DoubleWhole:
      return "2W";
    case Duration.Whole:
      return "W";
    case Duration.Half:
      return "H";
    case Duration.Quarter:
      return "Q";
    case Duration.Eighth:
      return "8";
    case Duration.Sixteenth:
      return "16";
    case Duration.ThirtySecond:
      return "32";
    case Duration.SixtyFourth:
      return "64";
    case Duration.OneHundredTwentyEighth:
      return "128";
    case Duration.TwoHundredFiftySixth:
      return "256";
    default:
      return String(d);
  }
}

/**
 * Dynamic marking short labels — standard music notation, NOT translated.
 */
export function dynamicLabel(d: DynamicValue): string {
  const labels: Record<number, string> = {
    [DynamicValue.PPP]: "ppp",
    [DynamicValue.PP]: "pp",
    [DynamicValue.P]: "p",
    [DynamicValue.MP]: "mp",
    [DynamicValue.MF]: "mf",
    [DynamicValue.F]: "f",
    [DynamicValue.FF]: "ff",
    [DynamicValue.FFF]: "fff",
  };
  return labels[d] ?? "f";
}

/** Full descriptive name for a dynamic value — translated. */
export function dynamicTooltip(d: DynamicValue, t: (key: string) => string): string {
  const map: Record<number, string> = {
    [DynamicValue.PPP]: t("sidebar.effects.dynamicPPP"),
    [DynamicValue.PP]: t("sidebar.effects.dynamicPP"),
    [DynamicValue.P]: t("sidebar.effects.dynamicP"),
    [DynamicValue.MP]: t("sidebar.effects.dynamicMP"),
    [DynamicValue.MF]: t("sidebar.effects.dynamicMF"),
    [DynamicValue.F]: t("sidebar.effects.dynamicF"),
    [DynamicValue.FF]: t("sidebar.effects.dynamicFF"),
    [DynamicValue.FFF]: t("sidebar.effects.dynamicFFF"),
  };
  return map[d] ?? dynamicLabel(d);
}

/** Full descriptive name for a duration value — translated. */
export function durationTooltip(d: Duration, t: (key: string) => string): string {
  const map: Record<number, string> = {
    [Duration.Whole]: t("sidebar.note.durationWhole"),
    [Duration.Half]: t("sidebar.note.durationHalf"),
    [Duration.Quarter]: t("sidebar.note.durationQuarter"),
    [Duration.Eighth]: t("sidebar.note.durationEighth"),
    [Duration.Sixteenth]: t("sidebar.note.durationSixteenth"),
    [Duration.ThirtySecond]: t("sidebar.note.durationThirtySecond"),
    [Duration.SixtyFourth]: t("sidebar.note.durationSixtyFourth"),
  };
  return map[d] ?? durationLabel(d);
}

/**
 * Key signature labels — standard music notation, NOT translated.
 */
export function keySignatureLabel(key: number, type: KeySignatureType): string {
  const majorKeys = [
    "Cb", "Gb", "Db", "Ab", "Eb", "Bb", "F",
    "C",
    "G", "D", "A", "E", "B", "F#", "C#",
  ];
  const minorKeys = [
    "Ab", "Eb", "Bb", "F", "C", "G", "D",
    "A",
    "E", "B", "F#", "C#", "G#", "D#", "A#",
  ];
  const idx = key + 7;
  if (idx < 0 || idx >= 15) return "C";
  const name = type === KeySignatureType.Minor ? minorKeys[idx] : majorKeys[idx];
  return `${name}${type === KeySignatureType.Minor ? "m" : ""}`;
}

export function bendTypeLabel(bt: BendType, t: (key: string) => string): string {
  const map: Record<number, string> = {
    [BendType.None]: t("sidebar.bendTypes.none"),
    [BendType.Custom]: t("sidebar.bendTypes.custom"),
    [BendType.Bend]: t("sidebar.bendTypes.bend"),
    [BendType.Release]: t("sidebar.bendTypes.release"),
    [BendType.BendRelease]: t("sidebar.bendTypes.bendRelease"),
    [BendType.Hold]: t("sidebar.bendTypes.hold"),
    [BendType.Prebend]: t("sidebar.bendTypes.prebend"),
    [BendType.PrebendBend]: t("sidebar.bendTypes.prebendBend"),
    [BendType.PrebendRelease]: t("sidebar.bendTypes.prebendRelease"),
  };
  return map[bt] ?? String(bt);
}

export function harmonicTypeLabel(ht: HarmonicType, t: (key: string) => string): string {
  const map: Record<number, string> = {
    [HarmonicType.None]: t("sidebar.harmonicTypes.none"),
    [HarmonicType.Natural]: t("sidebar.harmonicTypes.natural"),
    [HarmonicType.Artificial]: t("sidebar.harmonicTypes.artificial"),
    [HarmonicType.Pinch]: t("sidebar.harmonicTypes.pinch"),
    [HarmonicType.Tap]: t("sidebar.harmonicTypes.tap"),
    [HarmonicType.Semi]: t("sidebar.harmonicTypes.semi"),
    [HarmonicType.Feedback]: t("sidebar.harmonicTypes.feedback"),
  };
  return map[ht] ?? String(ht);
}

export function slideOutTypeLabel(st: SlideOutType, t: (key: string) => string): string {
  const map: Record<number, string> = {
    [SlideOutType.None]: t("sidebar.slideOutTypes.none"),
    [SlideOutType.Shift]: t("sidebar.slideOutTypes.shift"),
    [SlideOutType.Legato]: t("sidebar.slideOutTypes.legato"),
    [SlideOutType.OutUp]: t("sidebar.slideOutTypes.outUp"),
    [SlideOutType.OutDown]: t("sidebar.slideOutTypes.outDown"),
    [SlideOutType.PickSlideDown]: t("sidebar.slideOutTypes.pickSlideDown"),
    [SlideOutType.PickSlideUp]: t("sidebar.slideOutTypes.pickSlideUp"),
  };
  return map[st] ?? String(st);
}

export function tripletFeelLabel(tf: TripletFeel, t: (key: string) => string): string {
  const map: Record<number, string> = {
    [TripletFeel.NoTripletFeel]: t("sidebar.tripletFeels.none"),
    [TripletFeel.Triplet8th]: t("sidebar.tripletFeels.triplet8th"),
    [TripletFeel.Triplet16th]: t("sidebar.tripletFeels.triplet16th"),
    [TripletFeel.Dotted8th]: t("sidebar.tripletFeels.dotted8th"),
    [TripletFeel.Dotted16th]: t("sidebar.tripletFeels.dotted16th"),
    [TripletFeel.Scottish8th]: t("sidebar.tripletFeels.scottish8th"),
    [TripletFeel.Scottish16th]: t("sidebar.tripletFeels.scottish16th"),
  };
  return map[tf] ?? t("sidebar.tripletFeels.none");
}

export function graceTypeLabel(g: GraceType): string {
  switch (g) {
    case GraceType.None: return "None";
    case GraceType.OnBeat: return "On Beat";
    case GraceType.BeforeBeat: return "Before Beat";
    case GraceType.BendGrace: return "Bend Grace";
    default: return String(g);
  }
}

export function pickStrokeLabel(p: PickStroke): string {
  switch (p) {
    case PickStroke.None: return "None";
    case PickStroke.Up: return "Up";
    case PickStroke.Down: return "Down";
    default: return String(p);
  }
}

export function brushTypeLabel(b: BrushType): string {
  switch (b) {
    case BrushType.None: return "None";
    case BrushType.BrushUp: return "Up";
    case BrushType.BrushDown: return "Down";
    case BrushType.ArpeggioUp: return "Arpeggio Up";
    case BrushType.ArpeggioDown: return "Arpeggio Down";
    default: return String(b);
  }
}

export function crescendoLabel(c: CrescendoType): string {
  switch (c) {
    case CrescendoType.None: return "None";
    case CrescendoType.Crescendo: return "Crescendo";
    case CrescendoType.Decrescendo: return "Decrescendo";
    default: return String(c);
  }
}

export function vibratoLabel(v: VibratoType): string {
  switch (v) {
    case VibratoType.None: return "None";
    case VibratoType.Slight: return "Slight";
    case VibratoType.Wide: return "Wide";
    default: return String(v);
  }
}

export function fadeLabel(f: FadeType): string {
  switch (f) {
    case FadeType.None: return "None";
    case FadeType.FadeIn: return "Fade In";
    case FadeType.FadeOut: return "Fade Out";
    case FadeType.VolumeSwell: return "Volume Swell";
    default: return String(f);
  }
}

export function ottavaLabel(o: Ottavia): string {
  switch (o) {
    case Ottavia.Regular: return "Regular";
    case Ottavia._8va: return "8va";
    case Ottavia._8vb: return "8vb";
    case Ottavia._15ma: return "15ma";
    case Ottavia._15mb: return "15mb";
    default: return String(o);
  }
}

export function golpeLabel(g: GolpeType): string {
  switch (g) {
    case GolpeType.None: return "None";
    case GolpeType.Finger: return "Finger";
    case GolpeType.Thumb: return "Thumb";
    default: return String(g);
  }
}

export function wahPedalLabel(w: WahPedal): string {
  switch (w) {
    case WahPedal.None: return "None";
    case WahPedal.Open: return "Open";
    case WahPedal.Closed: return "Closed";
    default: return String(w);
  }
}

export function whammyTypeLabel(w: WhammyType): string {
  switch (w) {
    case WhammyType.None: return "None";
    case WhammyType.Custom: return "Custom";
    case WhammyType.Dive: return "Dive";
    case WhammyType.Dip: return "Dip";
    case WhammyType.Hold: return "Hold";
    case WhammyType.Predive: return "Predive";
    case WhammyType.PrediveDive: return "Predive/Dive";
    default: return String(w);
  }
}

export function fermataTypeLabel(f: FermataType | null): string {
  if (f === null) return "—";
  switch (f) {
    case FermataType.Short: return "Short";
    case FermataType.Medium: return "Medium";
    case FermataType.Long: return "Long";
    default: return String(f);
  }
}

export function accentuationLabel(a: AccentuationType): string {
  switch (a) {
    case AccentuationType.None: return "None";
    case AccentuationType.Normal: return "Normal";
    case AccentuationType.Heavy: return "Heavy";
    case AccentuationType.Tenuto: return "Tenuto";
    default: return String(a);
  }
}

export function slideInLabel(s: SlideInType): string {
  switch (s) {
    case SlideInType.None: return "None";
    case SlideInType.IntoFromBelow: return "From Below";
    case SlideInType.IntoFromAbove: return "From Above";
    default: return String(s);
  }
}

export function bendStyleLabel(b: BendStyle): string {
  switch (b) {
    case BendStyle.Default: return "Default";
    case BendStyle.Gradual: return "Gradual";
    case BendStyle.Fast: return "Fast";
    default: return String(b);
  }
}

export function fingerLabel(f: Fingers): string {
  switch (f) {
    case Fingers.Unknown: return "—";
    case Fingers.Thumb: return "Thumb";
    case Fingers.IndexFinger: return "Index";
    case Fingers.MiddleFinger: return "Middle";
    case Fingers.AnnularFinger: return "Ring";
    case Fingers.LittleFinger: return "Little";
    default: return String(f);
  }
}

export function ornamentLabel(o: NoteOrnament): string {
  switch (o) {
    case NoteOrnament.None: return "None";
    case NoteOrnament.InvertedTurn: return "Inverted Turn";
    case NoteOrnament.Turn: return "Turn";
    case NoteOrnament.UpperMordent: return "Upper Mordent";
    case NoteOrnament.LowerMordent: return "Lower Mordent";
    default: return String(o);
  }
}

export function accidentalModeLabel(a: NoteAccidentalMode): string {
  switch (a) {
    case NoteAccidentalMode.Default: return "Default";
    case NoteAccidentalMode.ForceNone: return "Force None";
    case NoteAccidentalMode.ForceNatural: return "Force Natural";
    case NoteAccidentalMode.ForceSharp: return "Force Sharp";
    case NoteAccidentalMode.ForceDoubleSharp: return "Force ##";
    case NoteAccidentalMode.ForceFlat: return "Force Flat";
    case NoteAccidentalMode.ForceDoubleFlat: return "Force bb";
    default: return String(a);
  }
}

export function keySignatureTypeLabel(t: KeySignatureType): string {
  switch (t) {
    case KeySignatureType.Major: return "Major";
    case KeySignatureType.Minor: return "Minor";
    default: return String(t);
  }
}

/** Format a boolean for debug display. */
export function boolLabel(b: boolean): string {
  return b ? "true" : "false";
}
