# Reeding — Evidence Layer (Lane B)

The immutable evidence layer for the Silverline **PRE** (Predictive Reeding Engine). Named for *reeding* — the milled grooves on a coin's edge that let you identify it by touch before you see it. This layer freezes each forecast-to-outcome record *before* the outcome is known, then appends the settlement afterward. The frozen forecast is never edited.

> Census is **separate** from Andrew's personal bet ledger. They are never merged. This module records what the engine predicted and what happened — not what Andrew wagered.

## Layout

```
src/reeding/
├── assay.schema.json     # JSON Schema (draft 2020-12) for the immutable Assay record
├── storage-adapter.ts    # abstract StorageAdapter interface (Lane C implements Blob)
├── census.ts             # append-only Census store + in-memory adapter + errors
├── grade.ts              # UNGRADED / PROVISIONAL / CALIBRATED computation + caveat
├── README.md             # this file
└── __tests__/            # Jest unit tests
```

## The Assay record

An Assay is one immutable 15-minute forecast-to-outcome record.

| Field | Type | Notes |
|---|---|---|
| `assay_id` | string (sha256 hex) | Deterministic: `SHA-256(engine_version + forecast_time + interval_ticker)` |
| `engine_version` | string | e.g. `pre-0.1`. Grades are version-specific. |
| `forecast_time` | ISO8601 | When the forecast was **frozen** — must precede `occurrence_time` and any settlement |
| `interval_ticker` | string | Kalshi ticker, e.g. `KXBTC15M-26SEP022115` |
| `occurrence_time` | ISO8601 | The 15-min slot being predicted |
| `verdict` | `BUY_UP` \| `BUY_DOWN` \| `SPECULATIVE` \| `WAIT` | Directional lean |
| `confidence` | number 0..1 | Model confidence — **not** a calibrated probability |
| `rationale` | string ≤280 | Plain language, no hype |
| `market_context_snapshot` | object | `target_price`, `last_price_at_forecast`, `cost_assumption_cents` |
| `status` | `FROZEN` \| `SETTLED` \| `VOID` | Lifecycle state |
| `settlement` | object \| null | **Append-only**. Null until resolved. |
| `grade` | `UNGRADED` \| `PROVISIONAL` \| `CALIBRATED` \| null | Computed later, never edits the record |
| `created_at` | ISO8601 | First persisted |
| `schema_version` | semver | e.g. `1.0.0` |

## Lifecycle

```
            appendAssay()                  recordSettlement()
  (none) ───────────────▶ FROZEN ─────────────────────────▶ SETTLED
                            │                                 │
                            │  voidAssay()                     │
                            ▼                                 ▼
                          VOID                            (terminal — re-grade
                                                           reads new data, never
                                                           edits this record)
```

### Immutability model (the core invariant)

1. A FROZEN Assay is written **once** under key `assay/{id}` and never rewritten. Forecast fields are immutable from that point.
2. Settlement is **appended** under a separate key `assay/{id}.settlement` (also write-once). The frozen forecast bytes are never touched.
3. `recordSettlement` therefore never edits a FROZEN record — it adds a sibling settlement record.
4. Settling twice fails, **unless** the exact same settlement payload is supplied again (idempotent).

This means the storage adapter only needs write-once `put` semantics. Lane C implements a Vercel Blob adapter against the `StorageAdapter` interface; an in-memory adapter ships here for tests.

## Census store API

```ts
class Census {
  appendAssay(input): Promise<Assay>            // freeze a new forecast
  getAssay(id): Promise<Assay | null>          // read (frozen + appended settlement)
  listAssays(filter?): Promise<Assay[]>        // filter by version/status/verdict/ticker
  recordSettlement(id, s): Promise<Assay>      // append outcome (fails if not FROZEN or already SETTLED)
  voidAssay(id): Promise<Assay>                 // administrative VOID (cannot void a SETTLED assay)
  computeGrade(engine_version): Promise<Grade> // version-specific reliability assessment
}
```

Errors: `AssayNotFoundError`, `AssayNotFrozenError`, `AssayAlreadySettledError`, `AssayAlreadyExistsError`, `AssayValidationError`.

## Grade computation

```
UNGRADED    n < minSample (default 30)
PROVISIONAL enough samples, but CI wide OR edge not significant
CALIBRATED  CI tight AND directional edge survives Bonferroni multiple-comparison correction
```

Only directional verdicts (`BUY_UP` / `BUY_DOWN`) contribute to the win-rate calibration. `WAIT` and `SPECULATIVE` assays are settled but excluded from the directional grade (they carry no directional claim).

## Honest caveat — Silverline compliance language

> Silverline is a historical backtest and probability tool, **not financial advice**. BTC is close to a **random walk at the 15-minute scale** — the overall base rate is roughly a coin flip. **Most time-of-day edges are NOT statistically significant** once you account for sample size and **multiple comparisons**. Any single slot's win rate is a weak, **regime-dependent** signal, never a guarantee. **Past performance does not predict future results.**

A `CALIBRATED` grade does **not** mean the edge is real. It means the observed directional skew survived a strict Bonferroni correction against the number of slots compared — most edges will never reach this bar, and even those that do are not a guarantee of future performance.

## Tests

```bash
npm install
npm test
```

Coverage: idempotent settlement (same payload succeeds, different payload throws), frozen-forecast immutability (the `assay/{id}` bytes are byte-identical before and after settlement), grade thresholds (UNGRADED / PROVISIONAL / CALIBRATED), version-specific grading, schema validation, and the compliance language.

## Constraints honored

- Net-new only — touches nothing under `index.html`, `analysis.json`, `assets/`, `ops/` (except the status handoff), or `master`.
- No secrets, no network, no deploy, no scheduler.
- Dependency-light: `ajv` (schema validation) + `jest`/`ts-jest` (tests), scoped to `src/reeding/`.
