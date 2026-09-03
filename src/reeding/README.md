# Reeding Runtime — Runtime Package README

This directory is the **runtime package** for the Reeding Edge scheduler: the GitHub Actions workflow, the storage adapter, and the scheduled entrypoint. It is the Lane C deliverable.

Everything here is **net-new** and the scheduler is **DISABLED by default**. Nothing is provisioned, deployed, or secret-added.

## Files
- `.github/workflows/reeding-edge.yml` — the GitHub Actions workflow. `workflow_dispatch` only; the `schedule: cron */15 * * * *` block is commented out with an "ENABLE AFTER APPROVAL" note.
- `src/reeding/storage/vercel-blob-adapter.ts` — `VercelBlobAdapter` implementing the `StorageAdapter` interface against `@vercel/blob`. Append-only / content-hashed keys (re-writes never clobber), idempotent `put`, `get`, `list`, and `appendSettlement`.
- `src/reeding/collect.js` — the scheduled entrypoint run by the workflow (`node src/reeding/collect.js`). Idempotent on `assay_id`. Safe no-op with no token / no `@vercel/blob` installed.
- `ops/briefs/REEDING_RUNTIME_APPROVALS.md` — the exact 3-item approval gate for Andrew.

## How to enable (literal, step by step)
1. **Create the Vercel Blob store.** Andrew signs into Vercel → Storage → create a Blob store (e.g. `reeding`). Free Hobby tier. Copy the read/write token it gives you.
2. **Add the repo secret.** Open the repo on GitHub → Settings → Secrets and variables → Actions → New repository secret. Name: `BLOB_READ_WRITE_TOKEN`. Value: the token from step 1.
3. **Add the dependency + build.** Once Lane A (market discovery), Lane B (canonical `StorageAdapter` interface), and the engine lane (PRE verdict) have merged, add `@vercel/blob` to the project and a build step so `collect.js` can `require` the compiled adapter. Until then `collect.js` is a guarded no-op.
4. **Smoke test manually.** GitHub Actions tab → "Reeding Edge" → Run workflow → keep `dry_run=true` → confirm the run exits 0 and logs `storage: skipped`.
5. **Go live (Andrew's approval).** Uncomment the `schedule:` block in `.github/workflows/reeding-edge.yml`, add `schedule:` under `on:`, and set the `dry_run` default to `false`.

## Safety guarantees (while disabled)
- A manual run with no token and no `@vercel/blob` exits 0 (no-op).
- The workflow has `permissions: contents: read` only and a `concurrency` group so runs don't overlap.
- Nothing here touches `index.html`, `analysis.json`, `assets/`, existing `ops/` files, master, or the personal bet ledger.
