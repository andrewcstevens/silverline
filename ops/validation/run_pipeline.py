"""
Silverline model-validation pipeline orchestrator.

Flow:
  1. Validate the candidate (with prior known-good for collapse detection).
  2. If valid: snapshot the current known-good (backup), then publish the
     candidate to `publish_target` (if given), set publication_status=passed.
  3. If invalid: hold the candidate, optionally restore prior known-good to
     `publish_target`, set publication_status=held or restored.
  4. Write a machine-readable status report.

This module is path-parameterized. It NEVER hardcodes the production
analysis.json path — the caller decides what `publish_target` is. OPS-02 does
NOT wire automatic production publication/rollback; preview tests point
publish_target at gitignored working copies only.
"""
from __future__ import annotations
import os
import shutil
from datetime import datetime, timezone
from . import validator
from .backup import snapshot_known_good, latest_known_good_path, DEFAULT_BACKUP_DIR
from .restore import restore as restore_kg
from .status_schema import StatusReport, HELD, PASSED, RESTORED, NOT_ATTEMPTED

DEFAULT_RUNS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "runs")


def run(
    candidate_path: str,
    prior_known_good: str | None = None,
    publish_target: str | None = None,
    backup_dir: str = DEFAULT_BACKUP_DIR,
    status_path: str | None = None,
    smoke_test_fn=None,
) -> StatusReport:
    """Validate a candidate model and conditionally publish it.

    - prior_known_good: path to the last known-good model (for collapse check
      + as the backup source). If None, no collapse check or backup is done.
    - publish_target: where to publish the candidate on success / restore on
      failure. If None, nothing is published (publication_status=not_attempted).
    - smoke_test_fn: optional callable(published_path)->bool run after a
      successful publish; if it returns False, restore prior known-good and set
      status=restored.
    - status_path: where to write the machine-readable status report.
    """
    result = validator.validate(candidate_path, prior_path=prior_known_good)
    report = StatusReport(
        run_utc=datetime.now(timezone.utc).isoformat(),
        candidate_path=candidate_path,
        candidate_generation_time=result.candidate_generation_time,
        data_through_time=result.data_through_time,
        validation_outcome="pass" if result.ok else "fail",
        validation_failures=[f.to_dict() if hasattr(f, "to_dict") else f for f in result.failures] if hasattr(result, "failures") else [],
        current_known_good_reference=latest_known_good_path(backup_dir) if prior_known_good else None,
        publication_status=NOT_ATTEMPTED,
    )
    # normalize failure dicts
    import dataclasses as _dc
    fds = []
    for f in result.failures:
        fds.append(f.to_dict() if hasattr(f, "to_dict") else _dc.asdict(f))
    report.validation_failures = fds

    if not result.ok:
        # HOLD. Optionally restore prior known-good into publish_target.
        if publish_target and prior_known_good and os.path.exists(prior_known_good):
            try:
                restore_kg(publish_target, backup_dir=backup_dir)
                report.publication_status = RESTORED
            except FileNotFoundError:
                report.publication_status = HELD
        else:
            report.publication_status = HELD
        if status_path:
            report.write(status_path)
        return report

    # Candidate is valid. Snapshot the current known-good BEFORE swapping.
    if prior_known_good and os.path.exists(prior_known_good):
        report.backup_reference = snapshot_known_good(prior_known_good, backup_dir)
        report.current_known_good_reference = latest_known_good_path(backup_dir)

    if publish_target:
        os.makedirs(os.path.dirname(os.path.abspath(publish_target)) or ".", exist_ok=True)
        shutil.copy2(candidate_path, publish_target)
        report.publication_status = PASSED
        # smoke test after publish
        if smoke_test_fn is not None:
            try:
                ok = bool(smoke_test_fn(publish_target))
            except Exception:
                ok = False
            if not ok and prior_known_good and os.path.exists(prior_known_good):
                restore_kg(publish_target, backup_dir=backup_dir)
                report.publication_status = RESTORED
    else:
        report.publication_status = NOT_ATTEMPTED

    if status_path:
        report.write(status_path)
    return report
