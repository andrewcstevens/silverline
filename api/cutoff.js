import { kalshiGet, json, send, KalshiUnreachableError } from "./_lib/kalshi.js";

/**
 * /api/cutoff — read-only pass-through to Kalshi historical/cutoff.
 * Graceful degradation: KalshiUnreachableError → 503 { error, retryAfter }.
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, OPTIONS");
    res.setHeader("access-control-allow-headers", "accept, content-type");
    return res.status(204).end();
  }
  try {
    const r = await kalshiGet("historical/cutoff", {});
    return send(res, { status: r.status, headers: json(r.body).headers, body: r.body });
  } catch (err) {
    const unreachable = err && err.name === KalshiUnreachableError.name;
    const out = unreachable
      ? json({ error: "Kalshi unreachable", retryAfter: 15 }, 503)
      : json({ error: String(err && err.message) }, 502);
    return send(res, out);
  }
}
