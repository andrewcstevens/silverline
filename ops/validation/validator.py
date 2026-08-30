"""
Silverline model validator.

Checks a candidate `analysis.json` against the canonical schema (ops/validation/
schema.py) and against the prior known-good model. Returns a structured result;
it NEVER writes to production and NEVER mutates its inputs.

Rules (per OPS-02 spec):
  1. Valid JSON.
  2. Required fields and expected schema/version.
  3. Valid generated_at / data_through timestamps.  (mapped to data_start/data_end)
  4. Probabilities are within 0 to 1.
  5. Sample sizes are valid nonnegative numbers.
  6. Expected 15-minute slot coverage is present.
  7. Confidence-interval values are valid (ci_lo <= p_up <= ci_hi, in [0,1]).
  8. Candidate data did not unexpectedly collapse vs the prior known-good model.
  9. No raw Kalshi market records are present.
"""
from __future__ import annotations
import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

from . import schema as S


@dataclass
class ValidationFailure:
    rule: str
    detail: str


@dataclass
class ValidationResult:
    ok: bool
    failures: list[ValidationFailure] = field(default_factory=list)
    candidate_generation_time: Optional[str] = None
    data_through_time: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "ok": self.ok,
            "candidate_generation_time": self.candidate_generation_time,
            "data_through_time": self.data_through_time,
            "failures": [{"rule": f.rule, "detail": f.detail} for f in self.failures],
        }


def _iso_parse(s: str) -> Optional[datetime]:
    if not isinstance(s, str) or not s.strip():
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def _is_number(x) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def validate(candidate_path: str, prior_path: Optional[str] = None) -> ValidationResult:
    failures: list[ValidationFailure] = []

    # --- Rule 1: valid JSON ---
    raw_text = ""
    try:
        with open(candidate_path, "r") as f:
            raw_text = f.read()
    except OSError as e:
        failures.append(ValidationFailure("valid_json", f"could not read file: {e}"))
        return ValidationResult(False, failures)
    try:
        m = json.loads(raw_text)
    except json.JSONDecodeError as e:
        failures.append(ValidationFailure("valid_json", f"invalid JSON: {e}"))
        return ValidationResult(False, failures)
    if not isinstance(m, dict):
        failures.append(ValidationFailure("valid_json", "top-level JSON is not an object"))
        return ValidationResult(False, failures)

    # --- Rule 9 (checked early via raw text): no raw Kalshi records ---
    leaked = [k for k in S.RAW_KALSHI_MARKERS if f'"{k}"' in raw_text]
    if leaked:
        failures.append(ValidationFailure(
            "no_raw_kalshi_records",
            f"candidate contains raw Kalshi field markers: {leaked}. "
            "analysis.json must hold only computed aggregates.",
        ))

    # --- Rule 2: required top-level keys + schema version ---
    missing = [k for k in S.REQUIRED_TOP_KEYS if k not in m]
    if missing:
        failures.append(ValidationFailure("required_fields", f"missing top-level keys: {missing}"))
    if S.EXPECTED_SCHEMA_VERSION is not None and "schema_version" in m:
        if m["schema_version"] != S.EXPECTED_SCHEMA_VERSION:
            failures.append(ValidationFailure(
                "schema_version", f"schema_version={m.get('schema_version')!r} expected {S.EXPECTED_SCHEMA_VERSION!r}"))

    # --- Rule 3: valid timestamps ---
    ts_fields = list(S.TIMESTAMP_REQUIRED) + [k for k in S.TIMESTAMP_OPTIONAL if k in m]
    for k in ts_fields:
        v = m.get(k)
        if not _iso_parse(v):
            failures.append(ValidationFailure("timestamps", f"{k} is not a valid ISO timestamp: {v!r}"))
    # data_end must be >= data_start when both parse
    ds, de = _iso_parse(m.get("data_start")), _iso_parse(m.get("data_end"))
    if ds and de and de < ds:
        failures.append(ValidationFailure("timestamps", f"data_end ({m.get('data_end')}) precedes data_start ({m.get('data_start')})"))

    # --- Rule 4: probabilities in [0,1] ---
    for k in S.PROB_TOP_KEYS:
        v = m.get(k)
        if v is not None and (not _is_number(v) or not (0.0 <= v <= 1.0)):
            failures.append(ValidationFailure("probabilities", f"{k}={v!r} not in [0,1]"))
    if isinstance(m.get("histogram"), dict):
        for k in S.PROB_HIST_KEYS:
            v = m["histogram"].get(k)
            if v is not None and (not _is_number(v) or not (0.0 <= v <= 1.0)):
                failures.append(ValidationFailure("probabilities", f"histogram.{k}={v!r} not in [0,1]"))

    # --- Rule 5: sample sizes are nonnegative numbers ---
    for k in S.COUNT_TOP_KEYS:
        v = m.get(k)
        if v is None or not _is_number(v) or v < 0:
            failures.append(ValidationFailure("sample_sizes", f"{k}={v!r} not a nonnegative number"))

    # --- Rule 6: 15-minute slot coverage ---
    slots = m.get("slots")
    if not isinstance(slots, list):
        failures.append(ValidationFailure("slot_coverage", "'slots' is not a list"))
    else:
        seen = set()
        for i, s in enumerate(slots):
            if not isinstance(s, dict):
                failures.append(ValidationFailure("slot_coverage", f"slot[{i}] is not an object"))
                continue
            for k in S.SLOT_REQUIRED_KEYS:
                if k not in s:
                    failures.append(ValidationFailure("slot_coverage", f"slot[{i}] missing key '{k}'"))
            lbl = s.get("slot")
            if isinstance(lbl, str):
                seen.add(lbl)
            # per-slot probability + CI validity (rules 4 & 7 at slot level)
            p = s.get("p_up")
            ci_lo, ci_hi = s.get("ci_lo"), s.get("ci_hi")
            if p is not None and (not _is_number(p) or not (0.0 <= p <= 1.0)):
                failures.append(ValidationFailure("probabilities", f"slot {lbl} p_up={p!r} not in [0,1]"))
            if _is_number(ci_lo) and _is_number(ci_hi):
                if not (0.0 <= ci_lo <= 1.0 and 0.0 <= ci_hi <= 1.0):
                    failures.append(ValidationFailure("confidence_intervals", f"slot {lbl} CI out of [0,1]: [{ci_lo},{ci_hi}]"))
                elif ci_lo > ci_hi:
                    failures.append(ValidationFailure("confidence_intervals", f"slot {lbl} ci_lo>{ci_hi} (lo>hi)"))
                if _is_number(p) and not (ci_lo - 1e-9 <= p <= ci_hi + 1e-9):
                    failures.append(ValidationFailure("confidence_intervals", f"slot {lbl} p_up={p} outside CI [{ci_lo},{ci_hi}]"))
            n = s.get("n")
            up = s.get("up")
            if n is not None and (not _is_number(n) or n < 0):
                failures.append(ValidationFailure("sample_sizes", f"slot {lbl} n={n!r} not nonnegative"))
            if up is not None and (not _is_number(up) or up < 0):
                failures.append(ValidationFailure("sample_sizes", f"slot {lbl} up={up!r} not nonnegative"))
            if _is_number(n) and _is_number(up) and up > n:
                failures.append(ValidationFailure("sample_sizes", f"slot {lbl} up>{n} (up>n)"))
        missing_slots = set(S.FIFTEEN_MIN_SLOTS) - seen
        if missing_slots:
            failures.append(ValidationFailure("slot_coverage", f"missing {len(missing_slots)} 15-min slots: {sorted(missing_slots)[:8]}"))

    # --- Rule 7: best_edge CI sanity ---
    be = m.get("best_edge")
    if isinstance(be, dict):
        for k in ("p_win", "p_up", "ci_lo", "ci_hi"):
            v = be.get(k)
            if v is not None and (not _is_number(v) or not (0.0 <= v <= 1.0)):
                failures.append(ValidationFailure("confidence_intervals", f"best_edge.{k}={v!r} not in [0,1]"))
        if all(_is_number(be.get(k)) for k in ("ci_lo", "ci_hi")) and be["ci_lo"] > be["ci_hi"]:
            failures.append(ValidationFailure("confidence_intervals", "best_edge ci_lo>ci_hi"))

    # --- Rule 8: collapse vs prior known-good ---
    if prior_path:
        try:
            with open(prior_path) as f:
                prior = json.load(f)
            if isinstance(prior, dict):
                cn, pn = m.get("n_deltas"), prior.get("n_deltas")
                if _is_number(cn) and _is_number(pn) and pn > 0:
                    drop = (pn - cn) / pn
                    if drop > S.MAX_NDELTAS_DROP_PCT:
                        failures.append(ValidationFailure(
                            "collapse_check", f"n_deltas collapsed {drop:.1%} vs prior ({pn}->{cn}); max allowed {S.MAX_NDELTAS_DROP_PCT:.0%}"))
                cp, pp = m.get("p_up_overall"), prior.get("p_up_overall")
                if _is_number(cp) and _is_number(pp) and abs(cp - pp) > S.MAX_P_UP_SHIFT:
                    failures.append(ValidationFailure(
                        "collapse_check", f"p_up_overall shifted {cp-pp:+.3f} vs prior ({pp}->{cp}); max allowed ±{S.MAX_P_UP_SHIFT}"))
        except (OSError, ValueError) as e:
            failures.append(ValidationFailure("collapse_check", f"could not load prior known-good: {e}"))

    data_through = m.get("data_through") or m.get("data_end")
    gen_at = m.get("generated_at")
    return ValidationResult(
        ok=(len(failures) == 0),
        failures=failures,
        candidate_generation_time=gen_at,
        data_through_time=data_through if isinstance(data_through, str) else None,
    )
