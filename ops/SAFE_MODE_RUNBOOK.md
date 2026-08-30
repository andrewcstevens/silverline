# Silverline Safe-Mode Runbook + Autonomous Task Router

**Last Updated:** 2026-08-30 14:30 PT
**Branch:** `ops/safe-mode-runbook`
**Purpose:** Let the CTO agent run continuously in Silverline Safe Mode without Andrew relaying handoffs between AI sessions. Codifies the pre-task ritual, the safe-mode boundary, and the deterministic task-router that picks the next safe task from `ops/WORK_QUEUE.md`.

This is documentation only. It changes no production file, no code, no deploy.

---

## 1. Safe Mode — what is and is not allowed

### Allowed (autonomous, no approval needed)
- Read-only inspection of the repo, branches, Vercel project, and the live site.
- New documentation, runbooks, schemas, test fixtures, tests, static prototype assets.
- New code on an **isolated feature branch** that is testable without modifying the live app.
- Preview deployment **only if** it does not modify production settings, env vars, domains, cron, or the production deployment.
- Proposals and technical-discovery docs (read-only design artifacts).

### Prohibited (Founder approval required first)
- Merging any branch to `master`.
- Deploying to production or modifying the live site (`silverline-global.vercel.app` / `silverline.global`).
- Modifying existing production `index.html`, `analysis.json`, the live ledger, or PRE logic.
- Changing Vercel production config, cron, domains, or build settings.
- Any change to the daily cron pipeline (`cf411975`, `26 13 * * *` UTC) without Founder approval.

### Boundary rule (D-002, from `ops/DECISIONS.md`)
Nothing that already exists — live code, ledger data, deployed config — gets modified or deleted without an exact before/after diff and Andrew's explicit approval. Net-new additions that touch nothing existing may proceed; announce what was added.

---

## 2. Pre-task ritual (run before EVERY task)

1. Read `ops/COMMAND_CENTER.md` — current production state + Active Work table + Founder Inbox.
2. Read `ops/WORK_QUEUE.md` — the ordered task list with statuses and dependencies.
3. Read `ops/DECISIONS.md` — standing decisions that constrain what's allowed.
4. Read `ops/INCIDENTS.md` — any open incident that blocks work.
5. Read `ops/HANDOFF_TEMPLATE.md` — the mandatory report format to use on completion.

Then run the **Task Router** below to pick the next safe task.

---

## 3. Autonomous Task Router

Deterministic procedure the agent follows to self-select the next safe task from `ops/WORK_QUEUE.md`. Run it after completing (or being blocked on) the current task.

```
INPUT: ops/WORK_QUEUE.md (ordered task list)
STATE: each task has Status ∈ {Complete, In Progress, Blocked, Ready for Review,
       Waiting for Founder, Not Started} and an "Autonomous or Founder?" flag.

ROUTER:
  for task in WORK_QUEUE (in dependency order):
    # skip tasks that are done or actively someone else's
    if task.Status in {Complete, Ready for Review, Waiting for Founder}:
        continue
    if task.Status == Blocked:
        continue
    if task.Status == In Progress:
        resume that task (it's the current task)
        STOP

    # task is Not Started — check if it can start autonomously
    if task.Autonomous? == Requires Founder:
        # a Founder-gated task is not auto-started; log it as the next
        # Founder decision and continue down the queue
        note "Founder-gated: <task> (<next action>)"
        continue

    # check dependencies are satisfied
    if not deps_satisfied(task.Depends on):
        continue

    # check safe-mode: does the task touch production / deploy / master?
    if task touches production, deploy, master, cron, or existing prod files:
        # demote: do the read-only / proposal / feature-branch version instead,
        # and surface the production change as a Founder decision
        downgrade_to_safe_variant(task)

    SELECT task
    STOP

  # nothing selectable — all remaining tasks are Founder-gated or blocked
  REPORT: "No autonomous-safe task remains. Open Founder decisions: <list>.
          Safe Mode has reached a Founder-only decision boundary. Stop and wait."

deps_satisfied(dep):
    for each dependency in dep:
        if dependency not met (branch not merged, Founder decision not made,
                               access not granted): return False
    return True
```

### Self-selection rules
- **Resume before starting new:** if a task is `In Progress`, resume it rather than starting the next one.
- **Dependency order is authoritative:** never skip a task whose dependencies are unmet to grab a more interesting one lower in the queue.
- **Founder-gated tasks are not auto-started:** they're noted as the next Founder decision and the router continues down the queue. The router never auto-starts a task marked `Requires Founder`.
- **Safe-mode downgrade:** if a task would touch production, the router does the read-only / proposal / feature-branch version instead and surfaces the production change as a Founder decision. It never works around a blocker by touching production.

---

## 4. Per-task workflow (what to do once a task is selected)

1. Create an isolated branch off `master` (feature/* for code, ops/* for docs).
2. Read the actual current source before editing anything that exists — never rebuild from memory.
3. Do the work within the safe-mode boundary (§1). Run tests / checks.
4. Commit + push the branch. Never merge to master.
5. Emit a handoff using `ops/HANDOFF_TEMPLATE.md`.
6. Update `ops/COMMAND_CENTER.md` (Active Work table + Founder Inbox) and `ops/WORK_QUEUE.md` (status) on the `ops/command-center` branch. Commit + push.
7. Run the Task Router (§3) again to auto-select the next safe task — unless a Founder-only decision boundary was reached, in which case stop and wait.

---

## 5. Blocked-task handling

If a task is blocked by unavailable access, missing source files, or an unknown deployment config:
- Document the **exact** blocker (what was attempted, what happened, what was expected) in the handoff and in `ops/INCIDENTS.md`.
- Do **not** guess or work around the blocker by touching production.
- Complete all other safe work available, then run the Task Router to pick the next unblocked safe task.

### Known blockers (live)
- **Blocker A** — `refresh_analysis.py` / `analysis.py` / `candles.parquet` live in the cron session workspace (`/home/user/workspace/btc-wizard/`), not in the GitHub repo or the CTO sandbox. Wiring OPS-03a / PRE-0 into the live analysis pipeline requires reading them first (Founder decision #4).
- **Vercel Deployment Protection (team SSO)** — every preview URL 302→vercel.com/login before any function executes. Blocks automated runtime smoke of preview deploys (Founder decision #3).

---

## 6. Stop conditions (when to stop and wait)

The agent stops and waits for Andrew when:
1. **No autonomous-safe task remains** — every remaining task is Founder-gated or blocked (§3 final REPORT).
2. **A Founder-only decision boundary is reached** — e.g. a merge, a production deploy, an access/token model change, or a production-setting change.
3. **The COO roleplay protocol says to** — when a checkpoint task specifies "stop and wait for a read-only COO review before starting the next step."

In all three cases the agent emits a final handoff and does not begin a new task until Andrew or the COO says go.

---

## 7. Source of truth

- `ops/COMMAND_CENTER.md` — live status. The router reads this for the Active Work table and Founder Inbox.
- `ops/WORK_QUEUE.md` — the ordered task list the router walks.
- `ops/DECISIONS.md` — standing constraints (D-001…D-007).
- `ops/INCIDENTS.md` — open blockers/incidents.
- `ops/HANDOFF_TEMPLATE.md` — the mandatory report format.

If any of these disagree, trust the branch tip / commit / documented inspection, not a paraphrased status. Say so plainly when something isn't verified.
