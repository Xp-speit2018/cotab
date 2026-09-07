/**
 * @vitest-environment happy-dom
 */

import "@testing-library/jest-dom/vitest";
import "@/i18n";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DrumKitDiagram, type DrumKitZone } from "../DrumKitDiagram";

const zones: DrumKitZone[] = [
  { id: "snare", label: "Snare", midiNotes: [37, 38, 40] },
  { id: "kick", label: "Kick", midiNotes: [35, 36] },
  { id: "hi-hat", label: "Hi-hat", midiNotes: [42, 44, 46] },
  { id: "ride", label: "Ride", midiNotes: [51, 53] },
];

describe("DrumKitDiagram", () => {
  it("exposes interactive zones and their MIDI notes", () => {
    const onSelect = vi.fn();
    render(
      <DrumKitDiagram
        zones={zones}
        ariaLabel="Percussion kit"
        selectedZoneId="snare"
        activeZoneIds={["hi-hat"]}
        disabledZoneIds={["kick"]}
        showMidiNotes
        onZoneSelect={onSelect}
      />,
    );

    expect(
      screen.getByRole("group", { name: "Percussion kit" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Snare, MIDI 37, 38, 40/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /Hi-hat, MIDI 42, 44, 46/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /Kick, MIDI 35, 36/ }),
    ).toHaveAttribute("aria-disabled", "true");

    const diagram = screen.getByRole("group", { name: "Percussion kit" });
    expect(diagram.querySelectorAll("[data-hi-hat-cymbal]")).toHaveLength(2);
    expect(diagram.querySelector("[data-hi-hat-clutch]")).toBeInTheDocument();
    expect(diagram.querySelector("[data-hi-hat-cup]")).toBeInTheDocument();
    expect(diagram.querySelector("[data-hi-hat-linkage]")).toBeInTheDocument();
    expect(diagram.querySelector("[data-hi-hat-pedal]")).toBeInTheDocument();
    expect(diagram.querySelector("[data-cymbal-profile='ride']")).toBeInTheDocument();
    expect(diagram.querySelector("[data-cymbal-bell]")).toBeInTheDocument();
    expect(diagram.querySelector("[data-snare-mechanism]")).toBeInTheDocument();
    expect(diagram.querySelectorAll("[data-drum-lug]")).toHaveLength(2);
    expect(diagram.querySelectorAll("[data-bass-drum-lug]")).toHaveLength(9);
    expect(diagram.querySelector("[data-bass-drum-port]")).toBeInTheDocument();
    expect(diagram.querySelector("linearGradient, radialGradient")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Snare/ }));
    expect(onSelect).toHaveBeenCalledWith("snare");

    fireEvent.keyDown(screen.getByRole("button", { name: /Hi-hat/ }), {
      key: "Enter",
    });
    expect(onSelect).toHaveBeenCalledWith("hi-hat");

    fireEvent.click(screen.getByRole("button", { name: /Kick/ }));
    expect(onSelect).not.toHaveBeenCalledWith("kick");
  });
});
