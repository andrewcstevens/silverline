# @silverline/kalshi-client

A **read-only** TypeScript client for Kalshi's **public** market-data API.

- **No authentication.** No API key, no secrets, no login flow.
- **No trading.** No order placement, no orderbook reads, no account access.
- **No write endpoints.** GET requests only against `https://external-api.kalshi.com/trade-api/v2`.

Built for the Silverline BTC 15-Min Edge Finder to read `KXBTC15M` ("Bitcoin
price up / down", fifteen-minute binary markets) settlement + candlestick data.

> ## Honest caveat
> This client reads **public market data only**. It cannot trade, cannot place
> orders, cannot read the orderbook (that endpoint requires auth and is
> intentionally not implemented), and cannot access any account. Kalshi's
> 15-minute BTC markets are close to a coin flip at base rate; historical
> settlement data is descriptive, not predictive. Nothing here is financial
> advice. Past performance does not predict future results.

## Installation

This package is self-contained under `src/kalshi/`. It does not touch the
repo's static `index.html` build. From this directory:

```bash
npm install        # installs the dev-only typescript compiler
npm run build      # emits dist/
npm test           # typechecks + runs the unit tests (no network)
```

No runtime dependencies. Requires Node 18+ (uses the global `fetch`).

## Usage

```ts
import { KalshiClient, getSeries, getOpenMarkets, getSettledMarkets, getCandlesticks, getResolution } from "./src/kalshi";

const client = new KalshiClient(); // public, no auth

// Series metadata
const series = await getSeries(client, "KXBTC15M");
// series.frequency === "fifteen_min"

// Markets currently accepting trades
const open = await getOpenMarkets(client, "KXBTC15M");

// Recently settled markets (with result + settlement price)
const settled = await getSettledMarkets(client, "KXBTC15M");

// A single market by ticker
const m = await getMarket(client, "KXBTC15M-26SEP022115-15");

// Candlesticks (auto-routes live vs historical endpoint by cutoff)
const end = Math.floor(Date.now() / 1000);
const candles = await getCandlesticks(client, "KXBTC15M-26SEP022115-15", end - 600, end, 1);

// Resolution: did the market end up or down vs its target price?
const r = await getResolution(client, "KXBTC15M-26SEP022115-15");
// { resolved, outcome: "up" | "down" | null, settlement_price, target_price, ... }
```

## Modules

| File | Responsibility |
|------|----------------|
| `client.ts` | HTTP transport: throttling (≤1 req/sec), exponential backoff + retry on 429/5xx, timeout, injectable `fetch`. |
| `series.ts` | `getSeries(ticker)` — series metadata (frequency, settlement sources). |
| `markets.ts` | `getOpenMarkets`, `getMarket`, `getSettledMarkets`, `listMarkets` (cursor pagination unwrapped). |
| `candlesticks.ts` | `getCandlesticks(ticker, start, end, interval)` — auto-routes to the historical endpoint when the range predates the cutoff, and chunks wide ranges to respect Kalshi's 5000-candle-per-request cap. |
| `resolve.ts` | `getResolution(ticker)` — derives Up/Down outcome from the `result` field + `floor_strike`. |
| `types.ts` | Response shapes (tolerant — extra fields don't break the client). |

## Live verification (no auth)

All endpoints below were confirmed working **without authentication** during
the build of this client (Sep 2026):

- `GET /series/KXBTC15M` → series metadata, `frequency: "fifteen_min"`.
- `GET /markets?series_ticker=KXBTC15M&status=open|settled&limit=N` → market list with cursor pagination.
- `GET /markets/{ticker}` → single market object, returned wrapped as `{ market: {...} }` (the helper unwraps it).
- `GET /series/{series_ticker}/markets/{ticker}/candlesticks?start_ts=&end_ts=&period_interval=1` → live 1-minute candlesticks for active markets.
- `GET /historical/cutoff` → boundary between live and historical data.
- `GET /historical/markets/{ticker}/candlesticks?...` → candlesticks for archived markets (settled past the cutoff).

Resolution semantics (from `rules_primary`): a market resolves to **Yes** when
the 60-second average BRTI at close is **at least** the target price
(`floor_strike`). So `result === "yes"` → outcome **"up"**, `result === "no"` →
outcome **"down"**, and an empty `result` means the market is still open.

## Testing

Unit tests use an in-memory mock transport — **no network calls in CI**:

```bash
npm test
```

One optional live integration test is gated behind `KALSHI_LIVE=1` so it only
runs when explicitly invoked locally:

```bash
npm run test:live
```

## Constraints honored

- Net-new files only. Nothing in `index.html`, `analysis.json`, `assets/`, or
  `ops/` was modified.
- No secrets, no environment variables required for default operation.
- No Vercel config, no GitHub Actions workflow file.
- No orderbook endpoint (requires auth — intentionally skipped).
- No real-money orders of any kind.
