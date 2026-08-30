"""
Fixture generator for the OPS-02 preview-only test mode.

Builds a VALID base model (complete, 96-slot, schema-correct) plus derived
"broken" variants that each isolate one validation rule. Outputs are written to
ops/_preview/fixtures/ (gitignored — these are simulated candidate outputs, not
source). The generator script itself is committed; its outputs are not.

Nothing here touches master, production analysis.json, the live ledger, Vercel,
or real Kalshi data.
"""
from __future__ import annotations
import os
import json
import copy

HERE = os.path.dirname(__file__)
FIXTURE_DIR = os.path.join(HERE, "_preview", "fixtures")

SLOTS = [f"{h:02d}:{m:02d}" for h in range(24) for m in (0, 15, 30, 45)]


def _slot(i: int) -> dict:
    n = 1000 + i
    up = 500 + (i % 7)
    p = up / n
    return {
        "slot": SLOTS[i],
        "n": n,
        "up": up,
        "p_up": round(p, 6),
        "ci_lo": round(max(0.0, p - 0.03), 6),
        "ci_hi": round(min(1.0, p + 0.03), 6),
        "mean_ret_bps": 0.15,
        "median_ret_bps": 0.12,
    }


def make_valid_model() -> dict:
    return {
        "n_deltas": 100000,
        "n_up": 50200,
        "n_down": 49800,
        "p_up_overall": 0.502,
        "mean_bps": 0.14,
        "median_bps": 0.10,
        "std_bps": 25.4,
        "pct_5": -36.0,
        "pct_95": 36.3,
        "slots": [_slot(i) for i in range(96)],
        "day_slots": [_slot(i) for i in range(48)],
        "night_slots": [_slot(i) for i in range(48)],
        "weekdays": [{"weekday": d, "n": 14000, "up": 7000, "p_up": 0.5, "ci_lo": 0.48, "ci_hi": 0.52} for d in range(7)],
        "slot_weekday": {s: {"n": 140, "up": 70, "p_up": 0.5, "ci_lo": 0.4, "ci_hi": 0.6} for s in SLOTS[:8]},
        "histogram": {"centers": [0], "counts": [100000], "p_up_overall": 0.502, "mean_bps": 0.14, "median_bps": 0.10, "std_bps": 25.4, "n": 100000},
        "top_edges": [{"slot": "09:30", "direction": "up", "p_win": 0.55, "p_up": 0.55, "ci_lo": 0.50, "ci_hi": 0.60, "n": 1000, "mean_bps": 1.2}] * 8,
        "best_edge": {"slot": "09:30", "direction": "up", "p_win": 0.55, "p_up": 0.55, "ci_lo": 0.50, "ci_hi": 0.60, "n": 1000, "mean_bps": 1.2},
        "data_start": "2023-08-27T10:45:00+00:00",
        "data_end": "2026-08-29T13:15:00+00:00",
    }


def _write(name: str, model) -> str:
    os.makedirs(FIXTURE_DIR, exist_ok=True)
    p = os.path.join(FIXTURE_DIR, name)
    with open(p, "w") as f:
        json.dump(model, f) if not isinstance(model, str) else f.write(model)
    return p


def generate_all() -> dict[str, str]:
    """Generate the valid base + all broken variants. Returns name->path map."""
    base = make_valid_model()
    paths = {}

    # 1. valid candidate
    paths["valid"] = _write("valid_candidate.json", base)

    # 2. malformed JSON
    paths["malformed"] = _write("malformed.json", '{"n_deltas": 100000, not valid json')

    # 3. probabilities out of [0,1]
    bad = copy.deepcopy(base)
    bad["p_up_overall"] = 1.5
    bad["slots"][0]["p_up"] = -0.2
    paths["bad_probs"] = _write("bad_probs.json", bad)

    # 4. negative sample size
    neg = copy.deepcopy(base)
    neg["n_deltas"] = -5
    paths["bad_counts"] = _write("bad_counts.json", neg)

    # 5. missing 15-min slot coverage
    nocov = copy.deepcopy(base)
    nocov["slots"] = nocov["slots"][:50]
    paths["missing_slots"] = _write("missing_slots.json", nocov)

    # 6. invalid confidence interval (lo>hi, p outside CI)
    badci = copy.deepcopy(base)
    badci["slots"][0]["ci_lo"] = 0.60
    badci["slots"][0]["ci_hi"] = 0.40
    paths["bad_ci"] = _write("bad_ci.json", badci)

    # 7. collapse vs prior: n_deltas tiny vs the valid prior
    coll = copy.deepcopy(base)
    coll["n_deltas"] = 10  # ~99.99% drop vs prior 100000
    paths["collapsed"] = _write("collapsed.json", coll)

    # 8. raw Kalshi record leak
    leak = copy.deepcopy(base)
    leak["_stray_kalshi"] = {"event_ticker": "KXBTC15M-26AUG292145", "floor_strike": 78073.57, "expiration_value": "78073.57"}
    paths["raw_leak"] = _write("raw_leak.json", leak)

    return paths


if __name__ == "__main__":
    print("Generating OPS-02 preview fixtures into", FIXTURE_DIR)
    for name, path in generate_all().items():
        print(f"  {name}: {path}")
