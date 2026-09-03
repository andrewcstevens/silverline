/**
 * Reeding Edge — scheduled collection entrypoint.
 *
 * Run by .github/workflows/reeding-edge.yml via `node src/reeding/collect.js`.
 * Designed to be SAFE TO RUN with nothing configured: if @vercel/blob is not
 * installed, no token is present, or the Lane A/Lane B modules are not merged
 * yet, this script logs a clear status and exits 0 (no-op). It never throws,
 * never backfills, and is idempotent on assay_id.
 *
 * Pipeline (once all lanes merge):
 *   1. Discover the current open KXBTC15M market   (Lane A client — TODO)
 *   2. Freeze an Assay (forecast) for the current slot (PRE engine — TODO)
 *   3. Persist the Assay to the Census via the storage adapter (this file)
 *
 * Until then, step 1 and 2 are placeholders with TODO markers, and step 3
 * is a guarded no-op.
 */
"use strict";

import crypto from "node:crypto";

const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
const HAS_TOKEN = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

// ── Placeholder: Lane A market discovery ───────────────────────────────────
// TODO(Lane A): replace with the real Kalshi/Coinbase client that returns the
// currently-open KXBTC15M market + its resolution slot. Until that lands we
// synthesize a deterministic placeholder so the idempotency key is stable
// across re-runs of the same 15-min slot.
function discoverCurrentMarket() {
  const now = new Date();
  const slot = new Date(now);
  slot.setUTCSeconds(0, 0);
  const minute = slot.getUTCMinutes();
  slot.setUTCMinutes(minute - (minute % 15));
  const marketId = "KXBTC15M"; // TODO: real market id from Lane A client
  return {
    marketId,
    openSlotUtc: slot.toISOString(),
    source: "placeholder-lane-a-stub",
  };
}

// ── Placeholder: PRE engine verdict ────────────────────────────────────────
// TODO(PRE engine): replace with the real forecast. For now a PLACEHOLDER
// verdict with a clear TODO — this is NOT a trading signal.
function freezeAssay(market) {
  const assayId = `${market.marketId}__${market.openSlotUtc.replace(/[:.]/g, "-")}`;
  return {
    assay_id: assayId,
    market_id: market.marketId,
    slot_utc: market.openSlotUtc,
    // PLACEHOLDER verdict — DO NOT act on this. Real verdict comes from PRE.
    verdict: { side: "PLACEHOLDER", confidence: null, todo: "wire PRE engine" },
    generated_at: new Date().toISOString(),
    status: "placeholder",
    _todo: "Replace verdict with PRE engine forecast (Lane A/B + engine lane).",
  };
}

// ── Storage write (guarded) ───────────────────────────────────────────────
// The real adapter lives in src/reeding/storage/vercel-blob-adapter.ts and is
// consumed once a build step + `@vercel/blob` are added. Until then we attempt
// a dynamic import of a compiled adapter and fall back to a no-op.
async function persistAssay(assay) {
  let adapter = null;
  try {
    // Prefer a compiled JS build if one exists (added on enable).
    const mod = await import("./storage/vercel-blob-adapter.js");
    const Adapter = mod.VercelBlobAdapter || mod.default?.VercelBlobAdapter;
    if (Adapter) adapter = new Adapter();
  } catch (_err) {
    adapter = null; // @vercel/blob not installed / not built — expected pre-enable
  }

  if (!adapter || !adapter.ready) {
    return { persisted: false, reason: "storage adapter not ready (no token or @vercel/blob not installed)" };
  }

  try {
    // Idempotent on assay_id: content-hashed key => re-runs of the same
    // assay content are a no-op inside the adapter.
    const result = await adapter.put(assay.assay_id, assay);
    return { persisted: true, key: result.key, created: result.created };
  } catch (err) {
    return { persisted: false, reason: String(err && err.message || err) };
  }
}

async function main() {
  const market = discoverCurrentMarket();
  const assay = freezeAssay(market);

  const banner = DRY_RUN ? "[DRY RUN]" : "[LIVE]";
  console.log(`${banner} reeding collect — slot ${assay.slot_utc} (${assay.assay_id})`);

  if (DRY_RUN || !HAS_TOKEN) {
    console.log(`  storage: skipped (dry_run=${DRY_RUN}, token_present=${HAS_TOKEN})`);
    console.log(`  verdict: PLACEHOLDER — ${assay._todo}`);
    console.log("  no-op exit 0 (safe to run while disabled)");
    return;
  }

  const result = await persistAssay(assay);
  console.log(`  storage: persisted=${result.persisted} ${result.reason || ""}`);
  console.log(`  verdict: PLACEHOLDER — ${assay._todo}`);
}

main().catch((err) => {
  // Never fail the workflow on a no-op path; only real, unexpected errors.
  console.error("reeding collect: unexpected error —", String(err && err.message || err));
  process.exitCode = 0; // safe while disabled
});
