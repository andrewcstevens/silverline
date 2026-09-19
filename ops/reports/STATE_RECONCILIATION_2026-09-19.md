# Silverline — State Reconciliation + Takeover Report
**Date:** 2026-09-19 · **Author:** Claude Code (reconciliation session) · **Branch:** `claude/silverline-reconciliation-b9m0fe`
**Status:** Read-only investigation complete. No merges, no production changes, no destructive edits. Awaiting Founder decisions in §11 before further implementation.

> This is the third reconciliation attempt found in this repository (see §2 — `ops/audit-40000ft`'s OPS-07 audit, dated 2026-09-04, is the second). It supersedes OPS-07 where evidence has moved on, and explicitly does not re-litigate what OPS-07 already verified correctly.

---

## 1. Implemented reality — what actually exists and works today

**Production (`master`, live at `silverline-global.vercel.app`):**
- A single static site: `index.html` (987 lines), `analysis.json` (generated artifact, 124KB), `assets/` (logo, favicon), `backend/` (2 Python files), `ops/` (governance docs). **No `package.json`, no build step, no framework.**
- `index.html` has two tabs: **Edge Finder** (live BTC/USD via Coinbase spot, right-now-slot win rate, best historical edge, ranked edge table, weekday/session charts, a Buy Signal panel with Upcoming/Golden Window + stake calculator, an EV calculator) and **My Gains** (a manual bet ledger: `localStorage` key `btcWizardTracker_v6`, 7 seeded bets, add/export/clear, equity curve).
- **The model is 100% Coinbase-proxy, not Kalshi-grounded.** `analysis.json`'s entire schema (`slots`, `top_edges`, `p_up`, `mean_bps`, etc.) is derived from Coinbase 15-min spot-price deltas. It contains no Kalshi field anywhere — no contract price, bid/ask, ticker, or settlement ID.
- The one real Kalshi dataset in the repo (`backend/kalshi_backfill.py`, 24,415 real settled `KXBTC15M` markets, Dec 2025–Aug 2026) is a disconnected side script, not wired into the live model. It measured a base rate of **49.93% yes / 50.07% no** — essentially a coin flip, with no time-of-day breakdown. This is in tension with the live UI's claim of a "significant" 54.1% edge at the 04:30 ET slot, since the only real-market data point available doesn't corroborate a persistent time-of-day mispricing.
- **The pipeline that actually generates `analysis.json`** (`refresh_analysis.py`, `analysis.py`, `candles.parquet`) **is still not in this repository** — confirmed absent from `backend/` as of this report. This is "Blocker A," open since 2026-08-30, unchanged. It lives only in an external daily-cron sandbox session with no backup and no revision history. This remains the single largest fragility in the project.
- Production is **not deployed from Git** — Vercel deploys are manual CLI folder uploads with no commit SHA linkage. Pushing to `master` does not change the live site.
- `silverline.global` (custom domain) is **not resolving** (open finding since 2026-09-04, `ops/briefs/DOMAIN_STATUS_FINDING.md`) — the canonical live URL is currently `https://silverline-global.vercel.app`.
- **No Present/Prime concept, no hover/tap explanation-bubble mechanism, and no Reeded Edge concept exist anywhere in the current UI.** The only "explanation" affordance is stock Chart.js hover tooltips on chart bars. PT/ET dual-timezone rendering **does** already exist and works (`etToPt()`, DST-aware via `Intl.DateTimeFormat`) — this is reusable.

---

## 2. Repository governance — who actually governs what, and since when

There is **no `CLAUDE.md`** anywhere in this repository, on any branch. Governance lives in `ops/`:

| Document | Governs | Last substantive update | Current? |
|---|---|---|---|
| `ops/COMMAND_CENTER.md` | Cross-cutting status / Founder Inbox | 2026-08-30 (commit `b5a28a1`) | **Stale** — unchanged since; doesn't reflect OPS-05/06/07 or this Brand Sprint |
| `ops/DECISIONS.md` | Standing production-safety rules (D-001–D-007) | 2026-08-30 | **Still authoritative** — these are standing rules, not stale facts |
| `ops/WORK_QUEUE.md` | Task queue | 2026-08-30 | **Stale** — doesn't reflect PRE-0/REEDING-01/CTO-02 completion recorded on unmerged branches |
| `ops/INCIDENTS.md` | Incident log | 2026-08-30 | Current (empty; no incidents) |
| `backend/README.md` | Model/data integrity, Blocker A | 2026-09-04 | Current, accurate |

**A second, more complete governance layer exists only on `ops/audit-40000ft`** (unmerged, 9 commits ahead of master, sharing a fork point *before* master's own ops docs even existed). It contains:
- `ops/briefs/COO_COMMAND_ORCHESTRATION.md` (OPS-05)
- `ops/briefs/REEDING_EDGE_DISCOVERY.md` (OPS-06, 2026-09-02)
- `ops/reports/SILVERLINE_AUDIT_40000FT.md` (OPS-07, 2026-09-04) — **this is itself a prior reconciliation report.** Its verdict: "Not lost. Not clean yet. Recoverable." It already identified the exact fragmentation problem described in this handoff: **two concurrent COO command threads operating on the repo independently**, and **two unreconciled creative directions** (`design/v3-concept`'s "The Field" vs. `feature/silverline-creative-system`'s Creative Constitution). It left a 3-decision-gate 48-hour launch plan awaiting Founder sign-off. **None of those three decisions were ever answered** — this branch has sat unmerged and unresolved for two weeks.

**Bottom line:** there is no single master document. `master`'s ops docs are the most "official" but are the *least* current; `ops/audit-40000ft` is the most current and complete but was never merged or acted on. This reconciliation report is now a third layer sitting on top of both. §11 proposes ending this pattern.

---

## 3. Branch map — what's on each branch and whether it's safe to consolidate

*(16 branches verified via `git fetch --prune`; all inspection read-only, no branches left checked out.)*

**Cleanly additive, safe to merge as-is (real code + tests, zero path conflicts with master):**
| Branch | Contents | Notes |
|---|---|---|
| `ops/audit-40000ft` | Governance docs (superset of `ops/command-center`) | Docs only. Most complete governance snapshot. |
| `ops/command-center` | Subset of `ops/audit-40000ft` | Fully redundant — superseded, can be deleted once audit-40000ft is merged |
| `ops/safe-mode-runbook` | `ops/SAFE_MODE_RUNBOOK.md` | Doc only |
| `feature/pre-0-guardrails` | `pre/guardrail.py` + 13 real passing tests | Price-aware signal guardrail logic, isolated, untested against live data |
| `feature/kalshi-proxy` | `api/kalshi.py`, `api/kalshi_lib.py` (195L) + 21 real tests | Public-market-data-only proxy (D-005 compliant). Live smoke test blocked by Vercel team SSO — built but never verified end-to-end |
| `feature/ecd-copy-operations` | `docs/{VOICE,NOMENCLATURE,PROHIBITED_LANGUAGE,COPY_STATES}.md` | Docs only; check against `feature/silverline-creative-system`'s more-developed nomenclature before treating as canonical |

**Needs light, safe reconciliation:**
| Branch | Issue | Fix |
|---|---|---|
| `ops/validation-backups` | Real code: `ops/validation/{validator,backup,restore}.py`, `ops/test/run_preview_tests.py` (self-contained runner). One `.gitignore` line conflict with `kalshi-backfill`'s addition. | Trivial hand-merge |
| `feature/kalshi-backfill` | Master's own rewrite of `backend/README.md` **silently dropped** the branch's `docs/KALSHI_BUILD_SPEC.md` (142L, endpoint/pagination detail) and `.gitignore` protections against committing raw Kalshi records/`.env` secrets. | Pull forward `docs/KALSHI_BUILD_SPEC.md` + the `.gitignore` secret exclusions — **master currently has no protection against accidentally committing raw Kalshi data or `.env` files.** This is a real, live gap. |

**Design / proposal — no code impact, defines competing product language:**
| Branch | Contents | Verdict |
|---|---|---|
| `design/v3-concept` | `index.html` (522L) — a scroll-driven "The Field" narrative mockup. Defines **Assay** (immutable forecast-to-outcome record), **Census** (private prediction↔outcome log), **Reeding Grade** (PROVISIONAL/CALIBRATED), **P&L**. "Reeded edge" appears only as a CSS scroll-bar metaphor (`.reed`), not a financial term. | Pure vision doc, zero backend. Terminology now **superseded by the Brand Sprint** (§9) but the informal Assay/Census/Grade concepts map closely onto real code in `integration/reeding-edge-foundation` (below). |
| `feature/silverline-creative-system` | `docs/SILVERLINE_CREATIVE_CONSTITUTION.md` (governing principle: *"Silverline may name the experience. It may not rename the truth."*), `docs/SILVERLINE_NOMENCLATURE.md` (approved/candidate/prohibited registry — defines Reeding, Watch, Golden Window, Signal Grain, etc.), three fixture-only art-direction studies (**Observatory** — recommended, astronomical/cyan; **Mint** — coin/numismatic, Struck/Hallmark/Dated; **Signal Room** — terminal grid). | Doc + fixture mockups only, explicitly gated behind Founder route selection that never happened. Its Nomenclature registry **does not overlap** with Cast/Mintage/Purity/Prospect/Proof — those are new in the Sept 18 Brand Sprint. |
| `v3/production` | **Real, working infrastructure**: `api/_lib/pre.js` (324L) — Wilson 95% CI, Bonferroni-corrected significance ladder (UNGRADED/PROVISIONAL/CALIBRATED), walk-forward OOS validation. Plus `api/_lib/kalshi.js`, `persist.js` (dormant Vercel Blob ledger), full `index.html` frontend, CI workflow, rollback docs. | **Structural anomaly: this is a git-orphan commit with zero parents** — not actually built on `ops/audit-40000ft` despite that being the stated relationship. "Gate A/D" (its own commit message's term) is undefined anywhere else in the repo. The statistical engine logic here is genuinely reusable; the branch's isolation and the undefined "Gate A/D" framework need Andrew's context before this can be trusted as a base. |

**Reeding Edge Node/TS cluster — real, tested, but never actually wired together:**
| Branch | Contents |
|---|---|
| `feature/reeding-kalshi-client` | Real, tested (36/36 passing, mocked) TypeScript client for Kalshi's public no-auth API — throttled, backoff, cursor pagination, candlestick chunking. Read-only by design. |
| `feature/reeding-assay-schema` | `assay.schema.json` (JSON-Schema 2020-12), `census.ts` (append-only, write-once/settle-once storage discipline, 20 tests), `grade.ts` (Wilson-CI + Bonferroni ladder, same statistical rigor as `v3/production`'s independently-written `pre.js` — **two parallel implementations of the same logic exist and were never reconciled**). 38/38 tests passing. |
| `feature/reeding-scheduler-storage` | GitHub Action (cron **disabled**, gated on Andrew creating a Vercel Blob store + approving go-live — never granted), `vercel-blob-adapter.ts` (real, but declares its **own incompatible `StorageAdapter` interface**, never reconciled with the schema branch's canonical one — the code's own comment admits this was left undone). |
| `feature/reeding-01-motion` | `motion/prototype.html` — pure-CSS motion/design-language study of the *existing* dashboard (not the canvas thing below). |
| `integration/reeding-edge-foundation` | All three lanes above, merged as files (41 files, +7462 lines) but **never actually integrated at the code level**. The one thing that would run in production, `src/reeding/collect.js`, is an explicit stub with a hardcoded `verdict: {side: "PLACEHOLDER", todo: "wire PRE engine"}` — it calls none of the real Kalshi client or Census/Grade logic sitting right next to it. Root `npm test` **fails** (Jest vs. `node:test` runner mismatch across the two lanes, a known never-fixed seam). Nothing here ever ran against real data. |

**Not requested but discovered as load-bearing:** `motion/reeding-field.html` on `feature/silverline-creative-system` (commit `ba79196`) is a *separate*, real `<canvas>` visualization (replayed BTC candles as a glowing depth-graded "trace" with a PRE Field State readout) — distinct from the CSS-only motion study above, and not merged anywhere.

---

## 4. Latest product reality — what the Sept 18 Brand Sprint adds/changes/supersedes

The Brand Sprint (`Silverline_Brand_Sprint_2026-09-18.zip`, now copied into `ops/brand/` on this branch — see §10) is the **first place in this project where Cast, Mintage, Purity, Prospect, Proof, and P/L are defined as a unified system.** None of the in-repo branches (§3) had assembled this vocabulary before. It locks:

- **PROSPECT → PROOF → P/L** as the top-level architecture (Present/Prime under Prospect, single shared component).
- **Reeded Edge** as system-wide evidentiary architecture (not a page), with **Reality/Relevance/Receipt** as its three dimensions.
- **Prediction**, **Edge** as locked metric definitions; **Purity** (0–1000, formula NOT canonical) and **Cast**/**Mintage** as strong-but-unlocked working terms.
- Explicit **rejection** of: Treasury (→ use P/L), Census, Grade, Luster (as a metric), Strike (as prediction/accuracy), Reeding-as-methodology, Assay, R³ Protocol/Assay.
- Visual direction: cinematic editorial financial instrument, reeded/coin-edge material motif (literally realized in `v3-prospect-concept.jpeg`'s concentric-ring topographic dial).

This **supersedes** the naming from `design/v3-concept` (Assay/Census/Grade/Reeding-as-product-name) and is a natural continuation of `feature/silverline-creative-system`'s Mint study (Struck/Hallmark/Dated → the same coin metaphor, now resolved into Cast/Mintage). It does **not** override engineering reality — the sprint's own `README.md` says existing ops docs "should be updated carefully rather than replaced," and its own brand doc states plainly: *"Coinbase BTC-USD spot behavior is proxy evidence, not proof of edge on actual Kalshi contracts"* — i.e., the sprint authors already knew about the Coinbase-proxy problem and did not claim to have solved it.

---

## 5. Conflict register

1. **Reeded Edge vs. Reeding-as-methodology.** The Brand Sprint *keeps* "Reeded Edge" (the evidentiary architecture) but *rejects* "Reeding" as a product/methodology name. Multiple branches (`design/v3-concept`, `feature/silverline-creative-system`'s Nomenclature, the entire `*reeding*` branch cluster, `integration/reeding-edge-foundation`) use "Reeding" as the product noun throughout directory names, doc titles, and code (`src/reeding/`). **This is a naming layer only** — do not let it block reuse of the underlying code, but do not let "Reeding" leak into new UI copy.
2. **Assay/Census/Grade are explicitly rejected names but sit on real, well-tested logic in two places** (`feature/reeding-assay-schema`'s `grade.ts` and `v3/production`'s independently-written `pre.js`) that never reference each other. Both implement Wilson-CI + Bonferroni-corrected grading. This needs one consolidated implementation under new, Founder-approved naming (HAMMER_OUT item 7 — "historical performance metric label" — is exactly this open question).
3. **Model integrity claim mismatch.** OPS-07 (2026-09-04) states the Kalshi public API "eliminates old Coinbase-spot-proxy workaround" — true only in the sense that a real data *source* now exists and was proven reachable; it does **not** mean production switched. `analysis.json` today is still 100% Coinbase-derived. Any status communication should not imply this gap is closed.
4. **Scientific-integrity flag, not just a data-source gap.** The one real Kalshi settlement sample (24,415 markets, ~50/50) sits in tension with the live UI's "significant edge" claims, which are Coinbase-backtest artifacts. Per Brand Sprint §8 and the operating principle in this handoff, dramatic probabilities must not ship "merely because they look good" — Proof needs to be built against real settlement outcomes before any Purity/Edge number is presented as validated.
5. **Governance fragmentation, unresolved for two weeks.** `master`'s ops docs (Aug 30) vs. `ops/audit-40000ft`'s more current OPS-07 audit (Sep 4) vs. this report (Sep 19) — three layers, none merged into one source of truth. OPS-07's own 3-decision-gate launch plan (creative direction, thread consolidation, MVP scope) was never answered.
6. **`v3/production` is structurally orphaned** (no git parent) and references an undefined "Gate A/D" framework. Its code is worth keeping; its provenance needs Andrew's memory, since nothing in-repo explains it.
7. **Two incompatible `StorageAdapter` interfaces** and **two incompatible test runners** coexist unreconciled inside `integration/reeding-edge-foundation`, breaking its own root test suite.
8. **`feature/kalshi-backfill`'s `.gitignore` secrets protection was dropped** when master rewrote its README — master currently has no guard against committing raw Kalshi archives or `.env` files (violates the spirit of D-001).

---

## 6. Model / data integrity — the honest state

- **Actual model source is still not version-controlled.** Blocker A (backend/README.md, opened 2026-08-30) is unchanged: `refresh_analysis.py`, `analysis.py`, `candles.parquet` exist only in an external cron sandbox. This remains the top risk to the entire project — if that sandbox is lost, the daily refresh has no source to rebuild from. The documented recovery path (`ops/briefs/BLOCKER_A_PIPELINE_RECOVERY.md`) requires one message from Andrew into that specific cron session; nothing here can substitute for it.
- **Generated vs. source:** `analysis.json` is confirmed a build artifact (regenerated daily by the missing pipeline). It must never be hand-edited — this rule is intact and unviolated in this session.
- **Coinbase-proxy vs. Kalshi-grounded:** the live model is entirely Coinbase-spot-price backtesting. The only real Kalshi-grounded evidence (`kalshi_backfill.py`'s 24,415 settled markets) is disconnected and, if anything, undercuts the premise of a persistent time-of-day edge. A credible Proof implementation needs the real Kalshi settlement pipeline (`src/kalshi/` — real, tested, ready to use) wired to frozen, timestamped predictions (the Assay/Census discipline — real, tested, ready to use) — but this integration has never been done end-to-end, and `collect.js` is an explicit placeholder stub today.
- **Statistical rigor exists and is worth keeping**, in duplicate, under names that need to change: Wilson-CI + Bonferroni-corrected significance grading is implemented independently in `feature/reeding-assay-schema/grade.ts` and `v3/production/api/_lib/pre.js`.

---

## 7. V3 implementation readiness

| V3 concept | Ready? | What exists |
|---|---|---|
| Prospect shell | Partial | PT/ET dual-timezone rendering already works in current `index.html` (reusable). Countdown-timer pattern exists (Buy Signal panel) and is adaptable. No Present/Prime component exists — net-new. |
| Proof | Not started (product), logic exists (engine) | Wilson-CI/Bonferroni grading exists twice, untested against real settlement data end-to-end. Kalshi client is real and tested. Nothing connects them today. |
| P/L | Partial | Current ledger (`localStorage`, manual entry, 7 seed bets) is primitive but functional — evolvable rather than a rebuild. Must stay private/separate from public repo per Brand Sprint's own instruction. |
| Reeded Edge (hover/tap) | Not started | No mechanism exists in production. The "reading object" contract (label/value/unit/definition/interpretation/calculation/source/freshness) from the Brand Sprint is fully specified and buildable as self-contained frontend work against mock data. |
| Visual system | Strong direction, no code | `v3-prospect-concept.jpeg`/`v3-proof-evidence-concept.jpeg` are the target; `feature/silverline-creative-system`'s Observatory/Mint studies and `design/v3-concept`'s motion language are useful prior art for translating the static concept images into an actual animated UI. |

---

## 8. Canonicalization plan (proposed — not yet applied)

Recommend a root `ops/README.md` (or `CLAUDE.md`, since none exists) that is the single entry point, pointing to:
- **Product/brand doctrine:** `ops/brand/SILVERLINE_BRAND_SYSTEM.md` + `SILVERLINE_UX_LANGUAGE.md` (now in-repo, see §10). `ops/brand/HAMMER_OUT.md` stays explicitly flagged non-canonical.
- **Engineering reality:** `backend/README.md` (Blocker A, generated-vs-source rules) + this report.
- **Decisions:** `ops/DECISIONS.md` (append-only, keep as-is).
- **Work queue:** `ops/WORK_QUEUE.md` (needs a refresh pass once Andrew answers §11).
- **Deployment/runbook:** merge `ops/safe-mode-runbook`'s `SAFE_MODE_RUNBOOK.md` into `ops/`.
- **Incidents:** `ops/INCIDENTS.md` (keep).

This report and `ops/audit-40000ft`'s OPS-07 audit should both be merged to master (docs-only, zero conflict) so the next agent finds one governance trail instead of three.

---

## 9. Implementation plan (ordered, non-destructive)

**Track A — Truth Engine.** Merge the 6 cleanly-additive branches (§3) into master via a reviewed PR. Reconcile `.gitignore` gaps. Attempt Blocker A recovery (needs Andrew — see §11). Consolidate the two duplicate Wilson-CI/Bonferroni implementations into one, under Founder-approved naming (not Grade). Wire the real Kalshi client to real Census/Assay-equivalent storage end-to-end, replacing `collect.js`'s placeholder — this is the prerequisite for any honest Proof.

**Track B — V3 Experience.** Build Prospect first, against mocked data conforming to the Brand Sprint's data contract (§UX_LANGUAGE.md). One shared Present/Prime component. Reuse existing PT/ET logic. Build the Reeded Edge hover/tap system as its own reusable component (the reading-object contract is fully specified). Do not connect to live data until Track A's contract is stable.

**Track C — Proof.** Once Track A's real settlement pipeline exists, build historical validation from frozen Assay-equivalent records vs. actual outcomes — this is where the consolidated Wilson-CI/Bonferroni logic finally gets used against real data instead of a placeholder.

**Track D — P/L.** Evolve the existing ledger; keep personal accounting data out of the public repo.

None of this proceeds to master or production without Andrew's review of §11.

---

## 10. What was done tonight (safe, additive, already on this branch)

- Full read-only inspection of all 16 branches, master's docs, `index.html`, `analysis.json`, and the backend scripts.
- Extracted and reconciled the Sept 18 Brand Sprint package (previously missing from the handoff — now confirmed supplied and read in full, images included).
- Copied the Brand Sprint verbatim into `ops/brand/` on this branch, per the package's own `README.md` instruction ("this package should move into `ops/brand/` on a non-production branch"). Nothing existing was modified.
- Wrote this report to `ops/reports/STATE_RECONCILIATION_2026-09-19.md`.
- **Nothing merged to master. No production, deploy, domain, cron, or ledger change. No other branch's code touched or modified.**

---

## 11. Decisions only Andrew can make

1. **Thread consolidation** — OPS-07 flagged two independent COO threads operating on this repo concurrently. Is there still a second active thread I should know about, or is this session now the sole one?
2. **Creative direction** — three competing visual explorations exist (`design/v3-concept`'s "The Field," `feature/silverline-creative-system`'s Observatory/Mint studies, and now the Brand Sprint's cinematic reeded-dial concept). The Brand Sprint appears to be the most current and most resolved — confirm it's the one to build against.
3. **Blocker A** — the model-source pipeline is still only recoverable from inside the daily-cron session itself (per `ops/briefs/BLOCKER_A_PIPELINE_RECOVERY.md`). This needs one message sent from you into that session; nothing here can substitute.
4. **Merge approval** — approve merging the 6 cleanly-additive branches (§3) plus this report and `ops/audit-40000ft` into `master` (docs + isolated feature code only, zero production impact, zero deploy impact since master isn't the deploy source).
5. **Terminology sign-off on HAMMER_OUT items** — in particular #4 (what a settled Cast is called) and #7 (the historical-performance metric label, since "Grade" is rejected but the underlying statistic needs a name to ship Proof).

Everything else in §9 (Tracks A–D) can proceed autonomously on feature branches once #1–2 are answered, without further blocking on #3–5.
