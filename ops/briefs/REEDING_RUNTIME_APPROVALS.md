# Reeding Runtime — Approval Gate

**Status:** Decision-ready. All code is committed on `feature/reeding-scheduler-storage`. The schedule is DISABLED. Nothing is provisioned, deployed, or secret-added. No action has been taken that touches the live site, the ledger, or master.

This is the exact, literal approval list for Andrew. Until all three items below are done, the scheduler stays disabled and the runtime is a safe no-op.

---

## The 3 approval items (in order)

### 1. Create a Vercel Blob store  *(Vercel account action — free Hobby tier)*
- Why: the Census (assay + settlement records) is persisted to Vercel Blob. No store exists yet.
- Cost: free within Hobby included usage (storage + ops).
- Action: Andrew logs into Vercel → Storage → create a Blob store named `reeding` (or any name).
- Lane C does NOT do this. Lane C only consumes the store once it exists.

### 2. Add repo secret `BLOB_READ_WRITE_TOKEN`  *(GitHub Actions secret — needs Andrew)*
- Why: the storage adapter (`src/reeding/storage/vercel-blob-adapter.ts`) reads `BLOB_READ_WRITE_TOKEN` from the environment. The workflow passes `secrets.BLOB_READ_WRITE_TOKEN` into the job env.
- Action: Andrew opens the repo on GitHub → Settings → Secrets and variables → Actions → New repository secret → name `BLOB_READ_WRITE_TOKEN` → paste the token from Vercel Blob store dashboard.
- Lane C does NOT add this secret. No secret value is written anywhere in the repo or in this lane.

### 3. Enable the `schedule:` cron block + go live  *(needs Andrew approval)*
- Why: the workflow (`.github/workflows/reeding-edge.yml`) is `workflow_dispatch` only. The `schedule: cron: "*/15 * * * *"` block is commented out with an "ENABLE AFTER APPROVAL" note.
- Action after items 1 + 2 are done and Andrew approves go-live:
  1. Add `npm`/build step + `@vercel/blob` dependency (so the `.ts` adapter compiles and `collect.js` can require it), OR keep `collect.js` as a guarded no-op until Lane A/B + engine land.
  2. Uncomment the `schedule:` block in `.github/workflows/reeding-edge.yml` and add `schedule:` under `on:`.
  3. Set the workflow `dry_run` input default to `"false"` (or run once manually first with the token present to confirm a write lands).
- Lane C has NOT enabled the schedule. Enabling is the explicit go-live approval gate.

---

## What is NOT done (intentional)
- No Vercel Blob store provisioned.
- No `BLOB_READ_WRITE_TOKEN` secret added.
- Schedule NOT enabled (commented out).
- No `@vercel/blob` dependency installed and no build step added (the `.ts` adapter is reference-only until a build pipeline exists; `collect.js` is a guarded no-op without it).
- No deployment. No change to `index.html`, `analysis.json`, `assets/`, existing `ops/` files, or master.
- The personal bet ledger is untouched.
- PRE engine verdict is a PLACEHOLDER with a TODO — engine integration is a separate lane.

## How to enable (step-by-step, no CLI fluency assumed)
1. Andrew creates the Vercel Blob store (item 1) and copies its read/write token.
2. Andrew adds that token as the GitHub repo secret `BLOB_READ_WRITE_TOKEN` (item 2).
3. Once Lane A (market discovery) + Lane B (`StorageAdapter` canonical interface) + the engine lane (PRE verdict) merge, add `@vercel/blob` to the project and a build step so `collect.js` can require the compiled adapter.
4. Run the workflow once manually via GitHub Actions → "Run workflow" with `dry_run=true` → confirm it exits 0.
5. Andrew approves go-live (item 3): uncomment the `schedule:` block, switch to scheduled, set `dry_run` default to `false`.
