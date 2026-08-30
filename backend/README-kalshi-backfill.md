# Kalshi KXBTC15M Backfill — backend README

Step 1 prototype of the Silverline Kalshi integration. Paginates Kalshi's public,
no-auth REST endpoints server-side to collect REAL settlement outcomes for the
BTC 15-min Up/Down series (`KXBTC15M`) and report depth + field completeness.

No API key, no Kalshi account, no auth headers. Public market data only.

---

## Endpoints queried and why both are used

Base URL (production REST): `https://external-api.kalshi.com/trade-api/v2`

Kalshi splits settled markets across a live/historical boundary exposed by
`GET /historical/cutoff`. As of 2026-08-29 that cutoff is
`market_settled_ts = 2026-06-30T00:00:00Z`. A complete backfill must paginate
BOTH endpoints, because each holds a different side of the boundary:

1. `GET /markets?series_ticker=KXBTC15M&status=settled` — recent settled markets
   (settled AFTER the cutoff). This is the "live" side.
2. `GET /historical/markets?series_ticker=KXBTC15M` — archived settled markets
   (settled BEFORE the cutoff). This is the "historical" side.

`GET /historical/cutoff` is queried first to record the boundary for auditing and
so the blend logic (Step 3) knows where the source switches.

The script also calls `GET /series/KXBTC15M` implicitly via the series metadata
available on each market record (ticker, title, frequency, settlement source).

## Cursor-pagination behavior

Both list endpoints return `{ "cursor": "<opaque>", "markets": [...] }`.

- The cursor is an opaque base64-ish string. Do NOT parse dates out of it.
- Pass `cursor=<value>` as a query param on the next request to advance.
- Stop only when the returned `cursor` is empty AND no new markets were seen on
  the page (guards against a repeating cursor causing an infinite loop).
- The script dedupes by `event_ticker` across both endpoints (recent +
  historical can overlap near the cutoff).
- A light `SLEEP_BETWEEN_PAGES` throttle (0.15s) is used; public unauthenticated
  reads do not appear to debit the token bucket. On HTTP 429, back off ~2s.

## How to regenerate the raw backfill

Locally or server-side (the API sends no CORS headers, so it cannot be called
from a browser — that is the whole reason a server-side bake exists):

```bash
cd backend
python3 kalshi_backfill.py
```

Outputs (written next to the script):

- `kalshi_settlement_raw.json` — full per-market records (RAW; git-ignored, never committed)
- `kalshi_backfill_summary.json` — measured summary (market count, date range, base rate, field presence)

Requirements: Python 3 with `requests`. No credentials, no `.env`.

## Current findings (2026-08-29 run)

| Metric | Value |
|---|---|
| Settled markets collected | 24,415 |
| Coverage | Dec. 10, 2025 → Aug. 30, 2026 |
| Span | ~262 days / ~8.6 months |
| `result` present | 100% (24,415 / 24,415) |
| `floor_strike` present | 98.5% (24,057) |
| `expiration_value` present | 88.5% (21,601) |
| Base rate (yes / no) | 49.93% / 50.07% (~coin flip) |
| Historical cutoff | 2026-06-30T00:00:00Z |

### Field-completeness notes

- `result` (`"yes"` / `"no"`) is the authoritative outcome label and is complete
  on every record. It is the outcome truth for PRE.
- `floor_strike` (the target price) is 98.5% populated. Recover a missing value
  ONLY if it can be deterministically parsed from `yes_sub_title`
  (e.g. `"Target Price: $80,078.50"`). Never guess.
- `expiration_value` (the final benchmark price) is 88.5% populated. Leave
  unavailable values `null` — do NOT infer or fabricate them.

## Expected source field names

Verified against the live schema. Use these, not the earlier guesses:

- `settlement_ts` (NOT `settlement_time` — that field does not exist)
- `volume_fp` (NOT `volume`)
- `volume_24h_fp`
- `result`, `expiration_value`, `floor_strike`, `close_time`, `open_time`,
  `occurrence_datetime`, `last_price_dollars`, `open_interest_fp`,
  `notional_value_dollars`, `yes_bid_dollars`, `yes_ask_dollars`, `yes_sub_title`

## Outcome truth + data-handling rules (CRITICAL)

- `result` is the outcome truth for PRE. Per-slot win rates are computed from it.
- Raw Kalshi records (`kalshi_settlement_raw.json` and any raw market archive)
  must NEVER be committed to git, publicly served, or exposed in
  `analysis.json`. `analysis.json` keeps only COMPUTED aggregate stats
  (win rates, edges, confidence intervals, sample sizes) — never raw records.
- Credentials / `.env` / API keys must never be committed. Public market-data
  reads need no credentials; trading/WebSocket would, and we do not use those.
- This is real but short-duration (~8.6 months) settlement data. When wired into
  PRE, it must be transparently blended with the longer Coinbase spot-candle
  proxy, surfacing source coverage, sample sizes, and confidence intervals per
  slot. Never present Kalshi settlement as the whole history.
