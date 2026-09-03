# Silverline Decisions Log

Material Founder decisions only. Each entry: date, decision, rationale, scope, reversal condition. Decisions are append-only; a change is a new entry that supersedes the prior, not an edit.

---

## D-001 — Raw Kalshi archives and credentials stay private
- **Date:** 2026-08-28 (carried forward into OPS-03b)
- **Decision:** Raw Kalshi market archives, API credentials, tokens, and environment-variable values are never copied into public Git, operations documents, or any shared artifact.
- **Rationale:** Kalshi data and account credentials are sensitive; the Developer Agreement and basic operational hygiene require they stay private. Public artifacts may reference paths and structure, never values.
- **Scope:** All repos, branches, docs, handoffs, and command-center files.
- **Reversal condition:** Only if Andrew explicitly authorizes a specific value's publication for a specific purpose, recorded here as a superseding entry.

## D-002 — Production changes require explicit Founder approval
- **Date:** 2026-08-28 (carried forward)
- **Decision:** No change to `master`, the live Vercel deploy, Vercel config/env vars/domains, the cron, the ledger, or PRE logic happens without Andrew's explicit prior approval.
- **Rationale:** Silverline backs real-money decisions; unattended production mutation is unsafe.
- **Scope:** All production surfaces and the deploy pipeline.
- **Reversal condition:** None. This is a standing rule.

## D-003 — OPS-02 safety work and SYSTEST-01 precede unattended production publishing
- **Date:** 2026-08-29 (carried forward)
- **Decision:** The validation / backup / last-known-good framework (OPS-02) and the preview stress test (SYSTEST-01) must be complete and passing before any unattended production publish is permitted.
- **Rationale:** A bad model must be blockable and restorable before it reaches the live site.
- **Scope:** The daily refresh → validate → publish path.
- **Reversal condition:** Andrew explicitly waives the gate for a specific release — recorded here.

## D-004 — Silverline stays manual decision support; no automated bet execution
- **Date:** 2026-08-28 (carried forward)
- **Decision:** Silverline surfaces historical edges and live market data. It never places bets, never executes orders, never auto-resolves ledger entries.
- **Rationale:** Honest-caveat / compliance posture; Andrew sizes and logs his own manual bets.
- **Scope:** Entire product.
- **Reversal condition:** None.

## D-005 — Kalshi proxy is public-market-data-only; no account/trading endpoints
- **Date:** 2026-08-30 (CTO-02)
- **Decision:** The CTO-02 proxy allowlists only public read-only Kalshi endpoints (series, markets list, markets/{ticker}/orderbook, historical/markets, historical/cutoff). Trading, portfolio, ws, auth, orders, positions, balances are rejected (403). GET-only; no request body forwarded.
- **Rationale:** Limits the surface to data Andrew can already read on Kalshi's own site; avoids proxying anything that touches money movement or account state.
- **Scope:** `api/kalshi.py` + `api/kalshi_lib.py` (feature/kalshi-proxy).
- **Reversal condition:** None — even if RSA-auth trading were wanted later, it would be a separate, separately-approved surface, not an expansion of this proxy.

## D-006 — Browser-visible reusable bearer tokens are not a production-grade secret
- **Date:** 2026-08-30 (CTO-02)
- **Decision:** The proxy's bearer token is lightweight anti-abuse (stops random bots from using Andrew's proxy as a free Kalshi API), not a real access-control mechanism. It must not be treated, documented, or relied upon as a production-grade secret.
- **Rationale:** Anyone who reads the deployed frontend source can see the token; combined with absent-Origin (curl/ops) requests being allowed, it bounds but does not secure the surface. This is permitted by Kalshi's "lightweight authentication" allowance but must be stated honestly.
- **Scope:** CTO-02 token model; all docs describing it.
- **Reversal condition:** If a real access-control layer (e.g. a build-time-injected, non-browser-visible secret, or per-session auth) is added and verified, record it here as a superseding entry that upgrades the token to a real secret.

---

## D-007 — Safe-mode boundary (standing)
- **Date:** 2026-08-29
- **Decision:** Unattended CTO work proceeds in safe mode: feature/ops branches only; no merge, deploy, Vercel/prod/cron/env/ledger/PRE/raw-Kalshi-archive change. Net-new additions that touch nothing existing may proceed with an announcement.
- **Rationale:** Lets the CTO make progress while keeping production immutable.
- **Scope:** All unattended CTO work.
- **Reversal condition:** Andrew explicitly authorizes a specific production change, recorded here.

---

## D-008 — COO command consolidation (standing)
- **Date:** 2026-09-02
- **Decision:** The COO command thread becomes the sole active Silverline command interface. CTO, CXO, and ECD external conversations are reclassified as advisory/archived — not active direct reports — and receive no new direct Founder assignments. Specialist expertise operates as bounded internal subagents inside a single COO-owned Computer task. GitHub's `COMMAND_CENTER.md`, `WORK_QUEUE.md`, and `DECISIONS.md` are the shared institutional record; no Founder manual relay of context between agent chats is required going forward. Reeding Edge's continuous 15-minute operational collection runs via deployed code / GitHub Actions, not Perplexity scheduled tasks; the 2,000-credit cap applies only to finite build/review/audit work.
- **Rationale:** Eliminated an operational failure mode where Andrew was manually relaying context between disconnected agent chat threads instead of a real orchestration layer doing it.
- **Scope:** All Silverline coordination, going forward, until explicitly revised.
- **Reversal condition:** Andrew explicitly restores direct multi-thread reporting or revises the orchestration model, recorded here.
- **Explicitly retained:** No real-money execution. No automated trading. All existing approval gates (paid resources, secrets/permissions, production changes, data-integrity incidents, cap overruns) remain in force. No existing Perplexity conversation thread was deleted or altered by this decision — only their role in the operating model changed.
