"""
Canonical schema for Silverline `analysis.json` (the baked edge model).

Derived from the REAL production analysis.json (inspected 2026-08-29), not from
memory. This is the contract the validator checks candidates against.

Current production model has NO `generated_at` / `data_through` fields; the
canonical timestamps are `data_start` and `data_end`. The validator accepts
optional `generated_at` / `data_through` if a future schema adds them, but the
required timestamp fields are `data_start` and `data_end`.
"""

# Schema version this validator expects. Bump when the production model shape
# changes intentionally; the validator rejects candidates whose declared
# schema_version is unknown/incompatible (absence of the field is allowed —
# the current model does not declare one).
EXPECTED_SCHEMA_VERSION = None  # None = field optional, not enforced

# Required top-level keys (must all be present).
REQUIRED_TOP_KEYS = [
    "n_deltas", "n_up", "n_down", "p_up_overall",
    "mean_bps", "median_bps", "std_bps",
    "slots", "day_slots", "night_slots", "weekdays",
    "slot_weekday", "histogram", "top_edges", "best_edge",
    "data_start", "data_end",
]

# Canonical timestamp fields. data_start/data_end are required (real schema).
# generated_at/data_through are accepted if present (future schema).
TIMESTAMP_REQUIRED = ["data_start", "data_end"]
TIMESTAMP_OPTIONAL = ["generated_at", "data_through"]

# Probability fields that must be in [0, 1].
PROB_TOP_KEYS = ["p_up_overall"]
PROB_HIST_KEYS = ["p_up_overall"]

# Per-slot required keys.
SLOT_REQUIRED_KEYS = ["slot", "n", "up", "p_up", "ci_lo", "ci_hi"]

# Sample-size (nonnegative integer) top-level keys.
COUNT_TOP_KEYS = ["n_deltas", "n_up", "n_down"]

# The 96 fifteen-minute slot labels the `slots` array is expected to cover.
FIFTEEN_MIN_SLOTS = [f"{h:02d}:{m:02d}" for h in range(24) for m in (0, 15, 30, 45)]

# best_edge required keys.
BEST_EDGE_KEYS = ["slot", "direction", "p_win", "p_up", "ci_lo", "ci_hi", "n"]

# Collapse-detection thresholds vs the prior known-good model.
# A candidate is "unexpectedly collapsed" if:
#   - n_deltas dropped by more than MAX_NDELTAS_DROP_PCT vs prior, OR
#   - p_up_overall shifted by more than MAX_P_UP_SHIFT from prior.
MAX_NDELTAS_DROP_PCT = 0.25   # >25% drop in sample size is implausible
MAX_P_UP_SHIFT = 0.20        # >0.20 absolute shift in base rate is implausible

# Raw Kalshi record markers. analysis.json must contain ONLY computed aggregates
# — never raw Kalshi market records. If any of these keys appears in the
# candidate JSON, it is rejected as a raw-data leak. (Names verified against the
# live Kalshi schema in OPS-01: settlement_ts, volume_fp, floor_strike, etc.)
RAW_KALSHI_MARKERS = [
    "event_ticker", "expiration_value", "floor_strike", "settlement_ts",
    "volume_fp", "volume_24h_fp", "open_interest_fp", "yes_bid_dollars",
    "yes_ask_dollars", "no_bid_dollars", "no_ask_dollars", "settlement_value_dollars",
    "rules_primary", "price_level_structure",
]
