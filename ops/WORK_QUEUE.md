# Silverline Work Queue

**Last Updated:** 2026-08-30 13:58 PT
Statuses: `Complete` · `In Progress` · `Blocked` · `Ready for Review` · `Waiting for Founder` · `Not Started`.
Ordered by dependency, not by priority. Dependency column says what must be true before a task can start.

| # | Task | Status | Branch / artifact | Depends on | Next action | Autonomous or Founder? |
|---|---|---|---|---|---|---|
| 1 | OPS-03b Unified Workspace Inbox | Complete | `ops/command-center` | — | Stop; await COO review | Autonomous (done) |
| 2 | OPS-03a Durable Backup Storage & Production-Readiness Proposal | Complete | `ops/validation-backups` (`c201b85`) | — | Founder decisions (Founder Inbox #2, #4, #5, #6) | Waiting for Founder |
| 3 | CTO-02 Kalshi Proxy Preview Deployment & Access-Model Refinement | Ready for Review (blocked on runtime smoke) | `feature/kalshi-proxy` (`b6ab287`) | Founder decisions: merge approval + token/access model (#3) + Blocker A | Preview deployed (function built Ready); runtime smoke blocked by team SSO. Andrew opens preview in browser, or Founder disables protection, or defer to go-live gate | Requires Founder |
| 4 | REEDING-01 Motion Study 01 — Technical Discovery & File-Level Implementation Plan | In Progress | TBD feature branch | — (v3 aesthetic direction: dark/card-based proposed, Founder to confirm) | Read live site structure, produce motion/parallax technical discovery + file-level plan + static prototype assets | Autonomous-safe |
| 5 | PRE-0 Price-Aware Signal Guardrails — Technical Discovery & Test Plan | Not Started | TBD feature branch | — (independent of deploy chain) | Design signal guardrails accounting for contract price/payout, not just win-rate | Autonomous-safe if queued |
| 6 | SYSTEST-02 Full Release Drill | Not Started | preview deploy (non-prod) | OPS-02 merged to master + CTO-02 preview-deployed + access model refined | Rehearse full validate→snapshot→publish→smoke→restore against a preview deploy, all failure paths | Requires Founder (needs preview deploy) |
| 7 | OPS-04 Autonomous Task Router + Safe-Mode Runbook | Not Started | TBD ops branch | — | Build a task-router + safe-mode runbook doc so the agent self-selects the next safe task from this queue | Autonomous-safe |

### Dependency notes

- **CTO-02 go-live (item 3)** is gated on Founder decisions: merge approval, the token/access-model decision, and resolving Blocker A (refresh internals). It cannot proceed autonomously under safe mode.
- **SYSTEST-02 (item 6)** cannot start until OPS-02 is on `master` and CTO-02 is preview-deployed — both require Founder approval. It is the final gate before any unattended production publishing is allowed (per DECISIONS.md).
- **PRE-0 (item 4)** and **REEDING-01 (item 5)** are independent of the deploy chain and are autonomous-safe on feature branches — but neither is started until the Founder/COO queues it. PRE-0 hardens signal logic without touching production; REEDING-01 needs the v3 aesthetic direction confirmed first.

### Queue discipline

- A task moves to `In Progress` only when its dependencies are met or explicitly waived by the Founder.
- `Waiting for Founder` tasks list the exact decision needed (cross-reference Founder Inbox in COMMAND_CENTER.md).
- No task in `Blocked` is retried by brute force — the blocker is documented and the least-invasive next action is recorded.
