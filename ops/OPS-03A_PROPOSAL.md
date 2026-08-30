# OPS-03A — Durable Backup Storage & Production-Readiness Proposal

**Status:** Proposal (read-only planning). Nothing merged, deployed, or changed.
**Author:** CTO (Perplexity Computer), in safe-mode unattended operation.
**Date:** 2026-08-29
**Branch:** `ops/validation-backups` (artifact committed here; master/production untouched)

---

## 0. Scope and ground truth (inspected, not guessed)

This proposal is built from real inspection of the live system on 2026-08-29:

- **GitHub repo** `andrewcstevens/silverline` (public) — tracked files are exactly:
  `.gitignore`, `analysis.json`, `assets/{favicon.svg, silverline-dark.png, silverline-light.png}`,
  `index.html` (986 lines), plus the `ops/` scaffold from OPS-02.
  **There is no `backend/` and no `frontend/` directory in the repo.** The repo
  root IS the deployed static site. `index.html` loads `analysis.json` via
  `getJSON('analysis.json')` (line 737) and stores the ledger in
  `localStorage` under `LS_KEY = 'btcWizardTracker_v6'` with a seed-merge in
  `loadLS()`.
- **Daily cron `cf411975`** ("BTC Wizard daily model refresh", background=true,
  `cron_hard`, 6:26 AM PT, owner session `471139aa`). Its verbatim task is a
  5-step bash pipeline:
  1. `cd /home/user/workspace/btc-wizard/backend && python3 refresh_analysis.py`
     (api_credentials=[]) — fetches fresh Coinbase BTC-USD 15-min candles,
     recomputes the 3-year edge model, writes
     `/home/user/workspace/btc-wizard/frontend/analysis.json`. Auto-rebuilds
     `candles.parquet` from scratch (~3 min) if missing. Retries once on failure.
  2. **Validate before deploying**: `python3 -c "...assert isinstance(slots,list)
     and len(slots)>=90..."` (api_credentials=[]). If it fails, STOP and do NOT deploy.
  3. `cd /home/user/workspace/btc-wizard/frontend && npx vercel deploy --yes --prod
     --token $VERCEL_TOKEN` (api_credentials=['vercel']) — deploys the linked
     `silverline-global` project.
  4. `cd /home/user/workspace/btc-wizard/frontend && git add analysis.json &&
     git commit -m 'daily model refresh' && git push origin master`
     (api_credentials=['github']).
  5. `curl -sL https://silverline-global.vercel.app/analysis.json` and print
     `data_end` (api_credentials=[]).
- **Vercel project** `silverline-global`, team `etherescape`, latest production
  URL `https://silverline.global`, Node 24.x, all recent deploys Ready in ~1-2s,
  static (no serverless functions, no `vercel.json`, no `/api`). Deployed today
  14h ago (the 6:26 AM cron run).
- **OPS-02 validator** (branch `ops/validation-backups`, not merged) implements 9
  rules and is sanity-checked against the real production `analysis.json` (passes).

### Blocker A (documented, not worked around)

The real refresh scripts — `backend/refresh_analysis.py`, `backend/analysis.py`,
`backend/candles.parquet` — live in the **cron session's persistent workspace**
(`/home/user/workspace/btc-wizard/`), which is **not present in this CTO
session's sandbox** and **not committed to the GitHub repo**. I could not read
their source this session, so I do **not** assume their internals (e.g. whether
they already validate, whether the write is atomic, the parquet schema).

**Why this does not block the proposal:** the design below is a **non-invasive
wrapper around step 1's output** (`frontend/analysis.json`), inserted between
the existing refresh (step 1) and deploy (step 3). It does not modify
`refresh_analysis.py`, `analysis.py`, the ledger, PRE, or any raw Kalshi archive.

**Least-invasive next action to clear Blocker A:** read `refresh_analysis.py`
and `analysis.py` directly in the cron's owning session (`471139aa`) or in a
session that shares the `btc-wizard` workspace, and confirm (a) the candidate
write path is exactly `frontend/analysis.json`, (b) whether the write is atomic
(replace-in-place vs. temp+rename), and (c) whether any validation already runs
inside the script. Until then, the wiring treats step 1 as an opaque producer of
a candidate file at the documented path.

### Blocker B (documented)

`npx vercel env ls` requires a linked codebase; this sandbox isn't linked to
`silverline-global`, so I could not enumerate Vercel environment-variable names
read-only. I confirmed only that the cron uses a `VERCEL_TOKEN` secret. No env
var values were inspected or printed.

---

## 1. Recommended durable private backup destination

**Primary recommendation: a private GitHub repository `andrewcstevens/silverline-backups`.**

Rationale:
- Andrew's stack is GitHub + Vercel with **no backend**. A private repo adds
  durable, versioned, time-stamped storage with **zero new infrastructure** and
  reuses the cron's existing `github` credentials.
- `analysis.json` is **computed aggregate stats** (win rates, edges, CIs, sample
  sizes) — not raw Kalshi records — so committing snapshots of it is compliant
  with the Kalshi Developer Agreement (3.1 permits caching to facilitate
  Andrew's own trading) and with the Silverline rule that `analysis.json` holds
  only derived aggregates.
- Status/failure reports are operational metadata, not market data — safe to
  store in a private repo.

**Backup repo layout:**
```
silverline-backups/
  models/
    analysis.<UTCts>.json          # timestamped model snapshot
    latest-known-good.json         # current known-good (always overwritten)
  status/
    status-<UTCts>.json             # machine-readable pipeline report per run
  failures/
    failure-<UTCts>.json            # copies of status reports where outcome=fail
  ledger/                           # OPT-IN only (see §2, sensitive)
    ledger-<UTCts>.json
```

**Why not other options:**
- Vercel is static; it has no persistent writable storage suitable for backups.
- S3 would work but adds a new secret, a new billing surface, and a new failure
  mode — more than the problem requires today.
- Committing backups to the **public** `silverline` repo is rejected: model
  snapshots and especially ledger exports must stay private.

**Ledger exports (sensitive):** the ledger is Andrew's personal bet history
(7 bets, P&L). Ledger exports go to the **private** backup repo **only**, and
only if Andrew opts in. Treat as personal financial data; never public.

## 2. Retention policy

| Artifact | Cadence | Retention | Location |
|---|---|---|---|
| Model snapshot `analysis.<ts>.json` | every successful run | 30 daily + 12 weekly + 12 monthly | `silverline-backups/models/` |
| `latest-known-good.json` | overwritten each run | always current + 90-day history of priors | `silverline-backups/models/` |
| Known-good (prior versions) | on each promotion | 90 days | `silverline-backups/models/` |
| Failure report `failure-<ts>.json` | on any `fail` outcome | 90 days | `silverline-backups/failures/` |
| Status report `status-<ts>.json` | every run | 90 days | `silverline-backups/status/` |
| Ledger export `ledger-<ts>.json` | opt-in, daily | 90 days | `silverline-backups/ledger/` (private) |

Pruning: a small cleanup step in the cron deletes artifacts older than their
retention window. The live `analysis.json` in the public repo is never pruned
by this system (it is the deploy artifact, managed by the deploy step).

## 3. Exact wiring — daily refresh into validation → snapshot → publish → smoke → restore

This replaces **only cron step 2** (the one-line `assert`), **adds a step 0 to
preserve the prior**, and **adds a pre-production smoke before any prod deploy**.
Steps 1, 4, 5 remain as-is. The OPS-02 pipeline modules are vendored into the
cron workspace (or merged to master and present in `btc-wizard/ops/`).

> `run_pipeline` is a **library function** (`ops.validation.run_pipeline.run(...)`),
> not a CLI. The cron calls it via a small Python heredoc (shown below). A
> `--candidate/--publish-target/...` CLI wrapper is an optional future GitHub
> change for convenience only; it is not required to wire this.

```
STEP 0 (NEW) — preserve the prior known-good BEFORE refresh:
  mkdir -p ops/runtime
  cp /home/user/workspace/btc-wizard/frontend/analysis.json ops/runtime/prior-known-good.json
  # If the file is missing (first run), prior is None -> collapse check is skipped.

STEP 1 (unchanged): refresh_analysis.py -> writes candidate
       /home/user/workspace/btc-wizard/frontend/analysis.json

STEP 2 (REPLACED) — validate candidate vs the preserved prior; snapshot prior on pass:
  python3 - <<'PY'
  import sys
  from ops.validation import run_pipeline
  from ops.validation.restore import restore as restore_kg
  CAND = "/home/user/workspace/btc-wizard/frontend/analysis.json"
  PRIOR = "/home/user/workspace/btc-wizard/ops/runtime/prior-known-good.json"
  r = run_pipeline.run(
      candidate_path=CAND,
      prior_known_good=PRIOR,
      publish_target=None,          # do NOT publish in-place; candidate already on disk
      backup_dir="<durable backups dir>",
      status_path="<durable status path>",
  )
  if not r.ok:
      # restore the preserved prior back onto the candidate path so disk holds known-good
      restore_kg(CAND, backup_dir="<durable backups dir>", snapshot=PRIOR)
      sys.exit(2)   # skip deploy/push; go to STEP 7 (alert)
  # on pass: pipeline already snapshotted PRIOR -> analysis.<ts>.json + latest-known-good.json
  PY
  # Candidate stays at frontend/analysis.json for deploy.

STEP 3 (NEW) — PRE-PRODUCTION smoke (no Vercel deploy yet):
  Serve the candidate locally and smoke it read-only:
    cd frontend && python3 -m http.server 8765 &
    fetch http://localhost:8765/analysis.json
  Run the OPS-02 validator on the served candidate + freshness (data_end newer than
  prior) + integrity (served == candidate on disk) + page 200.
  If smoke fails -> do NOT prod-deploy; prior model stays live (prod untouched);
  go to STEP 7 (alert). No restore needed because prod was never touched.
  If smoke passes -> proceed to STEP 4.

STEP 4 (was 3, unchanged): vercel deploy --yes --prod --token $VERCEL_TOKEN

STEP 5 (was 4, unchanged): git add analysis.json && commit && git push origin master

STEP 6 (was 5 + PRODUCTION smoke): curl live analysis.json; run the production
  smoke (final verification: validator on the LIVE served file + freshness vs
  prior + integrity vs candidate + page 200).
  If production smoke fails -> the bad candidate IS live; trigger the
  manual-approval restore gate (STEP 8) + alert. Do NOT claim "prior known-good
  is live" until restore has actually completed.

STEP 7 (NEW) — write machine-readable status report to backup repo + digest/alert (§7).

STEP 8 (NEW, manual-approval gate) — restore: redeploy prior known-good.
   cp ops/runtime/prior-known-good.json frontend/analysis.json ; vercel deploy --prod ;
   git push origin master. NOT automatic in OPS-03a; requires release-approval (§7).
```

**Why this fixes the ordering problem:** a bad candidate can no longer reach
production. It is blocked at validation (step 2) or at pre-production smoke
(step 3) — both before any `vercel deploy --prod`. Production smoke (step 6) is
only final verification; if it fails, restore is gated and explicitly flagged
as not-yet-restored.

**Non-invasive property:** `refresh_analysis.py` is untouched. The pipeline
wraps its output file and preserves a prior copy (step 0) before refresh runs.

**One subtlety to confirm at implementation (Blocker A):** step 0 assumes the
current live model lives at `frontend/analysis.json` before refresh. If
`refresh_analysis.py` writes a temp file and renames, point step 0 at the live
path and the candidate at the temp path. Confirm the exact write path before wiring.

## 4. Smoke-test design (pre-production gate + production verification)

Smoke runs at **two** points, so a bad candidate never reaches production:

### 4a. Pre-production smoke (gate, before `vercel deploy --prod`)

Serve the candidate locally (no Vercel deploy) and verify read-only:
1. `cd frontend && python3 -m http.server 8765` (or any static server).
2. Fetch `http://localhost:8765/analysis.json`.
3. Run the OPS-02 validator against the served candidate (9 rules).
4. Freshness: candidate `data_end` newer than the preserved prior's `data_end`.
5. Integrity: served JSON byte-identical (normalized) to the candidate on disk.
6. Page: `http://localhost:8765/` returns 200.

If 4a fails -> **do not prod-deploy**; production is untouched (no restore
needed); alert. This is the primary bad-model gate.

### 4b. Production smoke (final verification, after prod deploy + push)

Read-only against the production URL:
1. Fetch `https://silverline.global/analysis.json` (no-cache).
2. Structural: run the OPS-02 validator on the live served file.
3. Freshness: live `data_end` newer than the prior known-good.
4. Integrity: live served JSON == candidate that was deployed.
5. Page: `curl -I https://silverline.global/` -> 200, `text/html`.

If 4b fails -> the bad candidate IS live; trigger the manual-approval restore
(STEP 8) + alert. **Do not claim "prior known-good is live" until restore has
actually completed.**

The smoke function `smoke_test(url, prior_path, candidate_path) -> (ok, details)`
plugs into `run_pipeline` via the existing `smoke_test_fn` hook (already
implemented and preview-tested in OPS-02). Smoke never mutates production; it
only reads.

## 5. Exact future GitHub / Vercel / cron / secret / permission changes

**To implement OPS-03a wiring (validation + backup + smoke + restore gate):**

- **GitHub:**
  - Merge `ops/validation-backups` into `master` **after** COO review (the
    `ops/` validator modules must ship to master so the cron workspace can import
    them). This is the one production-code change; it adds files, modifies none.
  - Create private repo `andrewcstevens/silverline-backups` (new). No new secret
    if it reuses Andrew's GitHub account (cron already has `github` cred).
- **Vercel:** **No changes required for OPS-03a.** The site stays static. (Step 2
  Vercel proxy / serverless functions + a `SILVERLINE_PROXY_TOKEN` env var are a
  separate, later step and are out of scope here.)
- **Cron `cf411975`:** update the task prompt — replace step 2 with the pipeline
  call and add steps 6-8. Keep `background=true`, keep cadence, keep `cron_hard`.
  Optionally add a second, lighter "health digest" cron (see §7).
- **Secrets:** reuse existing `VERCEL_TOKEN` and `github` credentials. No new
  secret is required for OPS-03a unless the backup repo needs a separate deploy
  key (it does not, if it reuses the account).
- **Permissions:** the cron session must be able to import `ops/validation/...`
  from its workspace. Achieve by either (a) merging `ops/` to master and
  vendoring it into `btc-wizard/ops/` in the cron workspace, or (b) having the
  cron clone the modules. Confirm the cron workspace can see `ops/` before go-live.
- **Restore policy:** OPS-03a implements restore as a **manual-approval gate**,
  not automatic production rollback. Auto-rollback is explicitly deferred.

**Out of scope / future (do NOT do in OPS-03a):**
- Vercel serverless `/api/kalshi` proxy + `SILVERLINE_PROXY_TOKEN` (that is
  CTO-02 / Step 2, still paused).
- Automatic production rollback (deferred; requires Founder sign-off).
- Touching `index.html`, the ledger, PRE formulas, or any raw Kalshi archive.

## 6. SYSTEST-02 — end-to-end production-readiness drill

A full rehearsal against a **preview** Vercel deployment (non-production), using
the OPS-02 preview fixtures plus a real refresh-shaped candidate. Runs entirely
in the isolated gitignored workspace; touches no production.

1. Stand up a preview deployment: `vercel deploy` (no `--prod`) from a staging
   copy containing a known-good `analysis.json` + the `ops/` modules.
2. Run the **happy path**: feed a valid candidate through the full pipeline
   (validate → snapshot → publish → smoke → status). Assert: validation passes,
   backup snapshot created in backup repo, `latest-known-good.json` refreshed,
   live preview served the candidate, smoke passes, status report written with
   `publication_status=passed`.
3. Run each **failure path** (from OPS-02 fixtures): malformed, bad probs, bad
   counts, missing slots, broken aux coverage, bad CIs, collapsed, stale,
   raw-Kalshi leak. Assert each is blocked (`held`), production untouched,
   `latest-known-good.json` unchanged, status report records the fired rule,
   alert fires.
4. Run the **smoke-failure path**: deploy a candidate that passes validation but
   fails the freshness/integrity smoke. Assert: restore path is triggered
   (preview redeployed to prior known-good), `publication_status=restored`,
   alert fires, Founder release-approval notification queued.
5. Run the **step-1-failure path**: simulate `refresh_analysis.py` producing no
   candidate. Assert: prior model stays live, no deploy, alert fires with
   "refresh failed".
6. Assert **hard boundaries** held across the drill: master unchanged, no
   production deploy, no Vercel config change, no env var change, no ledger
   change, no raw Kalshi data accessed.

Exit criteria: all paths produce the expected `publication_status` and a correct
status report; no production artifact changed. SYSTEST-02 passes → OPS-03a
wiring is cleared for a Founder-approved production cron update.

## 7. Daily health digest, failure alert, release-approval format

**Machine-readable status report** (already defined in OPS-02 `StatusReport`):
```
{
  "run_utc": "...",
  "candidate_path": "...",
  "candidate_generation_time": "...",        // generated_at or file mtime
  "candidate_generation_time_source": "generated_at" | "file_mtime",
  "data_through_time": "...",
  "validation_outcome": "pass" | "fail",
  "validation_failures": [{"rule": "...", "detail": "..."}],
  "backup_reference": ".../<ts>.json",
  "current_known_good_reference": ".../latest-known-good.json",
  "publication_status": "held" | "passed" | "restored" | "not_attempted"
}
```

**Daily health digest** (one line + status link, produced every run regardless
of outcome; delivered via Perplexity notification — see `custom-notifications`):
- `SILVERLINE daily OK — data_through <ts> — publication_status=passed —
  backup <ref> — status <link>` on success.
- Digest is written even on success so Andrew sees a heartbeat while away.

**Failure alert** (immediate, only on `outcome=fail` or smoke fail):
- Channel: push + email (Perplexity notification).
- Body: `SILVERLINE ALERT — <step> failed — publication_status=<held|restored>
  — failures: <rule:detail> — status <link>`.
- If the failure is a pre-production smoke/validation failure: production is
  untouched and the prior known-good remains live — state this.
- If the failure is a **production** smoke failure: the bad candidate IS live;
  state "production serving bad candidate — restore pending approval" — do NOT
  claim prior known-good is live until restore (STEP 8) has completed.
- Never auto-resolves a real-money ledger bet; never publishes raw Kalshi data.

**Release-approval notification** (only when `publication_status=held` or
`restored` — i.e. the candidate was NOT promoted):
- `SILVERLINE needs approval — candidate <id> held — prior known-good still
  live at silverline.global — review failures at <status link> — reply "promote
  <id>" or "restore" to act.`
- Auto-restore is NOT performed in OPS-03a; this notification is the gate.

## 8. Founder View — what happens while Andrew is away (one page)

> **Silverline runs itself safely while you're out.**
>
> Every morning at 6:26 AM PT, the daily refresh pulls fresh Coinbase BTC
> candles and rebuilds the edge model. Before anything reaches silverline.global,
> the new model now passes a 9-point validator — it must be valid JSON, have all
> 96 fifteen-minute slots, probabilities between 0 and 1, sane confidence
> intervals, and must not have collapsed or gone stale versus yesterday's model.
> It also must contain zero raw Kalshi records.
>
> If the candidate passes: the prior model is snapshotted to a private backup
> repo (with a `latest-known-good.json` always on hand), the new model is
> deployed, and a smoke test checks that the live site actually serves the new
> model and that the data advanced. You get a one-line "daily OK" heartbeat.
>
> If it fails any check: nothing ships. The prior model stays live on
> silverline.global. You get an alert naming the exact rule that failed, and a
> release-approval prompt — you reply to promote or restore. The bot never
> silently swaps a broken model onto the site, and it never auto-resolves a
> real-money ledger bet.
>
> Backups live in a private repo, not the public one. Raw Kalshi data, secrets,
> and the ledger are never exposed. Master, the live ledger, PRE, and Vercel
> config are untouched by this work.
>
> Net: while you're away, the worst case is "site stays on yesterday's model and
> you get a text." That's it.

---

## 9. Decisions required from Founder

1. **Approve the private `silverline-backups` GitHub repo** as the durable
   backup destination (vs. S3 or a Vercel-blob alternative).
2. **Approve merging `ops/validation-backups` → master** so the validator ships
   (the one production-code change; adds files, modifies none).
3. **Confirm ledger exports are opt-in** (default off, private repo only).
4. **Confirm restore stays manual-approval** for OPS-03a (no auto-rollback yet).
5. **Clear Blocker A**: confirm where `refresh_analysis.py` lives and allow it to
   be read in the cron's owning session so the exact candidate write path can be
   verified before wiring.
6. **Approve the SYSTEST-02 drill** plan and a preview (non-prod) Vercel deploy
   for the rehearsal.
