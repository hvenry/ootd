# Test suite

**Status:** ready

Adds Vitest, so the arithmetic every measurement depends on is checked on every change instead of by eye.

## Goal

There is no test suite: a regression in unit conversion or the homography would produce plausible but wrong millimetres that nobody notices.
It worked when `pnpm test` runs in a few seconds, covers `src/lib/units/` and `src/lib/homography/`, and a single file or test can be run on its own.

## Scope

- In: Vitest setup, `pnpm test`, unit tests for `src/lib/units/` and the pure parts of `src/lib/homography/`, the single-test command in `AGENTS.md`.
- Out: E2E tests, the Python worker's tests, React component tests, CI. Each can follow as its own spec.

## Design

- **Runner:** Vitest, with the `@/` path alias from `tsconfig.json`, Node environment, tests colocated as `*.test.ts` beside the module.
- **Scripts:**
  - `pnpm test` - run every test once.
  - `pnpm test src/lib/units/index.test.ts` - one file.
  - `pnpm test -t "formatLength"` - tests whose name matches.
- **`src/lib/units/index.ts`:** `toMm` rounds to integer mm; `pxToMm` and `mmToPx` round-trip; `formatLength` for `mm`, `cm` and `in`, with inches as eighths.
- **`src/lib/homography/solve.ts`:** `getPerspectiveTransform` maps four known points exactly; `invertHomography` round-trips `applyHomography`; `distanceMm` on a synthetic, skewed quad returns the true span within 0.1 mm.
- **`src/lib/homography/sheet.ts`:** `solveQuadMm` and `quadCheckMm` against a rig with a known diagonal, including a wrong span exceeding `RIG_TOLERANCE_MM`; `printScale` with and without a measured black square; `sheetVersionFromIds` and `versionMarkerIds` round-trip; `LAYOUT_IDS` keeps rig and A3 IDs disjoint.
- Lint and typecheck cover test files like any other source.

## Tasks

- [ ] Add Vitest as a dev dependency and `vitest.config.ts` with the `@/` alias
- [ ] Add `"test": "vitest run"` to `package.json`
- [ ] Tests for `src/lib/units/index.ts`
- [ ] Tests for `src/lib/homography/solve.ts`
- [ ] Tests for `src/lib/homography/sheet.ts`
- [ ] Replace the known-gap line in `AGENTS.md` with `pnpm test` and the single-test command

## Done when

- [ ] `pnpm test` passes, and fails when a conversion or the solve is deliberately broken
- [ ] `pnpm typecheck && pnpm lint` pass with the test files included
- [ ] A new testing doc in `docs/` describes how tests are laid out and run; `AGENTS.md` lists it
- [ ] This spec is deleted and removed from `roadmap.md` and `AGENTS.md`

## Open questions

- Worker tests with pytest: a separate spec. Default: after this one lands.

## Related

- [Rig and scale](../rig-and-scale.md)
- [Measure](../measure.md)
