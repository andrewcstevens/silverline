// Kalshi public market-data API — shared types.
// These describe the shapes returned by Kalshi's PUBLIC (no-auth) v2 endpoints.
// They are intentionally tolerant (most fields optional) so the client does not
// break when Kalshi adds new fields to a response.

/** A series (e.g. KXBTC15M = Bitcoin price up/down, 15-minute frequency). */
export interface KalshiSeries {
  ticker: string;
  title: string;
  category?: string;
  frequency?: string;
  contract_terms_url?: string;
  contract_url?: string;
  fee_type?: string;
  fee_multiplier?: number;
  settlement_sources?: Array<{ name?: string; url?: string }>;
  tags?: string[];
  [key: string]: unknown;
}

export interface KalshiSeriesResponse {
  series: KalshiSeries;
}

/** A single binary market within a series. */
export interface KalshiMarket {
  ticker: string;
  event_ticker?: string;
  status?: string; // "active" | "finalized" | "closed" | ...
  market_type?: string; // "binary"
  result?: string; // "" while open, then "yes" | "no"
  floor_strike?: number | null; // target price (the strike)
  expiration_value?: string | null; // settlement price once resolved
  occurrence_datetime?: string | null;
  close_time?: string | null;
  expected_expiration_time?: string | null;
  expiration_time?: string | null;
  open_time?: string | null;
  last_price_dollars?: string | null;
  yes_ask_dollars?: string | null;
  yes_bid_dollars?: string | null;
  no_ask_dollars?: string | null;
  no_bid_dollars?: string | null;
  notional_value_dollars?: string | null;
  rules_primary?: string;
  rules_secondary?: string;
  [key: string]: unknown;
}

export interface KalshiMarketListResponse {
  cursor: string;
  markets: KalshiMarket[];
}

/** A single market object is returned directly (not wrapped) by GET /markets/{ticker}. */
export type KalshiMarketResponse = KalshiMarket;

export interface KalshiCandlestickPrice {
  close_dollars?: string;
  high_dollars?: string;
  low_dollars?: string;
  mean_dollars?: string;
  open_dollars?: string;
  previous_dollars?: string;
}

export interface KalshiCandlestick {
  end_period_ts: number;
  open_interest_fp?: string;
  volume_fp?: string;
  price?: KalshiCandlestickPrice;
  yes_ask?: KalshiCandlestickPrice;
  yes_bid?: KalshiCandlestickPrice;
  [key: string]: unknown;
}

export interface KalshiCandlestickResponse {
  candlesticks: KalshiCandlestick[];
  ticker?: string;
}

export interface KalshiHistoricalCutoff {
  market_positions_last_updated_ts?: string;
  market_settled_ts?: string;
  orders_updated_ts?: string;
  trades_created_ts?: string;
}

/** Outcome of a resolved market: did the underlying end "up" or "down" vs target. */
export type ResolutionOutcome = "up" | "down" | null;

export interface Resolution {
  ticker: string;
  resolved: boolean;
  outcome: ResolutionOutcome;
  settlement_price: number | null;
  target_price: number | null;
  occurrence_time: string | null;
  close_time: string | null;
  /** Raw `result` field from Kalshi ("yes" | "no" | ""). */
  result: string;
}

/** Allowed candlestick period intervals (1 min, 1 hour, 1 day). */
export type CandlestickInterval = 1 | 60 | 1440;
