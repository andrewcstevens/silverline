// Market helpers. All read-only GETs against the public markets endpoints.

import { KalshiClient } from "./client";
import type {
  KalshiMarket,
  KalshiMarketListResponse,
  KalshiMarketResponse,
} from "./types";

export type MarketStatus = "open" | "closed" | "settled" | "archived";

const MAX_PAGE = 1000; // Kalshi caps page size; 1000 is a safe ceiling.

/**
 * List markets for a series, optionally filtered by status, with cursor
 * pagination fully unwrapped. This is the low-level primitive used by
 * getOpenMarkets / getSettledMarkets.
 *
 * Kalshi returns a `cursor` token; an empty string means "no more pages".
 */
export async function listMarkets(
  client: KalshiClient,
  seriesTicker: string,
  opts: { status?: MarketStatus; limit?: number; maxPages?: number } = {},
): Promise<KalshiMarket[]> {
  const limit = Math.min(opts.limit ?? 50, MAX_PAGE);
  const maxPages = opts.maxPages ?? 50;
  const out: KalshiMarket[] = [];
  let cursor = "";

  for (let page = 0; page < maxPages; page++) {
    const query: Record<string, string | number | undefined | null> = {
      series_ticker: seriesTicker,
      limit,
    };
    if (opts.status) query.status = opts.status;
    if (cursor) query.cursor = cursor;

    const res = await client.get<KalshiMarketListResponse>("markets", query);
    out.push(...res.markets);
    cursor = res.cursor ?? "";
    if (!cursor || res.markets.length === 0) break;
  }
  return out;
}

/**
 * Get currently-open markets for a series (status=open).
 * For KXBTC15M this typically returns the single market currently accepting
 * trades for the next 15-minute window.
 */
export async function getOpenMarkets(client: KalshiClient, seriesTicker: string): Promise<KalshiMarket[]> {
  return listMarkets(client, seriesTicker, { status: "open" });
}

/**
 * Get a single market by ticker (e.g. "KXBTC15M-26SEP022115-15").
 * Returns null if Kalshi responds 404 (market not found / not yet listed).
 *
 * Note: GET /markets/{ticker} wraps the market in `{ market: {...} }`;
 * the list endpoint returns markets bare inside `{ markets: [...] }`.
 * This helper normalizes both to a bare market object.
 */
export async function getMarket(client: KalshiClient, ticker: string): Promise<KalshiMarket | null> {
  try {
    const res = await client.get<KalshiMarketResponse | { market: KalshiMarketResponse }>(`markets/${ticker}`);
    // Unwrap `{ market: ... }` if Kalshi wrapped the single-market response.
    if (res && typeof res === "object" && "market" in res) {
      const inner = (res as { market: KalshiMarketResponse }).market;
      return inner ?? null;
    }
    return res;
  } catch (err) {
    if (err instanceof Error && /HTTP 404/.test(err.message)) return null;
    throw err;
  }
}

/**
 * Get settled markets for a series since an optional ISO timestamp.
 * Settled markets carry a `result` of "yes"/"no" and a settlement price in
 * `expiration_value`. Note: Kalshi paginates these 50 at a time with a cursor;
 * this helper unwraps all pages (up to maxPages).
 *
 * @param since Optional ISO-8601 string; only markets whose close_time is
 *             at/after this time are returned.
 */
export async function getSettledMarkets(
  client: KalshiClient,
  seriesTicker: string,
  since?: string,
): Promise<KalshiMarket[]> {
  const settled = await listMarkets(client, seriesTicker, { status: "settled" });
  if (!since) return settled;
  const sinceMs = Date.parse(since);
  if (Number.isNaN(sinceMs)) return settled;
  return settled.filter((m) => {
    const closeMs = m.close_time ? Date.parse(m.close_time) : NaN;
    return !Number.isNaN(closeMs) && closeMs >= sinceMs;
  });
}

/**
 * Derive the series ticker from a market ticker.
 * KXBTC15M-26SEP022115-15 -> KXBTC15M  (everything before the first "-").
 */
export function seriesOfTicker(ticker: string): string {
  const dash = ticker.indexOf("-");
  return dash === -1 ? ticker : ticker.slice(0, dash);
}
