# Reeding Edge — Technical Discovery Report

**Date:** 2026-09-02 PT
**Author:** COO command thread (read-only discovery)
**Status:** Complete. No external writes, no secrets, no approvals used.
**Budget:** Discovery only — no credit-cap spend on infrastructure.

---

## 1. Kalshi public API (the data-truth layer) — VERIFIED LIVE, NO AUTH

The single most important finding: **Kalshi exposes all market data — including contract settlement outcomes — via public, unauthenticated REST endpoints.** This eliminates the v2 Coinbase-spot-proxy workaround. Reeding Edge can read the actual contract resolution directly from Kalshi.

Verified live (curl, no auth):

- Base URL: `https://external-api.kalshi.com/trade-api/v2`
- `GET /series/KXBTC15M` → returns series metadata, `frequency: fifteen_min`.
- `GET /markets?series_ticker=KXBTC15M&status=open` → returns current 15-min markets, each with `floor_strike` (target price), `close_time`, `expected_expiration_time`, `last_price_dollars`, `result` ("" while open, "yes"/"no" after settlement), `occurrence_datetime`, `rules_primary`.
- Candlesticks: `GET /series/{series}/markets/{ticker}/candlesticks?start_ts=..&end_ts=..&period_interval=1` (1/60/1440 min only).
- Historical archive: `GET /historical/cutoff`, `GET /historical/markets/{ticker}/candlesticks` for settled markets past the cutoff.
- Settlement basis: CF Benchmarks BRTI, 60-second average over the final minute before close. Binary Up/Down vs `floor_strike`.

**Exception:** the orderbook endpoint (`GET /markets/{ticker}/orderbook`) and all WebSocket channels require signed auth headers. Reeding Edge does NOT need these — it needs settlement outcomes, which are public.

**Implication:** No Kalshi account, no API key, no auth headers, no trading capability. Pure public data reader. Cleaner and more truthful than v2's Coinbase-spot proxy.

---

## 2. GitHub Actions scheduler — FEASIBLE, FREE

- Repo `andrewcstevens/silverline` is **PUBLIC** → GitHub Actions minutes are **unlimited** on the free plan. No minute-cap risk for the 15-min cadence.
- Minimum cron interval is 5 min; `*/15 * * * *` is valid and well within limits.
- **Known limitation:** scheduled runs can be delayed up to 15 min during GitHub high-load periods, and schedules auto-disable after 60 days of repo inactivity. **Mitigation (design requirement):** the collector must be idempotent on `assay_id`, handle late/missed runs by recording gap records, and never retrospectively backfill a forecast for a slot whose settlement already occurred.

---

## 3. Private durable storage — FREE OPTION AVAILABLE

- **Vercel Blob** is free for Hobby users within included usage (storage size + simple operations). Requires creating a Blob store and a `BLOB_READ_WRITE_TOKEN`.
- This is the **one approval gate**: Andrew must create the Vercel Blob store (free) and add the token as a GitHub repo secret. Until then, the collector can run against a local-file storage adapter for development.

---

## 4. Deployment parity — NOTED, NOT CHANGED

- `master` head: `efee6cf` ("daily model refresh"). `ops/command-center` is ahead on a separate branch (intentional — ops branch is the control plane, not production).
- Live site is a static `index.html` (no `package.json`, no build step) deployed via Vercel. No `.github/workflows/` directory exists yet — net-new, so Reeding Edge's workflow file won't conflict with anything.
- The earlier "dirty deploy" gap is a pre-existing Vercel state issue, untouched by this discovery. Recorded for a later, separately-approved production fix.

---

## 5. Active workstreams (parallel, bounded subagents)

Per OPS-05 COO orchestration, three specialist lanes launched in parallel on isolated feature branches (net-new only, no approvals):

| Lane | Branch | Deliverable |
|---|---|---|
| A — Kalshi data client | `feature/reeding-kalshi-client` | Public REST client (series, markets, candlesticks, resolution) |
| B — Assay schema & Census | `feature/reeding-assay-schema` | Immutable Assay record, append-only Census, Grade computation |
| C — Scheduler & storage | `feature/reeding-scheduler-storage` | GitHub Actions workflow (disabled), Vercel Blob adapter, approval-gate brief |

---

## 6. The one approval gate that will surface

After Lanes A/B/C merge, the only thing that requires Andrew is:
1. Create a Vercel Blob store (free Hobby tier).
2. Add `BLOB_READ_WRITE_TOKEN` as a GitHub repo secret.
3. Approve enabling the `schedule:` cron block (switching from manual `workflow_dispatch` to live 15-min).

Until then, Reeding Edge runs in safe-mode: manual dispatch, local-file storage, no live scheduled collection, no secrets, no cost.
