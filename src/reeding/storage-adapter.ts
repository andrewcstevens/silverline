/**
 * Reeding — StorageAdapter (Lane B, abstract)
 * ------------------------------------------------------------
 * Abstract storage contract for the Census store. Lane B owns the
 * interface; Lane C provides concrete implementations (Vercel Blob,
 * local file, GitHub Artifact, etc.).
 *
 * Invariants every implementation MUST uphold:
 *  - `put` is write-once for an immutable key. Writing to an existing
 *    assay key MUST either no-op (idempotent, same bytes) or throw
 *    `AssayAlreadyExistsError`. It MUST NEVER silently overwrite a
 *    FROZEN record with different bytes.
 *  - `get` returns the frozen bytes verbatim or null/throws if absent.
 *  - `list` is read-only and ordered by insertion is NOT required.
 *  - No mutation, no deletion, no network egress of secrets.
 */

export interface PutOptions {
  /** If true, an existing record under the same key is treated as a
   *  conflict and the call throws `AssayAlreadyExistsError`. If false
   *  (default), a same-bytes re-put is idempotent and succeeds. */
  failIfExisting?: boolean;
}

export interface StorageAdapter {
  /** Persist `data` (UTF-8 JSON string) under `key`. Write-once semantics. */
  put(key: string, data: string, opts?: PutOptions): Promise<void>;

  /** Read the frozen bytes for `key`, or null if absent. */
  get(key: string): Promise<string | null>;

  /** Enumerate storage keys matching an optional `prefix`. */
  list(prefix?: string): Promise<string[]>;
}

/** Thrown when an implementation refuses to overwrite an existing key. */
export class AssayAlreadyExistsError extends Error {
  constructor(public readonly key: string) {
    super(`Assay already exists and is immutable: ${key}`);
    this.name = 'AssayAlreadyExistsError';
  }
}
