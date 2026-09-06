import { snapshot, json, send, KalshiUnreachableError } from "./_lib/kalshi.js";

/**
 * /api/snapshot — the single endpoint the V3 page loads.
 * Fans out to Kalshi (series + open markets + cutoff + candles + settled)
 * and returns one JSON payload with permissive CORS + no-store.
 *
 * Graceful degradation: if Kalshi is unreachable (network/timeout/DNS), the
 * shared relay throws KalshiUnreachableError; we translate that into a
 * structured 503 `{ error: "Kalshi unreachable", retryAfter: 15 }` so the
 * frontend can render a clean "temporarily unavailable" state.
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, OPTIONS");
    res.setHeader("access-control-allow-headers", "accept, content-type");
    return res.status(204).end();
  }
  try {
    const snap = await snapshot();
    return send(res, json(snap));
  } catch (err) {
    const unreachable = err && err.name === KalshiUnreachableError.name;
    const out = unreachable
      ? json({ error: "Kalshi unreachable", retryAfter: 15 }, 503)
      : json({ error: "snapshot failed", message: String(err && err.message) }, 502);
    return send(res, out);
  }
}
