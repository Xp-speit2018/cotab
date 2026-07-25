# Testing and Verification

CoTab has one maintained verification matrix. The same commands are used
locally and by `.github/workflows/ci.yml`.

## Verification Matrix

| Gate | Command | Scope |
|------|---------|-------|
| Unit and integration behavior | `npm run test:unit` | Y.Doc schema and actions, AlphaTab conversion, collaboration, protocol, stores, and React components |
| Type boundaries | `npm run typecheck` | Web app, core, Web/local adapters, CLI, and MCP |
| Generated action reference | `npm run check:action-docs` | Ensures `docs/DOCUMENT-ACTIONS.generated.md` matches the action definitions |
| Script compilation | `npm run check:scripts` | Wiki and audit generators used by automation |
| Web production build | `npm run build:web` | Vite production bundle |
| Signaling server build | `npm run build:server` | Strict TypeScript server build |
| Desktop shell | `npm run check:desktop` | Locked Rust/Tauri dependency graph and native code |
| Browser workflows | `npm run test:e2e` | Chromium, Vite, signaling server, TURN, rendering, Agent mocks, and multi-peer collaboration |

`npm run verify` runs every deterministic Node gate: type checks, Vitest,
generated documentation checks, script compilation, and Web/server builds.
`npm run verify:all` additionally runs the desktop check and the complete
browser suite.

The browser suite requires Docker because Playwright starts the signaling and
TURN services from `compose.yaml`. Install Chromium once with:

```bash
npx playwright install chromium
```

## Test Organization

### Vitest

Maintained Vitest files use `src/**/*.test.{ts,tsx}` and run in one suite.
There is no separate filename-based integration suite. Tests are classified by
the behavior they exercise:

- Schema and pure helper tests use no mocks unless an external boundary
  requires one.
- DocumentAction tests use a real `Y.Doc`.
- Converter and engine tests exercise real AlphaTab model construction where
  model fidelity is the assertion.
- Component tests may mock stores, but must use production components and
  shared primitives.

Do not mock Yjs. For actions with tablature, standard-notation, or percussion
branches, cover every applicable branch. A mutation test should assert Y.Doc;
when renderer-visible fidelity matters, also assert the rebuilt AlphaTab model
or the rendered browser result.

### Playwright

Only files under `e2e/specs/` are maintained browser tests. Shared helpers live
under `e2e/helpers/`. Exploratory diagnostic scripts may be kept locally at the
root of `e2e/`; they are ignored by Git and are never discovered by the
canonical Playwright configuration.

Use targeted runs while developing:

```bash
npx playwright test e2e/specs/layout-switch.spec.js
npm run test:e2e:ui-harness
```

Before promoting a regression test, move it into `e2e/specs/`, remove
diagnostic-only logging and screenshots, and make the assertion describe the
user-visible or architectural contract.

## Rendering Assertions

Selection restoration, viewport reuse, and notation-content reuse are separate
contracts:

- Cursor preservation asserts selector identity and cursor bounds after the
  renderer settles.
- Viewport preservation asserts scroll position, no source reload, and no
  blank visible partial.
- Incremental rendering compares partial content identity or rendered
  master-bar ranges. A connected placeholder alone does not prove content
  reuse.
- Agent-visible completion asserts both the Y.Doc result and the AlphaTab
  model or rendered geometry after the renderer revision settles.

AlphaTab Horizontal layout currently replaces all rendered partial content.
Fixed-system content reuse is supported only in Parchment layout.

## Continuous Integration

The `CI` workflow runs on pull requests and pushes to `main`:

- **Types, tests, docs, and builds** runs `npm run verify`.
- **Tauri check** installs Linux WebKit dependencies and runs the locked Rust
  check.
- **Chromium E2E** installs Chromium, starts Vite/signaling/TURN through
  Playwright, and uploads traces, videos, and the HTML report on failure.

The manual `Generate Wiki` workflow runs its TypeScript source generators
through the repository-pinned `tsx` dependency before updating the separate
GitHub wiki repository.
