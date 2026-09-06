import { json, log, send } from "./_lib/kalshi.js";

/**
 * /api/health — liveness + reachability check.
 *
 * Returns:
 *   { ok: true, version: "<short-sha>", kalshi: <bool>, time: <ISO> }
 *
 * `version` is the short commit SHA when Vercel injects VERCEL_GIT_COMMIT_SHA
 * (git-connected deploys); otherwise a readable constant so the field is
 * always present and meaningful. `kalshi` is a lightweight reachability probe
 * — a single GET to the series endpoint with a 2s budget — so the health
 * check itself stays well under the 10s function limit.
 */
const VERSION =
  (process.env.VERCEL_GIT_COMMIT_SHA || "v3-production").slice(0, 7);
const KALSHI_PROBE_URL =
  "https://external-api.kalshi.com/trade-api/v2/series/KXBTC15M";
const HEALTH_TIMEOUT_MS = 2000;

async function kalshiReachable() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
  try {
    const r = await fetch(KALSHI_PROBE_URL, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, OPTIONS");
    res.setHeader("access-control-allow-headers", "accept, content-type");
    return res.status(204).end();
  }

  const kalshi = await kalshiReachable();
  const time = new Date().toISOString();
  log(kalshi ? "info" : "warn", "health probe", { kalshi, version: VERSION });

  return send(res, json({ ok: true, version: VERSION, kalshi, time }));
}
