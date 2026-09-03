// Series helpers. Series metadata for KXBTC15M is confirmed public (no auth).

import { KalshiClient } from "./client";
import type { KalshiSeries, KalshiSeriesResponse } from "./types";

/** KXBTC15M = "Bitcoin price up down", fifteen-minute binary markets. */
export const BTC_15M_SERIES = "KXBTC15M";

/**
 * Get metadata for a series (e.g. frequency, settlement sources, contract terms).
 * Confirmed working without auth for KXBTC15M.
 *
 * @example
 *   const series = await getSeries("KXBTC15M");
 *   // series.frequency === "fifteen_min"
 */
export async function getSeries(client: KalshiClient, seriesTicker = BTC_15M_SERIES): Promise<KalshiSeries> {
  const res = await client.get<KalshiSeriesResponse>(`series/${seriesTicker}`);
  return res.series;
}
