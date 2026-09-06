/**
 * Silverline V3 — shared Kalshi relay logic (Vercel serverless).
 *
 * This is the read-only Kalshi public-data relay, lifted from the original
 * plain-Node server.js. It performs public GETs server-side (no Origin header,
 * no auth, no secrets, no trading) and returns JSON.
 *
 * Production hardening (Gate A):
 *  - Structured logging via `log()` — Vercel captures stdout automatically.
 *    Emits one JSON line per fetch attempt / success / failure.
 *  - Graceful degradation: a network failure / timeout / DNS error throws
 *    `KalshiUnreachableError` (not a bare 502). Route handlers translate that
 *    into a structured 503 `{ error: "Kalshi unreachable", retryAfter: 15 }`
 *    so the frontend can render a clean "temporarily unavailable" state
 *    instead of an unhandled error page.
 *
 * NOTE on serverless: the in-memory `cache` Map and `lastReqTs` throttle state
 * are best-effort and per-instance on Vercel. Each warm instance keeps its own
 * 14s cache; cold starts reset it. This is fine for the single-user study tool.
 * The ~6-7 sequential Kalshi GETs in snapshot() (~1-2s network) fit well
 * inside the 10s Vercel Hobby maxDuration set in vercel.json.
 */

const BASE = "https://external-api.kalshi.com/trade-api/v2";
const MIN_INTERVAL_MS = 180; // polite throttle (~5.5 req/s ceiling)
const CACHE_TTL_MS = 14000; // Kalshi itself caches for 15s
const REQ_TIMEOUT_MS = 20000;

let lastReqTs = 0;
const cache = new Map(); // url -> { ts, status, body }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Tiny structured logger. Vercel captures function stdout automatically, so
 * these lines surface in runtime logs with no extra wiring and no new deps.
 * Never throws — logging must not break a request.
 */
export function log(level, msg, extra = {}) {
  try {
    console.log(
      JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra }),
    );
  } catch {
    /* swallow */
  }
}

/**
 * Raised when Kalshi is unreachable (network failure, timeout, DNS, etc.).
 * Route handlers catch this specifically and return a structured 503 instead
 * of a generic 502, so the frontend can degrade gracefully.
 */
export class KalshiUnreachableError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "KalshiUnreachableError";
    if (cause) this.cause = cause;
  }
}

export function slimMarket(m) {
  if (!m) return null;
  return {
    t: m.ticker,
    s: m.status,
    r: m.result ?? "", // "" while open, then "yes" | "no"
    f: m.floor_strike ?? null, // target price (strike)
    v: m.expiration_value ?? null, // settlement price once resolved
    c: m.close_time ?? null, // slot close time
    o: m.open_time ?? null,
    occ: m.occurrence_datetime ?? null,
    yAsk: m.yes_ask_dollars ?? null,
    yBid: m.yes_bid_dollars ?? null,
    nAsk: m.no_ask_dollars ?? null,
    nBid: m.no_bid_dollars ?? null,
    last: m.last_price_dollars ?? null,
    vol: m.volume_24h_fp ?? null,
  };
}

export async function kalshiGet(path, query) {
  const url = new URL(BASE + "/" + path.replace(/^\/+/, ""));
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  const key = url.toString();
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.ts < CACHE_TTL_MS) {
    return { status: hit.status, body: hit.body, cached: true };
  }
  const wait = MIN_INTERVAL_MS - (now - lastReqTs);
  if (wait > 0) await sleep(wait);
  lastReqTs = Date.now();

  let res;
  try {
    log("info", "kalshi fetch attempt", { path });
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
    });
  } catch (err) {
    const reason =
      (err && err.name) || (err && err.message) || String(err);
    log("error", "kalshi fetch failed", { path, reason });
    throw new KalshiUnreachableError(
      "Kalshi unreachable: " + (err && err.message ? err.message : reason),
      reason,
    );
  }
  const body = await res.text();
  cache.set(key, { ts: Date.now(), status: res.status, body });
  log(res.ok ? "info" : "warn", "kalshi fetch done", {
    path,
    status: res.status,
    cached: false,
  });
  return { status: res.status, body, cached: false };
}

export function json(body, status = 200) {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "accept, content-type",
      "cache-control": "no-store",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

/** Apply a `json()` result to a Vercel res object (sets headers + ends). */
export function send(res, out) {
  for (const [k, v] of Object.entries(out.headers || {})) {
    res.setHeader(k, v);
  }
  return res.status(out.status).end(out.body);
}

// Paginate resolved markets (oldest first), slim each row.
// NOTE on the `status` filter: Kalshi resolves markets through a transient
// `settled` state that almost immediately flips to `finalized`. The
// `status=settled` query only catches the few markets still in that
// transient window, so it returns near-zero rows. The status filter does
// NOT accept `finalized` (it returns 0). The robust path is therefore to
// fetch WITHOUT a status filter (which returns finalized markets too) and
// keep only markets that actually carry a `result` of "yes"/"no". This is
// the resolved history the PRE engine grades on.
export async function fetchSettled(pages = 6) {
  const out = [];
  let cursor = "";
  for (let p = 0; p < pages; p++) {
    const q = { series_ticker: "KXBTC15M", limit: 1000 };
    if (cursor) q.cursor = cursor;
    const r = await kalshiGet("markets", q);
    if (r.status !== 200) break;
    let parsed;
    try {
      parsed = JSON.parse(r.body);
    } catch {
      break;
    }
    // Keep only resolved markets (result set to yes/no). Drops initialized /
    // active markets that have no outcome yet. Slim after filtering.
    const rows = (parsed.markets || [])
      .filter((m) => m.result === "yes" || m.result === "no")
      .map(slimMarket)
      .filter(Boolean);
    out.push(...rows);
    cursor = parsed.cursor || "";
    if (!cursor) break;
  }
  // Kalshi returns markets most-recent-first; we preserve that order so
  // snapshot callers can find the latest settlement price as settled[0]. The
  // PRE engine re-sorts chronologically itself (gradeSettled), so no sort here.
  log("info", "kalshi fetchSettled done", { pages, count: out.length });
  return out;
}

// The single endpoint the page loads. Gathers everything in one round-trip
// (the proxy fans out to Kalshi with light throttling + 14s caching).
export async function snapshot() {
  const fetchedAt = new Date().toISOString();
  log("info", "snapshot start");
  const [seriesRes, openRes, cutoffRes] = await Promise.all([
    kalshiGet("series/KXBTC15M"),
    kalshiGet("markets", { series_ticker: "KXBTC15M", status: "open", limit: 10 }),
    kalshiGet("historical/cutoff"),
  ]);

  const series = seriesRes.status === 200 ? JSON.parse(seriesRes.body).series : null;
  const openMarkets =
    openRes.status === 200 ? JSON.parse(openRes.body).markets.map(slimMarket).filter(Boolean) : [];
  const cutoff = cutoffRes.status === 200 ? JSON.parse(cutoffRes.body) : null;

  // Candlesticks for the currently-open market (live contract price series).
  let candles = [];
  const openTicker = openMarkets.find((m) => m.t && m.s === "active")?.t || openMarkets[0]?.t;
  if (openTicker) {
    const end = Math.floor(Date.now() / 1000);
    const start = end - 1800; // last 30 min
    const cr = await kalshiGet(
      `series/KXBTC15M/markets/${openTicker}/candlesticks`,
      { start_ts: start, end_ts: end, period_interval: 1 }
    );
    if (cr.status === 200) {
      try {
        candles = JSON.parse(cr.body).candlesticks || [];
      } catch {
        candles = [];
      }
    }
  }

  // Settled markets for historical base rates (most-recent first).
  const settled = await fetchSettled(3);

  log("info", "snapshot done", {
    openCount: openMarkets.length,
    settledCount: settled.length,
    hasSeries: !!series,
    statuses: {
      series: seriesRes.status,
      open: openRes.status,
      cutoff: cutoffRes.status,
    },
  });

  return {
    fetchedAt,
    source: "Kalshi public · external-api.kalshi.com/trade-api/v2",
    endpointNotes:
      "Read-only public GETs, no auth. Browser fetch is CORS-blocked (403 on Origin); this proxy relays server-side.",
    series: series
      ? {
          ticker: series.ticker,
          title: series.title,
          frequency: series.frequency,
          settlementSources: series.settlement_sources,
          lastUpdatedTs: series.last_updated_ts,
        }
      : null,
    openMarkets,
    openTicker,
    candles: candles.map((c) => ({
      ts: c.end_period_ts,
      close: c.price?.close_dollars ?? null,
      open: c.price?.open_dollars ?? null,
      high: c.price?.high_dollars ?? null,
      low: c.price?.low_dollars ?? null,
    })),
    settledCount: settled.length,
    settledRange:
      settled.length > 1
        ? { newest: settled[0]?.c, oldest: settled[settled.length - 1]?.c }
        : null,
    settled, // slimmed: {t,s,r,f,v,c,o,occ,yAsk,yBid,nAsk,nBid,last,vol}
    cutoff,
    kalshiStatus: {
      series: seriesRes.status,
      open: openRes.status,
      cutoff: cutoffRes.status,
    },
  };
}
