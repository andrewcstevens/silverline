/**
 * Silverline V3 — dormant-ready ledger persistence.
 * ------------------------------------------------
 * Persists the manual bet ledger to Vercel Blob, BUT ONLY if the Founder has
 * added the `BLOB_READ_WRITE_TOKEN` repo secret. With no token present (the
 * default, current state), every function no-ops and falls back to an
 * in-memory array — the site works with zero config and no data leaves the
 * browser. Nothing is wired to actually store anything until the Founder opts
 * in by adding the secret.
 *
 * Implementation note: `@vercel/blob` is imported LAZILY (dynamic import inside
 * the functions, never at module top-level). This means:
 *   - The module imports cleanly even if `@vercel/blob` is not installed
 *     (e.g. in CI without `npm install`), so syntax-check + smoke-import pass.
 *   - The SDK is only loaded at runtime when a token is present.
 *   - If the token exists but the SDK isn't installed, the catch block treats
 *     it as "dormant" and falls back to memory — never an unhandled crash.
 *
 * Vercel installs `@vercel/blob` automatically on deploy because it is listed
 * in package.json `dependencies`; the moment the Founder adds the secret,
 * persistence goes live with no code change.
 */
import { log } from "./kalshi.js";

const BLOB_KEY = "silverline-ledger.json";
const token = () => process.env.BLOB_READ_WRITE_TOKEN;

// In-memory fallback used when no token is configured (the current state) or
// when the SDK is unavailable. Keeps the ledger functional, just non-durable.
let memory = [];

/** True only when the Founder has added the BLOB_READ_WRITE_TOKEN secret. */
export function hasBlob() {
  return !!token();
}

/**
 * Load the ledger. From Vercel Blob if the token is present, else from the
 * in-memory fallback (empty on a cold start). Never throws.
 */
export async function loadLedger() {
  if (!token()) {
    return memory;
  }
  try {
    const { get } = await import("@vercel/blob");
    const blob = await get(BLOB_KEY, { token: token() });
    if (!blob) return [];
    const text = await blob.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    log("warn", "persist load failed (dormant/no-sdk?)", {
      reason: String((err && err.message) || err),
    });
    return memory;
  }
}

/**
 * Save the ledger. Writes to Vercel Blob if the token is present, else no-ops
 * (keeping the in-memory copy). Returns { persisted } so callers can report
 * durability status. Never throws.
 */
export async function saveLedger(ledger) {
  const arr = Array.isArray(ledger) ? ledger : [];
  if (!token()) {
    memory = arr;
    return { persisted: false, reason: "no-token" };
  }
  try {
    const { put } = await import("@vercel/blob");
    await put(BLOB_KEY, JSON.stringify(arr), {
      token: token(),
      contentType: "application/json",
      allowOverwrite: true,
    });
    memory = arr;
    return { persisted: true };
  } catch (err) {
    log("error", "persist save failed", {
      reason: String((err && err.message) || err),
    });
    memory = arr;
    return { persisted: false, reason: "error" };
  }
}
