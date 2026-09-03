# Lane B Status — Reeding Assay Schema, Census & Grade

**Branch:** `feature/reeding-assay-schema` (off `master`)
**Owner:** Lane B (Evidence-layer lane)
**Date:** 2026-09-02
**Status:** ✅ Complete — code, schema, tests committed; branch pushed.

## What was built

All net-new under `src/reeding/` (the repo had no `src/` or `package.json` before — a minimal TypeScript + Jest + ajv toolchain was introduced, scoped to this module).

| File | Purpose |
|---|---|
| `assay.schema.json` | JSON Schema (draft 2020-12) for the immutable Assay record |
| `storage-adapter.ts` | Abstract `StorageAdapter` interface (Lane C implements Vercel Blob) |
| `census.ts` | Append-only `Census` store + in-memory adapter + errors |
| `grade.ts` | `UNGRADED` / `PROVISIONAL` / `CALIBRATED` computation + honest caveat |
| `README.md` | Definitions, lifecycle diagram, compliance language |
| `__tests__/*.test.ts` | 38 unit tests (3 suites) |
| `package.json`, `tsconfig.json`, `jest.config.cjs`, `.gitignore` | toolchain |

## Assay record — schema fields

`assay_id` (SHA-256 of engine_version+forecast_time+interval_ticker), `engine_version`, `forecast_time`, `interval_ticker`, `occurrence_time`, `verdict` (BUY_UP|BUY_DOWN|SPECULATIVE|WAIT), `confidence` (0..1), `rationale` (≤280), `market_context_snapshot` (target_price, last_price_at_forecast, cost_assumption_cents), `status` (FROZEN|SETTLED|VOID), `settlement` (append-only, null until settled: outcome, settlement_price, settled_at, source), `grade`, `created_at`, `schema_version`.

## Lifecycle

```
(none) --appendAssay--> FROZEN --recordSettlement--> SETTLED
                          |                            |
                          | voidAssay()                | (terminal)
                          v                            v
                        VOID                       re-grade reads new data,
                                                   never edits this record
```

## Immutability model (core invariant)

- A FROZEN Assay is written **once** under key `assay/{id}` and never rewritten.
- Settlement is **appended** under a separate key `assay/{id}.settlement` (also write-once). The frozen forecast bytes are byte-identical before and after settlement (asserted in tests).
- `recordSettlement` never edits a FROZEN record; it adds a sibling settlement record.
- Settling twice fails (`AssayAlreadySettledError`) unless the exact same payload is supplied again (idempotent).
- VOID is recorded as a marker under the settlement-key slot; the frozen bytes remain untouched. A VOID assay cannot be settled (`AssayNotFrozenError`).

## Census API

`appendAssay`, `getAssay(id)`, `listAssays(filter)`, `recordSettlement(id, settlement)`, `voidAssay(id)`, `computeGrade(engine_version)`. Errors: `AssayNotFoundError`, `AssayNotFrozenError`, `AssayAlreadySettledError`, `AssayAlreadyExistsError`, `AssayValidationError`.

## Grade computation

- `UNGRADED` — n < minSample (default 30) or no directional verdicts.
- `PROVISIONAL` — enough samples but CI wide (default half-width > 0.1) or edge not significant.
- `CALIBRATED` — CI tight AND directional edge survives Bonferroni multiple-comparison correction (alpha 0.05 / 96 comparisons).
- Only `BUY_UP`/`BUY_DOWN` verdicts contribute to directional calibration; `WAIT`/`SPECULATIVE` are settled but excluded from the grade.

## Honest caveat (Silverline compliance language)

> Silverline is a historical backtest and probability tool, not financial advice. BTC is close to a random walk at the 15-minute scale — the overall base rate is roughly a coin flip. Most time-of-day edges are NOT statistically significant once you account for sample size and multiple comparisons. Any single slot's win rate is a weak, regime-dependent signal, never a guarantee. Past performance does not predict future results.

A `CALIBRATED` grade does NOT mean the edge is real.

## Test results

```
Test Suites: 3 passed, 3 total
Tests:       38 passed, 38 total
```

Coverage: idempotent settlement (same payload succeeds, different payload throws), frozen-forecast immutability (bytes byte-identical before/after settlement, settlement under separate key), VOID guard, grade thresholds (UNGRADED/PROVISIONAL/CALIBRATED), version-specific grading, schema validation (ajv draft 2020-12), compliance language.

Run: `npm install && npm test` from the repo root.

## Constraints honored

- Net-new only. Did not touch `index.html`, `analysis.json`, `assets/`, or `master`.
- Only `ops/` file touched is this status file (new `ops/handoffs/` directory).
- No secrets, no network, no deploy, no scheduler.
- Dependency-light: `ajv` + `jest`/`ts-jest`, scoped to `src/reeding/`.

## Handoff to Lane C

`StorageAdapter` interface (`src/reeding/storage-adapter.ts`) is the contract to implement for Vercel Blob:
```ts
interface StorageAdapter {
  put(key, data, opts?): Promise<void>;  // write-once; fail on existing different bytes
  get(key): Promise<string | null>;
  list(prefix?): Promise<string[]>;
}
```
Keys used by `Census`: `assay/{assay_id}` (frozen) and `assay/{assay_id}.settlement` (appended). Both write-once. A `MemoryStorageAdapter` is included for reference/tests.

## Blockers

None.
