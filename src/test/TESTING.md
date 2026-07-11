# Test Principles

## Layer Definitions

| Layer | Name | Scope | Mocking |
|-------|------|-------|---------|
| L0 | Schema factories | `createNote`, `createBeat`, etc. | None |
| L1 | DocumentAction unit | Real Y.Doc, mocked AlphaTab (`player-api`, `player-helpers`) | Mock `player-api`, `player-helpers`, `player-store` |
| L2 | Integration | Real Y.Doc + real `buildAlphaTabScore` + real AlphaTab classes | Unmock `@/core/converters` and `@coderline/alphatab` |
| L3 | Converter direct | `buildAlphaTabScore`, `importScoreToYDoc` in isolation | Same as L2 |
| L4 | React components | Component rendering with mocked stores | Mock stores, use `@testing-library/react` |

Terminology: see `docs/ACTIONS.md`. Existing tests still import from
`src/core/actions`, which is the current DocumentAction implementation.
AppAction tests should cover UI/shortcut dispatch behavior and transport/view
actions above core.

## Mocking Policy

- **Never mock Yjs.** All layers use a real `Y.Doc`.
- **L1:** Mock `player-api` (getApi returns null or a mock score) and `player-helpers` (resolveBeat, snapPositionToPitch as `vi.fn()`). Mock `@coderline/alphatab` and `@/core/converters`.
- **L2:** Unmock `@/core/converters` and `@coderline/alphatab`. Integration tests must exercise real `buildAlphaTabScore` round-trips.
- **L3:** Same unmocking as L2 but tests target converter functions directly, not actions.

## Instrument Coverage Rule

Any DocumentAction with per-instrument branching (tab / notation / percussion) **must**:
1. Test all code paths at L1 (guitar tab, piano notation, drumkit percussion).
2. Test guitar + the relevant variant at L2 (e.g., piano `realValue` round-trip, drumkit `isPercussion` round-trip).

## Parametrized Pattern

Use `it.each` for property setters that share `applyBeatUpdates` / `applyNoteUpdates`:

```ts
it.each([
  ["document.beat.setVibrato", "vibrato", 1],
  ["document.beat.setDynamics", "dynamics", 5],
  // ...
])("%s sets %s on Y.Map", (actionId, field, value) => {
  executeDocumentAction(actionId, value, ctx);
  expect(resolveYBeat(...).get(field)).toBe(value);
});
```

## File Naming

- `edit-{domain}.test.ts` — L1 unit tests
- `edit-{domain}-integration.test.ts` — L2 integration tests
- Describe blocks match current action IDs: `describe("document.beat.placeNote", ...)`

## No Duplication

- Always import helpers from `@/test/setup`. Never redefine seed/place functions locally.
- Shared helpers: `seedOneTrackScore`, `seedTrackWithConfig`, `placeNoteDirectly`, `placePercussionNoteDirectly`, `placePianoNoteDirectly`, `addBeatsDirectly`, `buildMockAlphaTabScore`.
