// Candlestick helpers. Auto-routes between the live and historical endpoints
// based on the historical cutoff.
//
// Live (active markets):
//   GET /series/{series_ticker}/markets/{ticker}/candlesticks?start_ts=&end_ts=&period_interval=
// Historical (settled/archived, older than cutoff):
//   GET /historical/markets/{ticker}/candlesticks?start_ts=&end_ts=&period_interval=
//
// Kalshi accepts period_interval of 1, 60, or 1440 (1 min / 1 hr / 1 day).
// The 1-minute series has a maximum of 5000 candles per request — this helper
// chunks wide ranges into safe windows so callers don't hit the 5000 cap.

import { KalshiClient } from "./client";
import type {
  CandlestickInterval,
  KalshiCandlestick,
  KalshiCandlestickResponse,
  KalshiHistoricalCutoff,
} from "./types";
import { seriesOfTicker } from "./markets";

const MAX_CANDLES_PER_REQUEST = 5000;

/**
 * Get the historical cutoff — the boundary between "live" and "historical"
 * data on Kalshi's side. Markets settled before this timestamp must be read
 * from the /historical/... endpoints.
 */
export async function getHistoricalCutoff(client: KalshiClient): Promise<KalshiHistoricalCutoff> {
  return client.get<KalshiHistoricalCutoff>("historical/cutoff");
}

function toSeconds(ts: number | Date): number {
  return ts instanceof Date ? Math.floor(ts.getTime() / 1000) : Math.floor(ts);
}

/** Build safe [start,end] second-epoch windows each <= MAX_CANDLES_PER_REQUEST * interval. */
function chunkRange(startSec: number, endSec: number, interval: number): Array<[number, number]> {
  const total = endSec - startSec;
  const perWindow = MAX_CANDLES_PER_REQUEST * interval;
  if (total <= perWindow) return [[startSec, endSec]];
  const windows: Array<[number, number]> = [];
  let cursor = startSec;
  while (cursor < endSec) {
    const winEnd = Math.min(cursor + perWindow, endSec);
    windows.push([cursor, winEnd]);
    cursor = winEnd;
  }
  return windows;
}

/**
 * Fetch candlesticks for a market between `start` and `end` (second-epoch
 * numbers or Date objects), at the given interval (1, 60, or 1440 seconds).
 *
 * Auto-routes to the historical endpoint when `end` predates the historical
 * cutoff, and falls back to the historical endpoint if the live endpoint 404s
 * (which happens for markets that have just settled). Wide ranges are chunked
 * to stay under Kalshi's 5000-candles-per-request cap.
 */
export async function getCandlesticks(
  client: KalshiClient,
  ticker: string,
  start: number | Date,
  end: number | Date,
  interval: CandlestickInterval = 1,
): Promise<KalshiCandlestick[]> {
  if (![1, 60, 1440].includes(interval)) {
    throw new Error(`interval must be 1, 60, or 1440 (got ${interval})`);
  }
  const startSec = toSeconds(start);
  const endSec = toSeconds(end);
  if (endSec <= startSec) return [];

  const cutoff = await getHistoricalCutoff(client);
  const cutoffSec = cutoff.market_settled_ts ? Math.floor(Date.parse(cutoff.market_settled_ts) / 1000) : 0;
  const fullyHistorical = cutoffSec > 0 && endSec < cutoffSec;
  const seriesTicker = seriesOfTicker(ticker);

  const windows = chunkRange(startSec, endSec, interval);
  const out: KalshiCandlestick[] = [];
  for (const [wStart, wEnd] of windows) {
    const candles = await fetchWindow(client, ticker, seriesTicker, wStart, wEnd, interval, fullyHistorical);
    out.push(...candles);
  }
  // Dedup by end_period_ts in case windows overlap, keep chronological order.
  const seen = new Set<number>();
  return out
    .filter((c) => {
      if (c.end_period_ts == null || seen.has(c.end_period_ts)) return false;
      seen.add(c.end_period_ts);
      return true;
    })
    .sort((a, b) => a.end_period_ts - b.end_period_ts);
}

async function fetchWindow(
  client: KalshiClient,
  ticker: string,
  seriesTicker: string,
  startSec: number,
  endSec: number,
  interval: number,
  fullyHistorical: boolean,
): Promise<KalshiCandlestick[]> {
  const query = { start_ts: startSec, end_ts: endSec, period_interval: interval };
  const livePath = `series/${seriesTicker}/markets/${ticker}/candlesticks`;
  const histPath = `historical/markets/${ticker}/candlesticks`;

  if (fullyHistorical) {
    return tryFetchHistorical(client, histPath, query);
  }
  // Try the live endpoint first; fall back to historical on 404 (which happens
  // for markets that have just settled and been archived off the live path).
  try {
    const res = await client.get<KalshiCandlestickResponse>(livePath, query);
    return res.candlesticks ?? [];
  } catch (err) {
    if (err instanceof Error && /HTTP 404/.test(err.message)) {
      return tryFetchHistorical(client, histPath, query);
    }
    throw err;
  }
}

/** Fetch the historical endpoint; a 404 here means the market has no archived
 *  candlesticks at all, so we return an empty array rather than throwing. */
async function tryFetchHistorical(
  client: KalshiClient,
  path: string,
  query: Record<string, string | number | undefined | null>,
): Promise<KalshiCandlestick[]> {
  try {
    const res = await client.get<KalshiCandlestickResponse>(path, query);
    return res.candlesticks ?? [];
  } catch (err) {
    if (err instanceof Error && /HTTP 404/.test(err.message)) return [];
    throw err;
  }
}
