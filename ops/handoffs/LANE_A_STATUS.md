# Lane A — Kalshi Data Client — Status

**Branch:** `feature/reeding-kalshi-client` (off `master`)
**Date:** 2026-09-02
**Owner:** Lane A (Technical/Data)

## What was built

A read-only TypeScript client for Kalshi's **public** market-data API (no auth, no
secrets, no trading, no orderbook). All net-new files under `src/kalshi/`.

### Modules
- `client.ts` — `KalshiClient` HTTP transport. Global `fetch` (Node 18+), injectable
  for tests. Throttles to ≤1 req/sec, exponential backoff + retry on 429/5xx/network
  errors, 30s timeout, custom User-Agent. No runtime dependencies.
- `series.ts` — `getSeries(ticker)` → series metadata (frequency, settlement sources).
- `markets.ts` — `getOpenMarkets`, `getMarket`, `getSettledMarkets`, `listMarkets`
  (cursor pagination fully unwrapped), `seriesOfTicker`. Handles Kalshi wrapping the
  single-market response in `{ market: {...} }`.
- `candlesticks.ts` — `getCandlesticks(ticker, start, end, interval=1)`. Auto-routes
  to the historical endpoint when the range predates the cutoff, falls back to
  historical on live-endpoint 404, and chunks wide ranges to respect Kalshi's
  5000-candle-per-request cap.
- `resolve.ts` — `getResolution(ticker)` → `{ resolved, outcome: "up"|"down"|null,
  settlement_price, target_price, occurrence_time, close_time }`. Derives Up/Down
  from the `result` field vs `floor_strike`.
- `types.ts` / `types-internal.ts` — tolerant response shapes.
- `index.ts` — public barrel.
- `__tests__/` — 36 unit tests with an in-memory mock transport (no network in CI),
  plus an optional live integration test gated by `KALSHI_LIVE=1`.
- `package.json`, `tsconfig.json`, `.gitignore`, `README.md`.

## Live test result

`KALSHI_LIVE=1 node --test` — **3/3 passed** against the real public API:
- `GET /series/KXBTC15M` → `frequency: "fifteen_min"` (no auth).
- Open + settled markets round-trip; single-market fetch + resolution verified.
- 1-minute candlesticks for the active market return chronologically.

Unit tests: **36/36 pass** (no network).

## File list

```
src/kalshi/
├── .gitignore
├── README.md
├── package.json
├── tsconfig.json
├── index.ts
├── client.ts
├── series.ts
├── markets.ts
├── candlesticks.ts
├── resolve.ts
├── types.ts
├── types-internal.ts
└── __tests__/
    ├── mock.ts
    ├── client.test.ts
    ├── series.test.ts
    ├── markets.test.ts
    ├── candlesticks.test.ts
    ├── resolve.test.ts
    └── live.test.ts
```

## Constraints honored

- Net-new files only. `index.html`, `analysis.json`, `assets/`, `ops/` (except this
  file), and `master` untouched.
- No secrets, no env vars required for default operation, no Vercel, no GitHub
  Actions workflow file.
- No orderbook endpoint, no real-money orders of any kind.
- Self-contained under `src/kalshi/` (own `package.json` + `tsconfig.json`) so the
  static site build is undisturbed.

## Blockers

None. All endpoints confirmed public without auth. One mid-build correction: the
single-market `GET /markets/{ticker}` endpoint wraps its response in `{ market: {...} }`
(unlike the list endpoint, which returns markets bare). `getMarket` now normalizes both
shapes; covered by unit + live tests.

## Approvals needed

None. Ready for review/merge of `feature/reeding-kalshi-client`.
