import { cn } from "@/lib/utils";

// SMuFL code points rendered with the Bravura font bundled for alphaTab.
export const musicGlyphs = {
  repeatStart: "\uE040",
  repeatEnd: "\uE041",
  gClef: "\uE050",
  tabClef6: "\uE06D",
  noteWhole: "\uE1D2",
  noteHalf: "\uE1D3",
  noteQuarter: "\uE1D5",
  noteEighth: "\uE1D7",
  noteSixteenth: "\uE1D9",
  noteThirtySecond: "\uE1DB",
  noteSixtyFourth: "\uE1DD",
  noteheadBlack: "\uE0A4",
  noteheadSlash: "\uE100",
  restWhole: "\uE4E3",
  restHalf: "\uE4E4",
  restQuarter: "\uE4E5",
  restEighth: "\uE4E6",
  restSixteenth: "\uE4E7",
  restThirtySecond: "\uE4E8",
  restSixtyFourth: "\uE4E9",
  accidentalSharp: "\uE262",
  accent: "\uE4A0",
  staccato: "\uE4A2",
  tenuto: "\uE4A4",
  marcato: "\uE4AC",
  laissezVibrer: "\uE4BA",
  dynamicPpp: "\uE52A",
  dynamicPp: "\uE52B",
  dynamicP: "\uE520",
  dynamicMp: "\uE52C",
  dynamicMf: "\uE52D",
  dynamicF: "\uE522",
  dynamicFf: "\uE52F",
  dynamicFff: "\uE530",
  crescendo: "\uE53E",
  decrescendo: "\uE53F",
  graceNote: "\uE560",
  trill: "\uE566",
  ornamentTurn: "\uE567",
  pickStrokeDown: "\uE610",
  pickStrokeUp: "\uE612",
  harmonic: "\uE614",
  brushUp: "\uE846",
  brushDown: "\uE847",
  tremoloPicking: "\uE222",
  vibrato: "\uEAB2\uEAB2",
  leftHandTap: "\uE840",
  whammyDip: "\uE831",
  fadeIn: "\uE843",
  fadeOut: "\uE844",
  volumeSwell: "\uE845",
  wahOpen: "\uE83D",
  wahClosed: "\uE83F",
  tuplet3: "\uE883",
} as const;

export function MusicGlyph({
  glyph,
  className,
}: {
  glyph: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-music-glyph={Array.from(glyph)
        .map((character) => character.codePointAt(0)?.toString(16).toUpperCase())
        .join("-")}
      className={cn(
        "music-glyph inline-flex h-4 min-w-4 items-center justify-center text-[18px] leading-none",
        className,
      )}
    >
      {glyph}
    </span>
  );
}

export function SlideTechniqueIcon({ direction }: { direction: "in" | "out" }) {
  return (
    <span
      aria-hidden="true"
      data-notation-icon={`slide-${direction}`}
      className="inline-flex h-4 w-4 items-center justify-center gap-px text-[10px] font-semibold leading-none"
    >
      {direction === "in" && <span>/</span>}
      <MusicGlyph
        glyph={musicGlyphs.noteheadBlack}
        className="h-3 min-w-2 text-[12px]"
      />
      {direction === "out" && <span>/</span>}
    </span>
  );
}

export function TimeSignatureIcon({
  numerator,
  denominator,
}: {
  numerator: number;
  denominator: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="flex h-4 min-w-4 flex-col items-center justify-center text-[8px] font-bold leading-[7px] tabular-nums"
    >
      <span>{numerator}</span>
      <span>{denominator}</span>
    </span>
  );
}
