# Reeding — Evidence Layer & Runtime

The immutable evidence layer **and** runtime package for the Silverline **PRE** (Predictive Reeding Engine). Named for *reeding* — the milled grooves on a coin's edge that let you identify it by touch before you see it. This layer freezes each forecast-to-outcome record *before* the outcome is known, then appends the settlement afterward. The frozen forecast is never edited.

> Census is **separate** from Andrew's personal bet ledger. They are never merged. This module records what the engine predicted and what happened — not what Andrew wagered.

## Layout

```
src/reeding/
├── assay.schema.json              # JSON Schema (draft 2020-12) for the immutable Assay record
├── storage-adapter.ts            # abstract StorageAdapter interface + MemoryStorageAdapter (Lane B)
├── census.ts                     # append-only Census store + in-memory adapter + errors
├── grade.ts                      # UNGRADED / PROVISIONAL / CALIBRATED computation + caveat
├── collect.js                    # scheduled entrypoint run by the GitHub Actions workflow (Lane C)
├── storage/
│   └── vercel-blob-adapter.ts    # VercelBlobAdapter implementing StorageAdapter (Lane C)
├── __tests__/                    # unit tests (Lane B: 38 passing)
└── README.md                     # this file
```

Related, outside this dir:
- `.github/workflows/reeding-edge.yml` — the GitHub Actions workflow (Lane C). `workflow_dispatch` only; `schedule: cron */15 * * * *` is commented out with an "ENABLE AFTER APPROVAL" note.
- `ops/briefs/REEDING_RUNTIME_APPROVALS.md` — the exact 3-item approval gate for Andrew.

## The Assay record

An Assay is one immutable 15-minute forecast-to-outcome record.

| Field | Type | Notes |
|---|---|---|
| `assay_id` | string (sha256 hex) | Deterministic: `SHA-256(engine_version + forecast_time + interval_ticker)` |
| `engine_version` | string | e.g. `pre-0.1`. Grades are version-specific. |
| `forecast_time` | ISO8601 | When the forecast is **frozen** — must precede `occurrence_time` and any settlement |
| `interval_ticker` | string | Kalshi ticker, e.g. `KXBTC15M-26SEP022115` |
| `occurrence_time` | ISO8601 | The 15-min slot being predicted |
| `verdict` | `BUY_UP` \| `BUY_DOWN` \| `SPECULATIVE` \| `WAIT` | Directional lean |
| `confidence` | 0..1 | |
| `rationale` | string | short, no hype |
| `market_context_snapshot` | object | target_price, last_price_at_forecast, cost_assumption_cents |
| `status` | `FROZEN` \| `SETTLED` \| `VOID` | |
| `settlement` | nullable, append-only | `{ outcome, settlement_price, settled_at, source }` — null until settled |
| `grade` | nullable | `UNGRADED` \| `PROVISIONAL` \| `CALIBRATED` — computed later |
| `created_at`, `schema_version` | | |

**Core invariant:** the frozen forecast is written once under `assay/{id}` and never rewritten; settlement is appended under a separate write-once key `assay/{id}.settlement`. `recordSettlement` is idempotent (same payload succeeds, different payload throws `AssayAlreadySettledError`), fails on non-FROZEN/VOID assays, and never edits frozen bytes.

## How to enable the runtime (literal, step by step)

1. **Create the Vercel Blob store.** Andrew signs into Vercel → Storage → create a Blob store (e.g. `reeding`). Free Hobby tier. Copy the read/write token it gives you.
2. **Add the repo secret.** Open the repo on GitHub → Settings → Secrets and variables → Actions → New repository secret. Name: `BLOB_READ_WRITE_TOKEN`. Value: the token from step 1.
3. **Add the dependency + build.** Add `@vercel/blob` to the project and a build step so `collect.js` can `require` the compiled adapter. Until then `collect.js` is a guarded no-op.
4. **Smoke test manually.** GitHub Actions tab → "Reeding Edge" → Run workflow → keep `dry_run=true` → confirm the run exits 0 and logs `storage: skipped`.
5. **Go live (Andrew's approval).** Uncomment the `schedule:` block in `.github/workflows/reeding-edge.yml` and set the `dry_run` default to `false`.

## Safety guarantees (while disabled)

- A manual run with no token and no `@vercel/blob` exits 0 (no-op).
- The workflow has `permissions: contents: read` only and a `concurrency` group so runs don't overlap.
- Nothing here touches `index.html`, `analysis.json`, `assets/`, existing `ops/` files, master, or the personal bet ledger.

## Honest caveat (compliance language — must remain visible)

This is a historical backtest / probability tool, not financial advice. BTC is close to a random walk at the 15-minute scale — the overall base rate is roughly a coin flip. Most time-of-day edges are not statistically significant once you account for sample size and multiple comparisons. Any single slot's win rate is a weak, regime-dependent signal, never a guarantee. Past performance does not predict future results.
