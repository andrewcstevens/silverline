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

This replaces **only cron step 2** (the one-line `assert`) and **adds steps 6-8**.
Steps 1, 3, 4, 5 remain as-is. The OPS-02 pipeline modules are vendored into the
cron workspace (or merged to master and present in `btc-wizard/ops/`).

```
STEP 1 (unchanged): refresh_analysis.py -> writes candidate
       /home/user/workspace/btc-wizard/frontend/analysis.json

STEP 2 (REPLACED) — validate + snapshot + conditional publish:
  prior_kg = /home/user/workspace/btc-wizard/frontend/analysis.json   # the current live model
  candidate = same path (just written by step 1)                        # treated as the candidate
  python3 ops/validation/run_pipeline.py \
      --candidate <candidate> \
      --prior-known-good <prior_kg> \
      --publish-target <candidate>        # publish-in-place only on pass
      --backup-dir <durable backups dir> \
      --status-path <durable status path>
  # Pipeline semantics (already implemented in OPS-02):
  #   - validate candidate (9 rules) vs prior known-good
  #   - if PASS: snapshot prior known-good -> analysis.<ts>.json + latest-known-good.json;
  #              publish candidate to publish_target; publication_status=passed
  #   - if FAIL: HOLD (do not overwrite prior); publication_status=held; if a publish
  #              target was given, restore latest-known-good there -> restored
  # If outcome != passed -> STOP, skip step 3, go to STEP 7 (alert).

STEP 3 (unchanged): vercel deploy --yes --prod --token $VERCEL_TOKEN

STEP 4 (unchanged): git add analysis.json && commit && git push origin master

STEP 5 (unchanged): curl live analysis.json, print data_end

STEP 6 (NEW) — production smoke test (see §4). If smoke fails -> STEP 8.

STEP 7 (NEW) — write machine-readable status report to backup repo + alert (§7).

STEP 8 (NEW, manual-approval gate) — restore: redeploy prior known-good.
   git checkout latest-known-good.json -> analysis.json ; vercel deploy --prod ;
   git push origin master. Restore is NOT automatic in OPS-03a; it requires
   release-approval (§7) — a human (Andrew) or an approved auto-restore policy.
```

**Non-invasive property:** `refresh_analysis.py` is untouched. The pipeline
wraps its output file. If step 1 fails entirely, the pipeline never runs and the
prior model stays live (the cron already retries step 1 once).

**One subtlety to confirm at implementation (Blocker A):** "publish-in-place"
assumes step 1 wrote the candidate to `frontend/analysis.json` in-place. If step
1 instead writes a temp file and renames, the pipeline should point at the temp
candidate and publish to `frontend/analysis.json`. Confirm the exact write path
before wiring.

## 4. Production smoke-test design

Run **after** step 5 (live verify), read-only against the production URL:

1. **Fetch** `https://silverline.global/analysis.json` (no-cache).
2. **Structural smoke**: run the OPS-02 validator against the **live served**
   file (read-only; never writes). Must pass all 9 rules.
3. **Freshness smoke**: `data_end` of the live model must be **newer than** the
   prior known-good's `data_end` (the daily refresh advanced the data). Rejects
   a stale redeploy or a failed refresh that silently served yesterday's model.
4. **Integrity smoke**: the live served JSON must be byte-identical (after
   normalization) to the candidate that was deployed — catches a deploy that
   served a stale/cached file.
5. **Page smoke**: `curl -I https://silverline.global/` returns 200 and
   `Content-Type: text/html`.
6. **Result**: `smoke_ok = pass` only if all 1-5 pass. On fail → STEP 8 (restore)
   + alert. Smoke never mutates production; it only reads.

The smoke test is a Python function `smoke_test(live_url, prior_known_good_path,
candidate_path) -> (ok, details)` pluggable into `run_pipeline` via the existing
`smoke_test_fn` hook (already implemented and preview-tested in OPS-02).

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
  — failures: <rule:detail> — prior known-good is live — status <link>`.
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

## 10. Report

```
OPS-03a complete
Branch: ops/validation-backups
Commit: (set at commit time)
Files added/modified: ops/OPS-03A_PROPOSAL.md (added)
Production touched: no
Vercel touched: no
Decisions required from Founder: see §9 (6 items)
Blocker: refresh_analysis.py not in repo/sandbox (Blocker A); Vercel env names not enumerable unlinked (Blocker B). Least-invasive next action: read refresh_analysis.py + analysis.py in cron session 471139aa or have Founder paste them; do not guess internals.
```
