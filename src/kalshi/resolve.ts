// Resolution helpers. Derive a clean Up/Down outcome from a market's `result`
// field + settlement price.
//
// KXBTC15M markets are binary: rules_primary says "if the simple average of
// the 60 seconds of BRTI before close is at least the target price, the market
// resolves to Yes." So:
//   result === "yes" -> the price ended UP vs the target  -> outcome "up"
//   result === "no"  -> the price ended DOWN vs the target -> outcome "down"
//   result === ""    -> not yet resolved                   -> outcome null

import { KalshiClient } from "./client";
import type { KalshiMarket, Resolution, ResolutionOutcome } from "./types";
import { getMarket } from "./markets";

/** Build a Resolution from a fetched market object. Exported for tests. */
export function toResolution(market: KalshiMarket): Resolution {
  const result = market.result ?? "";
  const resolved = result === "yes" || result === "no";
  const outcome: ResolutionOutcome = result === "yes" ? "up" : result === "no" ? "down" : null;
  const settlementPrice = parseNum(market.expiration_value);
  const targetPrice = market.floor_strike != null ? market.floor_strike : null;
  return {
    ticker: market.ticker,
    resolved,
    outcome,
    settlement_price: settlementPrice,
    target_price: targetPrice,
    occurrence_time: market.occurrence_datetime ?? null,
    close_time: market.close_time ?? null,
    result,
  };
}

function parseNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Get the resolution state of a single market by ticker.
 * Returns `resolved: false` while the market is still open (result === "").
 */
export async function getResolution(client: KalshiClient, ticker: string): Promise<Resolution | null> {
  const market = await getMarket(client, ticker);
  if (!market) return null;
  return toResolution(market);
}

/**
 * Resolve many tickers in a single pass (one fetch per market, throttled by
 * the client). Markets that 404 are returned as null in the same position.
 */
export async function getResolutions(client: KalshiClient, tickers: string[]): Promise<Array<Resolution | null>> {
  return Promise.all(tickers.map((t) => getResolution(client, t)));
}
