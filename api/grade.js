import { fetchSettled, json, send, KalshiUnreachableError, log } from "./_lib/kalshi.js";
import { gradeSettled, DEFAULT_PRE_CONFIG } from "./_lib/pre.js";

/**
 * /api/grade — the REAL PRE engine endpoint.
 *
 * Fetches resolved KXBTC15M markets (reusing the shared kalshi.js data path —
 * the same slimmed settled records /api/snapshot produces) and runs them
 * through the pure PRE engine: per-slot Wilson 95% CI stats, a Bonferroni-
 * corrected significance ladder (UNGRADED / PROVISIONAL / CALIBRATED), and a
 * chronological walk-forward / out-of-sample validation.
 *
 * The engine is pure (no I/O); this route only fetches. The honestVerdict
 * field is the source of truth — if no slot survives calibration AND
 * out-of-sample validation, it says so plainly. BTC 15-min is near a coin
 * flip; the engine is willing to confirm "no edge."
 *
 * Graceful degradation: a KalshiUnreachableError becomes a structured 503
 * `{ error: "Kalshi unreachable", retryAfter: 15 }`.
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, OPTIONS");
    res.setHeader("access-control-allow-headers", "accept, content-type");
    return res.status(204).end();
  }
  try {
    const settled = await fetchSettled(DEFAULT_PRE_CONFIG.fetchPages);
    const report = gradeSettled(settled, DEFAULT_PRE_CONFIG);
    log("info", "grade done", { settledCount: settled.length, survivors: report.verdict?.oosSurvivorCount ?? 0 });
    return send(res, json(report));
  } catch (err) {
    const unreachable = err && err.name === KalshiUnreachableError.name;
    const out = unreachable
      ? json({ error: "Kalshi unreachable", retryAfter: 15 }, 503)
      : json({ error: "grade failed", message: String(err && err.message) }, 502);
    return send(res, out);
  }
}
