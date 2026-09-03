// Barrel: public surface of the Kalshi read-only data client.
//
// Honest caveat: this client reads PUBLIC market data only. It performs no
// authentication, places no orders, touches no orderbook, and cannot trade.
// See README.md for the full disclaimer.

export { KalshiClient, KalshiHttpError } from "./client";
export type { KalshiClientOptions } from "./types-internal";

export { getSeries, BTC_15M_SERIES } from "./series";
export {
  getOpenMarkets,
  getMarket,
  getSettledMarkets,
  listMarkets,
  seriesOfTicker,
} from "./markets";
export type { MarketStatus } from "./markets";

export { getCandlesticks, getHistoricalCutoff } from "./candlesticks";

export { getResolution, getResolutions, toResolution } from "./resolve";

export type {
  KalshiSeries,
  KalshiSeriesResponse,
  KalshiMarket,
  KalshiMarketListResponse,
  KalshiMarketResponse,
  KalshiCandlestick,
  KalshiCandlestickPrice,
  KalshiCandlestickResponse,
  KalshiHistoricalCutoff,
  Resolution,
  ResolutionOutcome,
  CandlestickInterval,
} from "./types";
