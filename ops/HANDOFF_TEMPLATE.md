# Silverline Handoff Template

**Mandatory short format.** Every agent finishing a task posts a handoff in this exact shape before stopping. No prose reports, no freeform summaries — this block is the report. Copy it, fill every field, paste into the session/PR.

```
Task ID:            <e.g. OPS-03b>
Title:              <short title>
Status:             <Complete | In Progress | Blocked | Ready for Review | Waiting for Founder>
Owner:              <role, e.g. CTO>
Branch:             <branch name>
Commit:             <full sha>
Files changed:      <added/modified/deleted list>
Tests/checks run:   <what was run + result, e.g. "21/21 unit tests pass; py_compile clean">
Production touched: <yes | no>
Vercel touched:     <yes | no>   (read-only inspection counts as "no" — note it in summary)
Plain-English summary: <2-4 sentences, what was built and why>
Risks/blockers:     <named blockers + least-invasive next action; "none" if clear>
Founder decision needed: <specific decision(s), or "none">
Next permitted automatic task: <next task the agent may start without Founder approval, or "none — stop and wait">
```

## Rules

- Every field is required. Use `none` / `not applicable` explicitly rather than omitting.
- `Commit` is the full SHA of the branch tip at handoff, not a placeholder.
- `Production touched: yes` is only true if `master` or the live Vercel deploy was changed. Read-only inspection is `no` with a note.
- `Vercel touched: yes` only if a Vercel config, env var, deployment, or domain was changed. Read-only `whoami`/`deployments`/`project` inspection is `no`.
- `Next permitted automatic task` must reference a task that is genuinely autonomous-safe (feature branch, no deploy/merge/prod/secret change) — otherwise it is `none — stop and wait`.
- A handoff with `Status: Complete` and `Founder decision needed: none` and `Next permitted automatic task: <X>` authorizes the next agent to begin `<X>` without waiting. Anything else means stop.
- Post the filled block into the session and stop. Do not begin the next task in the same turn unless this template's `Next permitted automatic task` field explicitly authorizes it.
