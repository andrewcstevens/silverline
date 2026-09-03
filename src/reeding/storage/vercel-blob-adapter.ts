/**
 * Vercel Blob storage adapter for the Reeding Assay/Census store.
 *
 * Implements the `StorageAdapter` interface defined by Lane B
 * (feature/reeding-assay-schema). Until Lane B merges the canonical
 * interface, the local copy below is the contract Lane C codes against;
 * when Lane B lands, delete the `StorageAdapter` declaration here and import
 * it from Lane B's module instead.
 *
 * Semantics:
 *  - Append-only / immutable. `put` never overwrites: it derives a
 *    content-hashed key and, if that exact key already exists, is a no-op
 *    (idempotent). Re-writes produce a NEW versioned key, never clobber.
 *  - Settlement is appended as a separate sibling blob keyed off the assay
 *    id + settlement content hash, so an assay record is never mutated.
 *  - Requires `@vercel/blob` (not yet a dependency — install on enable) and
 *    `BLOB_READ_WRITE_TOKEN` in the environment.
 */
import { createHash } from "node:crypto";
import { del, head, list, put } from "@vercel/blob";

/** Lane B-owned contract (see header). Local copy until Lane B merges. */
export interface StorageAdapter {
  /** Persist a value under a content-hashed, append-only key. Idempotent. */
  put(prefix: string, value: unknown): Promise<{ key: string; url: string; created: boolean }>;
  /** Read a blob by its full key; null if absent. */
  get<T = unknown>(key: string): Promise<T | null>;
  /** List full keys under a prefix. */
  list(prefix?: string): Promise<string[]>;
  /** Append a settlement record to an assay (new sibling blob, never mutates). */
  appendSettlement(assayId: string, settlement: unknown): Promise<{ key: string; created: boolean }>;
  /** Best-effort existence check (used for idempotency short-circuits). */
  exists(key: string): Promise<boolean>;
}

export interface VercelBlobAdapterOptions {
  /** Root prefix in the Blob store (e.g. "reeding/assays"). */
  rootPrefix?: string;
  /** Override the env var name read for the token. */
  tokenEnvVar?: string;
}

const DEFAULT_ROOT_PREFIX = "reeding/assays";

function contentHash(value: unknown): string {
  const body = JSON.stringify(value);
  return createHash("sha256").update(body).digest("hex").slice(0, 16);
}

function joinKey(root: string, parts: string[]): string {
  return [root, ...parts].filter(Boolean).join("/").replace(/\/+/g, "/");
}

export class VercelBlobAdapter implements StorageAdapter {
  private readonly rootPrefix: string;
  private readonly token: string | undefined;

  constructor(opts: VercelBlobAdapterOptions = {}) {
    this.rootPrefix = opts.rootPrefix ?? DEFAULT_ROOT_PREFIX;
    const envVar = opts.tokenEnvVar ?? "BLOB_READ_WRITE_TOKEN";
    this.token = process.env[envVar];
    if (!this.token) {
      // Non-fatal: callers that only read/list will throw on first @vercel/blob
      // call; callers that gate on token presence will no-op. See collect.js.
    }
  }

  get ready(): boolean {
    return Boolean(this.token);
  }

  async put(
    prefix: string,
    value: unknown,
  ): Promise<{ key: string; url: string; created: boolean }> {
    const hash = contentHash(value);
    // Content-hashed key: <root>/<prefix>/<hash>.json — re-writes never clobber.
    const key = joinKey(this.rootPrefix, [prefix, `${hash}.json`]);
    if (await this.exists(key)) {
      // Idempotent: identical content already persisted.
      const url = this.urlForKey(key);
      return { key, url, created: false };
    }
    const blob = await put(key, JSON.stringify(value), {
      access: "public",
      token: this.token,
      addRandomSuffix: false,
    });
    return { key: blob.pathname, url: blob.url, created: true };
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const info = await head(key, { token: this.token }).catch(() => null);
    if (!info) return null;
    const res = await fetch(info.url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  }

  async list(prefix?: string): Promise<string[]> {
    const blobs = await list({
      prefix: joinKey(this.rootPrefix, prefix ? [prefix] : []),
      token: this.token,
    });
    return blobs.blobs.map((b) => b.pathname);
  }

  async appendSettlement(
    assayId: string,
    settlement: unknown,
  ): Promise<{ key: string; created: boolean }> {
    const hash = contentHash(settlement);
    // Sibling blob — the assay record itself is never mutated.
    const key = joinKey(this.rootPrefix, [assayId, `settlement__${hash}.json`]);
    if (await this.exists(key)) {
      return { key, created: false };
    }
    const blob = await put(key, JSON.stringify(settlement), {
      access: "public",
      token: this.token,
      addRandomSuffix: false,
    });
    return { key: blob.pathname, created: true };
  }

  async exists(key: string): Promise<boolean> {
    const info = await head(key, { token: this.token }).catch(() => null);
    return Boolean(info);
  }

  private urlForKey(key: string): string {
    // Best-effort URL for an existing key; not authoritative for public reads.
    return `blob:///${key}`;
  }
}
