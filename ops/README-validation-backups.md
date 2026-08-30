# OPS-02 — Validation, Backup & Last-Known-Good System

Goal: the daily model refresh must be able to run unattended while preventing a
bad, incomplete, malformed, or statistically implausible candidate model from
replacing the last verified live model.

This is a **scaffold** on branch `ops/validation-backups`. It does NOT touch
production: no automatic production publication or rollback is wired. Everything
is path-parameterized so callers decide what gets written where.

## Layout

```
ops/
  validation/
    schema.py          # canonical analysis.json schema (from the REAL model)
    validator.py        # candidate validator (all 9 rules)
    backup.py           # timestamped snapshot + latest-known-good.json
    restore.py          # restore last known-good to a target path
    status_schema.py    # machine-readable status report schema
    run_pipeline.py     # validate -> backup -> publish/hold -> status
  test/
    make_fixtures.py    # generates a valid base model + broken variants
    run_preview_tests.py # preview-only test mode (simulated failures)
```

Generated outputs (backups, simulated candidates, runs) live under
`ops/_preview/`, `ops/backups/`, and `ops/runs/` — all gitignored.

## Validation rules (all implemented)

1. **Valid JSON** — candidate must parse.
2. **Required fields + schema/version** — required top-level keys present
   (`n_deltas`, `n_up`, `n_down`, `p_up_overall`, `slots`, `day_slots`,
   `night_slots`, `weekdays`, `slot_weekday`, `histogram`, `top_edges`,
   `best_edge`, `data_start`, `data_end`). `schema_version` checked if declared.
3. **Valid timestamps** — `data_start` and `data_end` parse as ISO datetimes
   (the canonical fields in the real schema); `generated_at`/`data_through`
   accepted if present. `data_end >= data_start`.
4. **Probabilities in [0,1]** — `p_up_overall`, per-slot `p_up`, `best_edge`
   probabilities, `histogram.p_up_overall`.
5. **Sample sizes are nonnegative** — `n_deltas`/`n_up`/`n_down`, per-slot
   `n`/`up`; `up <= n`.
6. **15-minute slot coverage** — `slots` covers all 96 fifteen-min labels
   (`00:00` … `23:45`), each with `{slot,n,up,p_up,ci_lo,ci_hi}`.
7. **Confidence intervals valid** — `0 <= ci_lo,ci_hi <= 1`, `ci_lo <= ci_hi`,
   and `p_up` lies within `[ci_lo, ci_hi]` per slot and for `best_edge`.
8. **No collapse vs prior known-good** — rejects candidates whose `n_deltas`
   dropped >25% or whose `p_up_overall` shifted >±0.20 vs the prior model.
9. **No raw Kalshi records** — scans candidate JSON for raw Kalshi field markers
   (`event_ticker`, `expiration_value`, `floor_strike`, `settlement_ts`,
   `volume_fp`, …). analysis.json must hold only computed aggregates.

Sanity-checked against the real production `analysis.json` — it passes.

## Backup + restore

- `backup.snapshot_known_good(live_path, backup_dir)` → copies the current
  known-good to `analysis.<UTCts>.json` and refreshes `latest-known-good.json`.
  Retains the most recent 30 snapshots (prunes older).
- `restore.restore(target_path, backup_dir)` → copies `latest-known-good.json`
  (or a named snapshot) to `target_path`.
- The pipeline snapshots the prior known-good **before** swapping in a valid
  candidate; on failure it holds and (if a publish target was given) restores.

## Machine-readable status report

`StatusReport` written to a path (e.g. `ops/runs/status-<ts>.json`):

- `run_utc`, `candidate_path`
- `candidate_generation_time`, `data_through_time`
- `validation_outcome` (`pass`/`fail`)
- `validation_failures` (list of `{rule, detail}`)
- `backup_reference` (snapshot path taken before swap)
- `current_known_good_reference` (`latest-known-good.json` path)
- `publication_status`: `held` | `passed` | `restored` | `not_attempted`

## Preview-only test mode

Simulated failures, no production writes:

```
python3 ops/test/run_preview_tests.py
```

Generates a valid base model + broken variants (malformed JSON, bad probs,
negative counts, missing slot coverage, bad CIs, collapsed, raw Kalshi leak)
under `ops/_preview/` (gitignored), seeds a prior known-good from the valid base
(NOT the production file), runs each through the pipeline, and asserts the
expected rule fires. Also exercises backup, restore, smoke-test-failure
restore, and the not-attempted path. All outputs stay under `ops/_preview/`.

## What this does NOT do

- No automatic production publication or rollback.
- No modification of master, production `index.html` / `analysis.json`, the live
  ledger, Vercel config, cron, env vars, domains, or deployment.
- No committing of raw Kalshi data, secrets, or tokens.
- Backups are durable files on disk (not only temporary workflow artifacts), but
  production wiring of those backups into the live deploy is deferred to a later
  OPS step with explicit approval.
