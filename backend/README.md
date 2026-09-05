# Silverline — backend

Server-side data and model code. Nothing in this directory is served to the browser;
the live site is the static `index.html` + `analysis.json` at the repo root.

## What is here (version controlled)

| File | What it does |
|---|---|
| `kalshi_backfill.py` | Kalshi `KXBTC15M` settlement backfill prototype (OPS-01, Step 1). Paginates Kalshi's public no-auth endpoints to collect real Up/Down settlement outcomes and report archive depth. No API key, no Kalshi account. |
| `kalshi_backfill_summary.json` | Measured output of the above: 24,415 settled markets, 2025-12-10 → 2026-08-30 (262 days), base rate yes 0.4993 / no 0.5007. Aggregate stats only — no raw Kalshi records. |

`kalshi_backfill.py` is committed **verbatim**, unmodified. Its `OUT_PATH` /
`SUMMARY_PATH` constants still point at `/home/user/workspace/btc-wizard/backend/`,
the path in the originating sandbox. That is deliberate — the file was relocated
into version control, not rewritten. Repointing those paths is a separate,
reviewable change.

## What is MISSING (Blocker A — not yet recovered)

These three files generate the model the live site serves, and they are **not in
this repository**. They exist only inside the daily cron session's sandbox:

| File | Role | Status |
|---|---|---|
| `refresh_analysis.py` | Daily refresh driver — rebuilds `analysis.json` | **NOT VERSION CONTROLLED** |
| `analysis.py` | The analysis engine (edge/win-rate/CI computation) | **NOT VERSION CONTROLLED** |
| `candles.parquet` | Cached BTC-USD candle store (~105k candles) | **NOT VERSION CONTROLLED** |

This is the project's single largest fragility: the code that produces production
data has no backup and no revision history. If that sandbox is lost, the daily
refresh stops and there is no source to rebuild it from.

Recovery steps: `ops/briefs/BLOCKER_A_PIPELINE_RECOVERY.md`.

## Note on `analysis.json`

`analysis.json` at the repo root is a **build artifact**, not source. It is
regenerated daily by `refresh_analysis.py` and committed by the daily cron.
Treat it as output; do not hand-edit it.

## Deploy reality

Production is **not** deployed from this repository. Vercel deployments for
`silverline-global` carry no Git metadata (no commit SHA, no branch, no source
ref) — they are CLI uploads of a local folder, with this repo maintained as a
parallel mirror. Consequences:

- Pushing to `master` does **not** change the live site.
- The recurring deployed-SHA / `master`-SHA mismatch and `gitDirty: "1"` flag are
  structural, not a transient glitch to reconcile. Tracked as RE-0.
