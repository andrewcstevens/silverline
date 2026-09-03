# Lane C Status — Scheduler + Storage Runtime

**Branch:** `feature/reeding-scheduler-storage` (off `master`)
**Date:** 2026-09-02
**Status:** Complete. Committed + pushed. Schedule DISABLED. Nothing provisioned/deployed/secret-added.

## What was built (net-new only)
- `.github/workflows/reeding-edge.yml` — GitHub Actions workflow, `workflow_dispatch` only. `schedule: cron */15 * * * *` is a commented block with an "ENABLE AFTER APPROVAL" note. Steps: checkout → setup Node 20 → `node src/reeding/collect.js`. `permissions: contents: read`; `concurrency` group prevents overlap. Safe to merge while disabled.
- `src/reeding/storage/vercel-blob-adapter.ts` — `VercelBlobAdapter` implementing `StorageAdapter` against `@vercel/blob`. Append-only, content-hashed keys (re-writes never clobber), idempotent `put`, `get`, `list`, `exists`, `appendSettlement` (settlement written as a sibling blob — assay never mutated). Local `StorageAdapter` interface declared here with a TODO to import Lane B's canonical interface once it merges.
- `src/reeding/collect.js` — scheduled entrypoint. Idempotent on `assay_id` (content-hashed key). PLACEHOLDER verdict with TODO markers for Lane A market discovery + PRE engine. Guarded no-op when no token / no `@vercel/blob`: exits 0. Smoke-tested: runs clean with and without token.
- `src/reeding/README.md` — runtime package readme + step-by-step enable instructions.
- `ops/briefs/REEDING_RUNTIME_APPROVALS.md` — the decision-ready approval gate (see below).

## The exact approval gate (3 items)
1. Create a Vercel Blob store (free Hobby tier) — Vercel account action.
2. Add repo secret `BLOB_READ_WRITE_TOKEN` — GitHub Actions secret, needs Andrew.
3. Enable the `schedule:` cron block + go live — needs Andrew approval.

Full literal step-by-step in `ops/briefs/REEDING_RUNTIME_APPROVALS.md`.

## What is NOT done (intentional)
- No Vercel Blob store provisioned. No secret added. Schedule NOT enabled.
- No `@vercel/blob` dependency / no build step (adapter `.ts` is reference-only until a build pipeline exists; `collect.js` is a guarded no-op without it).
- No deployment. No change to `index.html`, `analysis.json`, `assets/`, existing `ops/` files, or `master`.
- Personal bet ledger untouched. PRE engine verdict is a PLACEHOLDER with TODO.

## How to enable
1. Andrew creates Vercel Blob store + copies its token.
2. Andrew adds repo secret `BLOB_READ_WRITE_TOKEN`.
3. After Lane A/B + engine merge: add `@vercel/blob` + build step.
4. Run workflow manually with `dry_run=true` → confirm exit 0.
5. Andrew approves: uncomment `schedule:` block, switch to scheduled, set `dry_run=false`.
