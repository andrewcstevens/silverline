import { json, send, log } from "./_lib/kalshi.js";
import { loadLedger, saveLedger, hasBlob } from "./_lib/persist.js";

/**
 * /api/ledger — manual bet ledger persistence (dormant-ready).
 *
 * GET  → { ledger: [...], persisted: <bool> }
 * POST → { ok: true, persisted: <bool>, count: <n> }   (body: { ledger: [...] })
 *
 * `persisted` is true only when the Founder has added the BLOB_READ_WRITE_TOKEN
 * repo secret. Until then this route works but stores nothing server-side —
 * the frontend falls back to in-memory. The moment the secret exists, the same
 * code starts reading/writing Vercel Blob with no redeploy of logic required.
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    res.setHeader("access-control-allow-headers", "accept, content-type");
    return res.status(204).end();
  }

  if (req.method === "GET") {
    try {
      const ledger = await loadLedger();
      return send(res, json({ ledger, persisted: hasBlob() }));
    } catch (err) {
      log("error", "ledger load failed", { reason: String(err && err.message) });
      return send(res, json({ error: "ledger load failed", message: String(err && err.message) }, 502));
    }
  }

  if (req.method === "POST") {
    try {
      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch { body = null; }
      }
      const ledger =
        body && Array.isArray(body.ledger) ? body.ledger :
        Array.isArray(body) ? body : [];
      const result = await saveLedger(ledger);
      log("info", "ledger saved", { count: ledger.length, persisted: result.persisted });
      return send(res, json({ ok: true, ...result, count: ledger.length }));
    } catch (err) {
      log("error", "ledger save failed", { reason: String(err && err.message) });
      return send(res, json({ error: "ledger save failed", message: String(err && err.message) }, 502));
    }
  }

  return send(res, json({ error: "method not allowed" }, 405));
}
