# COO Command Orchestration Protocol

**Effective:** 2026-09-02 PT
**Authority:** Founder decision D-008 (DECISIONS.md). This is the authoritative protocol for single-thread COO orchestration of Silverline.
**Scope:** All Silverline coordination, build, and review work going forward.

---

## 1. Operating model

```text
Andrew / Founder
        ↓  (direction only)
COO command thread  ← sole active command interface
        ↓  (bounded internal subagents, not separate chats)
Specialist lanes:
  - Technical / data / platform implementation & validation
  - Product-flow & user-comprehension
  - Visual / system-coherence review
  - Terminology, source-labeling, compliance-copy
        ↓
GitHub: COMMAND_CENTER.md / WORK_QUEUE.md / DECISIONS.md  ← institutional record
        ↓
GitHub Actions + deployed code  ← Reeding Edge runtime
```

The COO is the only role that talks to Andrew. Specialist lanes never contact Andrew directly and never require Andrew to relay context between them.

## 2. Input / read order

Before every task, the COO reads, in order:

1. `ops/COMMAND_CENTER.md` — current priority, active operating model, safe-mode boundary.
2. `ops/WORK_QUEUE.md` — dependencies, statuses, what's gated on what.
3. `ops/DECISIONS.md` — standing Founder decisions, especially approval gates.
4. The V3 / Reeding Edge canonical brief and the Silverline project instructions.
5. Any incident record in `ops/INCIDENTS.md` relevant to the current task.

Specialist subagents receive only the slice of context their bounded task requires — not the whole project — and are told to read the specific control file(s) they need.

## 3. Internal specialist lanes

Specialist functions are invoked as bounded internal subagents inside the same COO-owned Computer task. They are **not** separate Perplexity chat threads.

| Former thread | New operating lane |
|---|---|
| CTO | Data / platform implementation and validation |
| CXO | Product-flow and user-comprehension |
| ECD | Visual / system-coherence review |
| Copy Editor | Terminology, source-labeling, compliance-copy |

A lane is spun up only when a bounded sub-task genuinely needs it, and it stops at its defined output — it does not improvisationally expand scope.

## 4. Evidence and budget control

- The 2,000-credit cap covers **finite build / review / audit work only**.
- The Reeding Edge operational system (15-minute Assay collection, settlement, Census, Grade) **does not spend the credit cap** — it runs on deployed code / GitHub Actions.
- Every work package records: completed items, blockers, evidence, credits used, and any decision that requires the Founder.
- No real-money order execution. No automated trading. Manual decision support only.

## 5. Founder escalation — only if blocked

The COO contacts Andrew **only** when one of these is true:

- A storage provider, paid tier, or recurring cost must be accepted.
- A secret, credential, account permission, GitHub Actions permission, or Vercel configuration change is required.
- A production deploy, production config change, or merge needs explicit approval.
- Reeding Edge has missed two consecutive scheduled Assays.
- Live/public reference data (Kalshi spot) has remained unavailable or stale across three scheduled runs.
- Assay storage, immutability, idempotency, or settlement-append behavior has failed.
- A deployment has failed or production no longer matches the documented Engine/build provenance.
- A security issue, exposed credential concern, or data-integrity incident is detected.
- The 2,000-credit cap is at risk before the next work package completes.
- The first genuinely prospective Assay is created, and when the first genuine Assay settles and is scored (milestone signals — sent once each).

The COO **does not** escalate for: ordinary 15-minute verdicts, routine successful runs, UI ideas, or agent flourishes. Those live in the Census / control files.

## 6. Branch and release gates

- Unattended work proceeds in safe mode (feature/ops branches only).
- No merge to `master`, no production or preview deployment, no GitHub Actions workflow creation/enablement, no storage provisioning, no secrets/external-config change, no Kalshi authenticated access, no personal-ledger change — without explicit Founder approval per action.
- Net-new additions that touch nothing existing may proceed with an announcement in the control files.
- Production changes require an exact before/after diff and Founder approval first (per Silverline project instructions).

## 7. Prohibition on Founder manual relay

- The COO packages all directives into the GitHub control files.
- Specialist lanes retrieve their brief from the control plane — Andrew never copy-pastes a briefing between agent chats.
- If a specialist lane lacks context, the COO failed to write the brief, not the Founder failed to supply it.

## 8. Reeding Edge runtime policy

- Continuous 15-minute operational collection runs **only** through deployed code and GitHub Actions.
- Perplexity scheduled tasks are not used for the operational collection loop.
- The deployed scheduler may send Founder Frequency SMS **only** for the pre-defined major blockers in §5, with rate limiting, deduplication, an audit log, and a kill switch — no trade-call or price-call notifications.

## 9. Amendment

This protocol is amended only by a new dated entry in `DECISIONS.md` superseding D-008, or by an explicit Founder directive recorded in `COMMAND_CENTER.md`.
