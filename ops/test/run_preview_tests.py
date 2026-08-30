"""
OPS-02 preview-only test mode.

Runs the validator + backup + restore + status pipeline against generated
fixtures (including simulated failures) WITHOUT touching master, production
analysis.json, the live ledger, Vercel, or real Kalshi data.

All outputs go under ops/_preview/ (gitignored). To run:

    python3 ops/test/run_preview_tests.py

Exit code 0 = all assertions passed; nonzero = a test failed.
"""
from __future__ import annotations
import os
import sys
import json
import shutil

HERE = os.path.dirname(__file__)
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, REPO)

from ops.test import make_fixtures  # noqa: E402
from ops.validation import run_pipeline, validator, backup, restore  # noqa: E402
from ops.validation.status_schema import PASSED, HELD, RESTORED  # noqa: E402

PREVIEW_DIR = os.path.join(HERE, "_preview")
KG_DIR = os.path.join(PREVIEW_DIR, "known-good")
BACKUP_DIR = os.path.join(PREVIEW_DIR, "backups")
RUNS_DIR = os.path.join(PREVIEW_DIR, "runs")
PUB_DIR = os.path.join(PREVIEW_DIR, "published")


def _reset_preview() -> None:
    for d in (KG_DIR, BACKUP_DIR, RUNS_DIR, PUB_DIR):
        shutil.rmtree(d, ignore_errors=True)
        os.makedirs(d, exist_ok=True)


def main() -> int:
    _reset_preview()
    failures = []

    # 1. Generate fixtures (simulated candidate outputs, gitignored).
    fixtures = make_fixtures.generate_all()

    # 2. Seed a "prior known-good" from the valid base (NOT the prod file).
    valid_model = make_fixtures.make_valid_model()
    prior_kg = os.path.join(KG_DIR, "analysis.json")
    with open(prior_kg, "w") as f:
        json.dump(valid_model, f)

    def check(label, cond, detail=""):
        if not cond:
            failures.append(f"{label}: {detail}")
            print(f"  FAIL: {label} — {detail}")
        else:
            print(f"  ok: {label}")

    print("=== Test: valid candidate passes + is published + backed up ===")
    pub_target = os.path.join(PUB_DIR, "analysis.json")
    status_path = os.path.join(RUNS_DIR, "valid-status.json")
    r = run_pipeline.run(
        fixtures["valid"], prior_known_good=prior_kg,
        publish_target=pub_target, backup_dir=BACKUP_DIR, status_path=status_path,
    )
    check("valid passes validation", r.validation_outcome == "pass", r.validation_failures)
    check("valid published (passed)", r.publication_status == PASSED, r.publication_status)
    check("backup snapshot taken", bool(r.backup_reference) and os.path.exists(r.backup_reference or ""), r.backup_reference)
    check("latest-known-good exists", bool(r.current_known_good_reference) and os.path.exists(r.current_known_good_reference or ""))
    check("published file == candidate", os.path.exists(pub_target) and json.load(open(pub_target)) == valid_model)

    print("\n=== Test: malformed JSON is held, never published ===")
    r = run_pipeline.run(fixtures["malformed"], prior_known_good=prior_kg, publish_target=pub_target, backup_dir=BACKUP_DIR, status_path=os.path.join(RUNS_DIR, "malformed-status.json"))
    check("malformed fails", r.validation_outcome == "fail")
    check("malformed held", r.publication_status in (HELD, RESTORED), r.publication_status)
    # published file should still be the prior valid model (restored), not the malformed text
    check("published untouched/restored to valid", json.load(open(pub_target)).get("n_deltas") == valid_model["n_deltas"])

    print("\n=== Test: bad probabilities rejected ===")
    r = run_pipeline.run(fixtures["bad_probs"], prior_known_good=prior_kg, publish_target=pub_target, backup_dir=BACKUP_DIR)
    check("bad_probs fails", r.validation_outcome == "fail")
    check("bad_probs cites probabilities rule", any(f.get("rule") in ("probabilities",) for f in r.validation_failures), [f.get("rule") for f in r.validation_failures])

    print("\n=== Test: negative sample size rejected ===")
    r = run_pipeline.run(fixtures["bad_counts"], prior_known_good=prior_kg, publish_target=pub_target, backup_dir=BACKUP_DIR)
    check("bad_counts fails", r.validation_outcome == "fail")
    check("bad_counts cites sample_sizes", any(f.get("rule") == "sample_sizes" for f in r.validation_failures), [f.get("rule") for f in r.validation_failures])

    print("\n=== Test: missing slot coverage rejected ===")
    r = run_pipeline.run(fixtures["missing_slots"], prior_known_good=prior_kg, publish_target=pub_target, backup_dir=BACKUP_DIR)
    check("missing_slots fails", r.validation_outcome == "fail")
    check("missing_slots cites slot_coverage", any(f.get("rule") == "slot_coverage" for f in r.validation_failures), [f.get("rule") for f in r.validation_failures])

    print("\n=== Test: invalid confidence intervals rejected ===")
    r = run_pipeline.run(fixtures["bad_ci"], prior_known_good=prior_kg, publish_target=pub_target, backup_dir=BACKUP_DIR)
    check("bad_ci fails", r.validation_outcome == "fail")
    check("bad_ci cites confidence_intervals", any(f.get("rule") == "confidence_intervals" for f in r.validation_failures), [f.get("rule") for f in r.validation_failures])

    print("\n=== Test: collapsed candidate rejected ===")
    r = run_pipeline.run(fixtures["collapsed"], prior_known_good=prior_kg, publish_target=pub_target, backup_dir=BACKUP_DIR)
    check("collapsed fails", r.validation_outcome == "fail")
    check("collapsed cites collapse_check", any(f.get("rule") == "collapse_check" for f in r.validation_failures), [f.get("rule") for f in r.validation_failures])

    print("\n=== Test: raw Kalshi record leak rejected ===")
    r = run_pipeline.run(fixtures["raw_leak"], prior_known_good=prior_kg, publish_target=pub_target, backup_dir=BACKUP_DIR)
    check("raw_leak fails", r.validation_outcome == "fail")
    check("raw_leak cites no_raw_kalshi_records", any(f.get("rule") == "no_raw_kalshi_records" for f in r.validation_failures), [f.get("rule") for f in r.validation_failures])

    print("\n=== Test: restore returns last known-good ===")
    snap = backup.snapshot_known_good(prior_kg, BACKUP_DIR)
    check("snapshot created", os.path.exists(snap))
    restored_to = os.path.join(PUB_DIR, "restored.json")
    out = restore.restore(restored_to, backup_dir=BACKUP_DIR)
    check("restore wrote latest-known-good", os.path.exists(out) and json.load(open(out)).get("n_deltas") == valid_model["n_deltas"])

    print("\n=== Test: smoke-test failure triggers restore ===")
    def failing_smoke(_path):
        return False
    r = run_pipeline.run(fixtures["valid"], prior_known_good=prior_kg, publish_target=os.path.join(PUB_DIR, "smoke.json"), backup_dir=BACKUP_DIR, smoke_test_fn=failing_smoke)
    check("smoke failure -> restored", r.publication_status == RESTORED, r.publication_status)

    print("\n=== Test: no publish_target -> not_attempted ===")
    r = run_pipeline.run(fixtures["valid"], prior_known_good=prior_kg, publish_target=None, backup_dir=BACKUP_DIR)
    check("not attempted", r.publication_status == "not_attempted", r.publication_status)

    print("\n=== Test: status report is machine-readable ===")
    sp = os.path.join(RUNS_DIR, "final-status.json")
    r = run_pipeline.run(fixtures["valid"], prior_known_good=prior_kg, publish_target=os.path.join(PUB_DIR, "final.json"), backup_dir=BACKUP_DIR, status_path=sp)
    srep = json.load(open(sp))
    required = {"run_utc", "candidate_path", "validation_outcome", "validation_failures", "backup_reference", "current_known_good_reference", "publication_status"}
    check("status has required fields", required.issubset(srep.keys()), sorted(srep.keys()))

    print("\n" + ("ALL PREVIEW TESTS PASSED" if not failures else f"{len(failures)} PREVIEW TEST FAILURES"))
    for f in failures:
        print("  -", f)
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
