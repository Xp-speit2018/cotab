# AlphaTab `beat.isEmpty` Rendering Behaviour

## Overview

AlphaTab's `Beat.isEmpty` flag controls whether a beat is treated as a
placeholder (no real musical content) or as actual content. However, the
**visual effect** of this flag differs between standard-notation staves and
percussion staves.

## Model semantics

| Property | Meaning |
|----------|---------|
| `beat.isEmpty = true` | The beat is a placeholder — not real musical content. `voice.finish()` marks the parent voice as empty (`voice.isEmpty = true`) when all beats are empty. |
| `beat.isEmpty = false` | The beat is real content. Even with zero notes (`beat.notes.length === 0`), it represents an intentional rest. |

When `voice.finish(settings)` runs it also recomputes `beat.isRest`. A beat
with `isEmpty = true` will always have `isRest = true` after finishing,
regardless of whether notes still exist in the array.

## Rendering difference

### Standard notation staves (guitar, bass, strings, etc.)

Both `isEmpty` states render a **visible** rest:

| `isEmpty` | Rendered as | `visualBounds.w` (example) |
|-----------|-------------|----------------------------|
| `true`    | Whole-bar rest (centred, full-bar width) | ~41.6 |
| `false`   | Quarter rest glyph (narrow)              | ~9.7  |

This follows standard music notation convention: an empty bar always displays
a whole rest to indicate silence. There is no "invisible" state for standard
staves — the renderer always draws *some* rest symbol.

### Percussion staves (drumkit)

| `isEmpty` | Rendered as |
|-----------|-------------|
| `true`    | Transparent / invisible placeholder — no visible rest symbol |
| `false`   | Visible quarter rest glyph |

On percussion staves, `isEmpty = true` beats can be rendered without a visible
rest, making the bar appear truly empty. Toggling `isEmpty` to `false` makes
the rest appear; toggling it back to `true` makes it disappear.

## Interaction with boundsLookup

In **both** states and on **both** stave types, the beat is included in
`api.boundsLookup`. The `realBounds` (hit area for mouse clicks) stays
constant; only `visualBounds` changes width. This means the beat remains
click-selectable regardless of `isEmpty`.

## Interaction with `voice.finish()`

Calling `voice.finish(settings)` after flipping `isEmpty` has the following
side effects:

- **`beat.isRest`** is recomputed. Setting `isEmpty = true` on a beat that has
  notes will cause `isRest` to become `true`, creating an inconsistent model
  state (notes exist but the beat is classified as a rest). Avoid toggling
  `isEmpty` on beats that contain notes.
- **`voice.isEmpty`** is recomputed from all beats. If every beat in the voice
  has `isEmpty = true`, the voice is marked empty.

## Practical implications

1. **Rest insertion (`appendRestBefore` / `appendRestAfter`)** creates beats
   with `isEmpty = false`. If inserted next to a placeholder beat
   (`isEmpty = true`), the placeholder remains transparent on percussion staves
   but still shows a whole-bar rest on standard staves.

2. **Deleting the last real rest** in a bar should **not** splice the beat out
   of the voice (leaving zero beats). Doing so causes AlphaTab's renderer to
   draw a phantom, non-selectable rest with no backing model object. Instead,
   either block the deletion or mark the beat as `isEmpty = true`.

3. **The `toggleBeatIsEmpty` debug action** is most useful on percussion staves
   where the visual difference is obvious. On standard staves the change is
   subtle (whole-bar rest ↔ quarter rest).
