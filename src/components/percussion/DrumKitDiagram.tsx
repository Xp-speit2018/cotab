import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type DrumKitZoneId =
  | "crash-left"
  | "crash-right"
  | "ride"
  | "hi-hat"
  | "tom-high"
  | "tom-mid"
  | "snare"
  | "kick"
  | "floor-tom";

export interface DrumKitZone {
  id: DrumKitZoneId;
  label: string;
  midiNotes: readonly number[];
  shortcut?: string;
}

export interface DrumKitDiagramProps {
  zones: readonly DrumKitZone[];
  ariaLabel: string;
  selectedZoneId?: DrumKitZoneId | null;
  activeZoneIds?: readonly DrumKitZoneId[];
  disabledZoneIds?: readonly DrumKitZoneId[];
  showMidiNotes?: boolean;
  className?: string;
  onZoneSelect?: (zoneId: DrumKitZoneId) => void;
}

type ZoneVisualProps = {
  zone: DrumKitZone;
  selected: boolean;
  active: boolean;
  disabled: boolean;
  showMidiNotes: boolean;
  onSelect?: (zoneId: DrumKitZoneId) => void;
  children: React.ReactNode;
};

const LABEL_POSITIONS: Record<DrumKitZoneId, { x: number; y: number }> = {
  "crash-left": { x: 108, y: 61 },
  "crash-right": { x: 393, y: 61 },
  ride: { x: 437, y: 148 },
  "hi-hat": { x: 38, y: 139 },
  "tom-high": { x: 190, y: 168 },
  "tom-mid": { x: 299, y: 168 },
  snare: { x: 126, y: 286 },
  kick: { x: 259, y: 329 },
  "floor-tom": { x: 401, y: 285 },
};

function ZoneVisual({
  zone,
  selected,
  active,
  disabled,
  showMidiNotes,
  onSelect,
  children,
}: ZoneVisualProps) {
  const { t } = useTranslation();
  const label = LABEL_POSITIONS[zone.id];
  const stateLabel = [selected && t("drumKit.selected"), active && t("drumKit.sounding")].filter(Boolean).join(", ");

  return (
    <g
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-pressed={selected || active}
      aria-label={`${zone.label}, MIDI ${zone.midiNotes.join(", ")}${stateLabel ? `, ${stateLabel}` : ""}`}
      data-drum-zone={zone.id}
      data-selected={selected || undefined}
      data-active={active || undefined}
      data-disabled={disabled || undefined}
      className={cn(
        "group cursor-default outline-none transition-opacity",
        disabled && "cursor-not-allowed opacity-30",
      )}
      onClick={() => {
        if (!disabled) onSelect?.(zone.id);
      }}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect?.(zone.id);
        }
      }}
    >
      <title>{`${zone.label} · MIDI ${zone.midiNotes.join(", ")}`}</title>
      <g className="transition-opacity group-hover:opacity-75">{children}</g>
      <ellipse
        cx={label.x}
        cy={label.y - 4}
        rx="42"
        ry="22"
        fill="none"
        stroke="var(--foreground)"
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray={active && !selected ? "4 3" : undefined}
        className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-50 group-focus-visible:opacity-100"
      />
      {selected && (
        <rect
          x={label.x - 34}
          y={label.y - 13}
          width="68"
          height="18"
          rx="9"
          fill="var(--background)"
          stroke="var(--foreground)"
          strokeWidth="2"
          data-zone-selection-pill
        />
      )}
      {active && (
        <g
          fill="none"
          stroke="var(--foreground)"
          strokeWidth="1.5"
          strokeLinecap="round"
          data-zone-state-indicator
        >
          <path d={`M ${label.x + 29} ${label.y - 17} v -7`} />
          <path d={`M ${label.x + 33} ${label.y - 15} l 5 -5`} />
          <path d={`M ${label.x + 25} ${label.y - 15} l -5 -5`} />
        </g>
      )}
      <text
        x={label.x}
        y={label.y}
        textAnchor="middle"
        className="pointer-events-none select-none fill-foreground text-[11px] font-semibold"
      >
        {zone.label}
      </text>
      {showMidiNotes && (
        <text
          x={label.x}
          y={label.y + 13}
          textAnchor="middle"
          className="pointer-events-none select-none fill-muted-foreground font-mono text-[8px]"
        >
          MIDI {zone.midiNotes.join("/")}
          {zone.shortcut ? ` · ${zone.shortcut}` : ""}
        </text>
      )}
    </g>
  );
}

function Cymbal({
  cx,
  cy,
  rx,
  ry,
  kind = "crash",
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  kind?: "crash" | "ride";
}) {
  const bellRx = rx * (kind === "ride" ? 0.22 : 0.16);
  const bellRy = Math.max(4, ry * (kind === "ride" ? 0.3 : 0.24));

  return (
    <g
      data-cymbal-profile={kind}
      fill="var(--background)"
      stroke="var(--foreground)"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d={`M ${cx - rx} ${cy} Q ${cx - rx * 0.58} ${cy - ry * 0.48} ${cx - bellRx} ${cy - bellRy * 0.45} Q ${cx} ${cy - bellRy * 1.35} ${cx + bellRx} ${cy - bellRy * 0.45} Q ${cx + rx * 0.58} ${cy - ry * 0.48} ${cx + rx} ${cy} Q ${cx + rx * 0.58} ${cy + ry * 0.75} ${cx} ${cy + ry} Q ${cx - rx * 0.58} ${cy + ry * 0.75} ${cx - rx} ${cy} Z`}
        strokeWidth="2"
      />
      <ellipse
        cx={cx}
        cy={cy + ry * 0.12}
        rx={rx * 0.78}
        ry={ry * 0.62}
        fill="none"
        strokeWidth="0.8"
        opacity="0.38"
      />
      <ellipse
        data-cymbal-bell
        cx={cx}
        cy={cy - bellRy * 0.2}
        rx={bellRx}
        ry={bellRy}
        fill="none"
        strokeWidth="1.35"
      />
      <ellipse
        cx={cx}
        cy={cy + ry * 0.18}
        rx={rx * 0.48}
        ry={ry * 0.38}
        fill="none"
        strokeWidth="0.7"
        opacity="0.3"
      />
      <path
        data-cymbal-groove
        d={`M ${cx - rx * 0.9} ${cy + ry * 0.15} Q ${cx - rx * 0.55} ${cy + ry * 0.72} ${cx - rx * 0.12} ${cy + ry * 0.78} M ${cx + rx * 0.12} ${cy + ry * 0.78} Q ${cx + rx * 0.55} ${cy + ry * 0.72} ${cx + rx * 0.9} ${cy + ry * 0.15}`}
        fill="none"
        strokeWidth="0.8"
        opacity="0.45"
      />
      <circle cx={cx} cy={cy - bellRy * 0.35} r="2.2" fill="var(--foreground)" stroke="none" />
      <path d={`M ${cx} ${cy - bellRy * 0.35} V ${cy - ry - 7}`} fill="none" strokeWidth="1.5" />
      <path d={`M ${cx - 5} ${cy - ry - 5} H ${cx + 5}`} fill="none" strokeWidth="1.5" />
    </g>
  );
}

function Drum({
  cx,
  cy,
  rx,
  ry,
  depth,
  kind = "tom",
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  depth: number;
  kind?: "tom" | "snare" | "floor";
}) {
  const lugInset = rx * 0.7;
  const lugY = cy + Math.max(8, depth * 0.48);

  return (
    <g
      data-drum-shell={kind}
      fill="var(--background)"
      stroke="var(--foreground)"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d={`M ${cx - rx} ${cy} L ${cx - rx} ${cy + depth} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy + depth} L ${cx + rx} ${cy} Z`}
        strokeWidth="1.75"
      />
      <ellipse
        cx={cx}
        cy={cy + depth}
        rx={rx}
        ry={ry}
        fill="none"
        strokeWidth="1.75"
      />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} strokeWidth="2.5" data-drum-hoop />
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx - 5}
        ry={Math.max(ry - 4, 5)}
        fill="none"
        strokeWidth="1"
        opacity="0.5"
      />
      <path
        d={`M ${cx - rx * 0.65} ${cy - ry * 0.45} Q ${cx} ${cy - ry * 0.8} ${cx + rx * 0.5} ${cy - ry * 0.35} M ${cx - rx + 2} ${cy + depth * 0.65} Q ${cx} ${cy + depth + ry * 0.48} ${cx + rx - 2} ${cy + depth * 0.65}`}
        fill="none"
        strokeWidth="1"
        opacity="0.35"
      />
      {[-lugInset, lugInset].map((offset) => (
        <g key={offset} data-drum-lug>
          <rect
            x={cx + offset - 3}
            y={lugY - 5}
            width="6"
            height="10"
            rx="1.5"
            strokeWidth="1.25"
          />
          <path
            d={`M ${cx + offset} ${cy + ry * 0.72} V ${lugY - 5} M ${cx + offset} ${lugY + 5} V ${cy + depth + ry * 0.55}`}
            fill="none"
            strokeWidth="1"
          />
        </g>
      ))}
      <path
        d={`M ${cx - rx + 4} ${cy + 5} Q ${cx} ${cy + ry * 1.35} ${cx + rx - 4} ${cy + 5}`}
        fill="none"
        strokeWidth="0.8"
        opacity="0.25"
      />
      {kind === "tom" && (
        <g data-tom-mount>
          <rect x={cx - 8} y={cy + depth - 2} width="16" height="9" rx="2" strokeWidth="1.25" />
          <path d={`M ${cx} ${cy + depth + 7} V ${cy + depth + 16}`} fill="none" strokeWidth="2" />
        </g>
      )}
      {kind === "snare" && (
        <g data-snare-mechanism>
          <path
            d={`M ${cx - rx * 0.82} ${cy + depth * 0.35} Q ${cx} ${cy + depth + ry * 0.65} ${cx + rx * 0.82} ${cy + depth * 0.35}`}
            fill="none"
            strokeWidth="1"
            strokeDasharray="3 2"
          />
          <path d={`M ${cx - rx - 3} ${cy + 8} h -7 v 18 h 9`} fill="none" strokeWidth="1.5" />
          <circle cx={cx - rx - 10} cy={cy + 15} r="2" strokeWidth="1" />
        </g>
      )}
      {kind === "floor" && (
        <g data-floor-tom-legs fill="none" strokeWidth="2.5">
          <path d={`M ${cx - rx * 0.72} ${cy + depth * 0.72} L ${cx - rx * 0.86} ${cy + depth + 64}`} />
          <path d={`M ${cx + rx * 0.72} ${cy + depth * 0.72} L ${cx + rx * 0.86} ${cy + depth + 64}`} />
          <rect x={cx - rx * 0.72 - 4} y={cy + depth * 0.66 - 3} width="8" height="10" rx="2" fill="var(--background)" strokeWidth="1.25" />
          <rect x={cx + rx * 0.72 - 4} y={cy + depth * 0.66 - 3} width="8" height="10" rx="2" fill="var(--background)" strokeWidth="1.25" />
          <path d={`M ${cx - rx * 0.86 - 5} ${cy + depth + 64} h 10 M ${cx + rx * 0.86 - 5} ${cy + depth + 64} h 10`} strokeWidth="2" />
        </g>
      )}
    </g>
  );
}

function CymbalStand({ cx, topY, hubY }: { cx: number; topY: number; hubY: number }) {
  return (
    <g data-cymbal-stand fill="var(--background)" stroke="var(--foreground)" strokeLinecap="round" strokeLinejoin="round">
      <path d={`M ${cx} ${topY} V ${hubY}`} fill="none" strokeWidth="2" />
      <path d={`M ${cx - 4} ${topY + 3} H ${cx + 4} M ${cx - 6} ${topY + 8} H ${cx + 6}`} fill="none" strokeWidth="1.25" />
      <rect x={cx - 7} y={hubY - 43} width="14" height="8" rx="2" strokeWidth="1.25" />
      <path d={`M ${cx + 7} ${hubY - 39} h 7 M ${cx + 11} ${hubY - 42} v 6`} fill="none" strokeWidth="1" />
      <path d={`M ${cx - 7} ${hubY - 4} H ${cx + 7} L ${cx + 10} ${hubY + 5} H ${cx - 10} Z`} strokeWidth="1.5" />
      <path d={`M ${cx - 7} ${hubY + 4} L ${cx - 37} ${hubY + 52} M ${cx - 2} ${hubY + 6} L ${cx - 29} ${hubY + 55}`} fill="none" strokeWidth="1.75" />
      <path d={`M ${cx + 7} ${hubY + 4} L ${cx + 37} ${hubY + 52} M ${cx + 2} ${hubY + 6} L ${cx + 29} ${hubY + 55}`} fill="none" strokeWidth="1.75" />
      <path d={`M ${cx - 42} ${hubY + 53} h 12 M ${cx + 30} ${hubY + 53} h 12`} fill="none" strokeWidth="2" />
    </g>
  );
}

function BassDrum() {
  const lugs = [
    [259, 222],
    [219, 234],
    [193, 272],
    [193, 326],
    [219, 366],
    [299, 366],
    [325, 326],
    [325, 272],
    [299, 234],
  ] as const;

  return (
    <g data-bass-drum fill="var(--background)" stroke="var(--foreground)" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="259" cy="298" rx="73" ry="82" strokeWidth="3" data-drum-hoop />
      <ellipse cx="259" cy="298" rx="66" ry="74" fill="none" strokeWidth="1.5" />
      <ellipse cx="259" cy="298" rx="61" ry="69" fill="none" strokeWidth="0.8" opacity="0.35" />
      {lugs.map(([x, y]) => (
        <g key={`${x}-${y}`} data-bass-drum-lug>
          <circle cx={x} cy={y} r="3.2" strokeWidth="1.2" />
          <path d={`M ${x} ${y - 5} v 10`} fill="none" strokeWidth="0.8" />
        </g>
      ))}
      <circle cx="232" cy="326" r="12" fill="none" strokeWidth="2" data-bass-drum-port />
      <circle cx="232" cy="326" r="9" fill="none" strokeWidth="0.8" opacity="0.4" />
      <path d="M199 354 L181 393 M319 354 L337 393" fill="none" strokeWidth="3" />
      <path d="M176 394 h 14 M330 394 h 14" fill="none" strokeWidth="2.5" />
      <path d="M259 375 V397 M241 401 H277" fill="none" strokeWidth="1.5" opacity="0.5" />
    </g>
  );
}

function HiHat() {
  return (
    <g
      data-hi-hat-assembly
      fill="var(--background)"
      stroke="var(--foreground)"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Pull rod, clutch screw, and clutch body. */}
      <path d="M75 128 V275" fill="none" strokeWidth="1.5" />
      <path d="M75 132 V123 M68 126 H82" fill="none" strokeWidth="1.5" />
      <circle cx="75" cy="126" r="2.5" strokeWidth="1.25" />
      <path
        data-hi-hat-clutch
        d="M68 139 H82 L80 151 H70 Z"
        strokeWidth="1.5"
      />
      <path d="M65 143 H85 M68 147 H82" fill="none" strokeWidth="1" />
      <path d="M67 151 Q75 155 83 151" fill="none" strokeWidth="1.5" />

      {/* Profiled cymbals: top cymbal is pulled by the clutch; bottom rests on the cup. */}
      <path
        data-hi-hat-cymbal
        d="M21 170 Q52 166 69 157 Q75 153 81 157 Q98 166 129 170 Q103 176 75 177 Q47 176 21 170 Z"
        strokeWidth="2"
      />
      <path
        d="M27 170 Q50 173 75 173 Q101 173 123 170"
        fill="none"
        strokeWidth="0.9"
        opacity="0.55"
      />
      <path
        data-hi-hat-cymbal
        d="M25 183 Q49 179 69 177 Q75 176 81 177 Q103 180 125 184 Q101 192 74 192 Q47 191 25 183 Z"
        strokeWidth="2"
      />
      <path
        d="M32 184 Q52 188 74 188 Q98 188 118 184"
        fill="none"
        strokeWidth="0.9"
        opacity="0.55"
      />

      {/* Felt seat, tilting cup, upper tube, and height memory lock. */}
      <path
        data-hi-hat-cup
        d="M65 194 Q75 199 85 194 L82 201 H68 Z"
        strokeWidth="1.5"
      />
      <path d="M63 201 H87 L83 207 H67 Z" strokeWidth="1.5" />
      <circle cx="90" cy="202" r="2.5" strokeWidth="1" />
      <path d="M70 207 V244 M80 207 V244" fill="none" strokeWidth="2" />
      <path d="M66 215 H84 V222 H66 Z" strokeWidth="1.5" />
      <path d="M84 218 H91 M88 215 V221" fill="none" strokeWidth="1.25" />

      {/* Base casting and double-braced tripod. */}
      <path d="M65 240 H85 L89 251 Q75 258 61 251 Z" strokeWidth="1.75" />
      <circle cx="75" cy="249" r="3" fill="var(--foreground)" stroke="none" />
      <path d="M65 251 L31 292 M69 254 L38 294" fill="none" strokeWidth="2" />
      <path d="M85 251 L108 290 M81 254 L101 293" fill="none" strokeWidth="2" />
      <path d="M72 254 L77 287 M78 254 L84 287" fill="none" strokeWidth="1.5" opacity="0.55" />
      <path d="M26 292 Q35 289 43 294 M98 293 Q106 288 113 291" fill="none" strokeWidth="2.5" />

      {/* Drive linkage, heel hinge, and treaded footboard. */}
      <path
        data-hi-hat-linkage
        d="M62 248 Q54 266 48 291"
        fill="none"
        strokeWidth="1.25"
        strokeDasharray="2 2"
      />
      <circle cx="47" cy="294" r="3" strokeWidth="1.5" />
      <path data-hi-hat-pedal d="M16 312 L29 284 L52 287 L63 312 Z" strokeWidth="2" />
      <path d="M23 307 L32 290 L50 292 L55 307 Z" fill="none" strokeWidth="1" opacity="0.55" />
      <path d="M29 298 H53 M26 304 H56" fill="none" strokeWidth="0.8" opacity="0.55" />
      <path d="M14 313 H65 M17 313 V318 H29" fill="none" strokeWidth="1.75" />
    </g>
  );
}

export function DrumKitDiagram({
  zones,
  ariaLabel,
  selectedZoneId = null,
  activeZoneIds = [],
  disabledZoneIds = [],
  showMidiNotes = false,
  className,
  onZoneSelect,
}: DrumKitDiagramProps) {
  const zoneMap = new Map(zones.map((zone) => [zone.id, zone]));
  const active = new Set(activeZoneIds);
  const disabled = new Set(disabledZoneIds);

  const renderZone = (id: DrumKitZoneId, visual: React.ReactNode) => {
    const zone = zoneMap.get(id);
    if (!zone) return null;
    return (
      <ZoneVisual
        key={id}
        zone={zone}
        selected={selectedZoneId === id}
        active={active.has(id)}
        disabled={disabled.has(id)}
        showMidiNotes={showMidiNotes}
        onSelect={onZoneSelect}
      >
        {visual}
      </ZoneVisual>
    );
  };

  return (
    <svg
      viewBox="0 0 520 410"
      role="group"
      aria-label={ariaLabel}
      data-drum-kit-diagram
      className={cn("block h-auto w-full overflow-visible", className)}
    >
      <g data-drum-hardware opacity="0.52">
        <CymbalStand cx={108} topY={73} hubY={184} />
        <CymbalStand cx={393} topY={73} hubY={184} />
        <CymbalStand cx={437} topY={164} hubY={234} />
        <g
          data-tom-holder
          fill="var(--background)"
          stroke="var(--foreground)"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M259 229 V211 M259 214 L190 196 M259 214 L299 198" fill="none" strokeWidth="2.5" />
          <circle cx="259" cy="214" r="6" strokeWidth="1.5" />
          <rect x="184" y="191" width="12" height="8" rx="2" strokeWidth="1.25" />
          <rect x="293" y="193" width="12" height="8" rx="2" strokeWidth="1.25" />
        </g>
      </g>

      {renderZone("crash-left", <Cymbal cx={108} cy={56} rx={76} ry={22} />)}
      {renderZone("crash-right", <Cymbal cx={393} cy={56} rx={76} ry={22} />)}
      {renderZone("ride", <Cymbal cx={437} cy={143} rx={62} ry={31} kind="ride" />)}
      {renderZone("hi-hat", <HiHat />)}
      {renderZone(
        "tom-high",
        <Drum cx={190} cy={155} rx={43} ry={28} depth={25} />,
      )}
      {renderZone(
        "tom-mid",
        <Drum cx={299} cy={155} rx={46} ry={30} depth={27} />,
      )}
      {renderZone(
        "snare",
        <Drum cx={126} cy={272} rx={59} ry={34} depth={24} kind="snare" />,
      )}
      {renderZone("kick", <BassDrum />)}
      {renderZone(
        "floor-tom",
        <Drum cx={401} cy={267} rx={62} ry={39} depth={46} kind="floor" />,
      )}
    </svg>
  );
}
