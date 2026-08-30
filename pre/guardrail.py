"""
Silverline PRE — Price-Aware Signal Guardrails (reference implementation).

REEDING reference module for PRE-0. This is a standalone, pure-Python reference
implementation of the price-aware signal guardrail. It is NOT wired into the
production analysis pipeline (refresh_analysis.py / analysis.py, which live in
the cron session workspace) and it does NOT modify any production file.

Purpose: capture, in tested code, the rule that a slot's edge must be evaluated
against the ACTUAL contract price (not a hardcoded 50% even-odds break-even),
and that the edge must be statistically significant AT that price.

The EV math mirrors the live index.html `renderEV()` (lines 616-631):
    ev_per_dollar = p_win - price_dollars          # price_dollars = price_cents/100
    break_even_price_cents = p_win * 100
    edge_pp = p_win*100 - price_cents               # = ev_per_dollar * 100
A bet is positive-EV iff p_win*100 > price_cents.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, List


@dataclass(frozen=True)
class PriceAwareSignal:
    slot: str
    direction: str            # 'Over' | 'Under'
    p_win: float              # 0..1 probability the chosen side wins
    ci_lo: float              # 0..1 lower bound of 95% CI on p_win
    ci_hi: float              # 0..1 upper bound
    n: int
    price_cents: float        # contract cost in cents per $1 payout (1..99)
    ev_per_dollar: float      # expected $ profit per $1 of NOTIONAL payout exposure
                              # (matches live renderEV ev/stake; NOT cash ROI per $1 spent)
    break_even_price_cents: float  # price (¢) at which EV = 0
    edge_pp: float            # edge vs price, in percentage points (= ev_per_dollar*100)
    positive_ev: bool         # ev_per_dollar > 0  (i.e. p_win*100 > price_cents)
    sig_at_price: bool        # CI lower bound excludes the contract price
    verdict: str              # 'BUY' | 'SPECULATIVE' | 'PASS'
    reason: str


def from_p_up(direction: str, p_up: float, ci_up_lo: float, ci_up_hi: float):
    """Convert an Over-side probability (and its CI) to the chosen side's.

    For 'Over', p_win = p_up. For 'Under', p_win = 1 - p_up AND the CI bounds
    flip: the lower bound becomes 1 - ci_up_hi, the upper 1 - ci_up_lo.
    Returns (p_win, ci_lo, ci_hi).
    """
    if direction == "Over":
        return p_up, ci_up_lo, ci_up_hi
    return (1.0 - p_up), (1.0 - ci_up_hi), (1.0 - ci_up_lo)


def price_aware_signal(
    slot: str,
    direction: str,
    p_win: float,
    ci_lo: float,
    ci_hi: float,
    n: int,
    price_cents: float,
    min_edge_pp: float = 0.0,
) -> PriceAwareSignal:
    """Evaluate a single slot against a contract price.

    verdict logic:
      BUY        — positive EV AND the 95% CI excludes the contract price
                   (i.e. the win rate is statistically above the cost) AND
                   edge >= min_edge_pp.
      SPECULATIVE — positive EV but the CI includes the contract price
                   (edge is real but not statistically significant at this price).
      PASS       — negative or zero EV (the contract is too expensive for this win rate).
    """
    price_dollars = price_cents / 100.0
    ev_per_dollar = p_win - price_dollars   # $ profit per $1 notional (live renderEV ev/stake)
    break_even_price_cents = p_win * 100.0
    edge_pp = (p_win - price_dollars) * 100.0
    positive_ev = ev_per_dollar > 0
    # Significant at price: the lower CI bound is above the contract price,
    # so we're statistically confident the true win rate exceeds the cost.
    sig_at_price = ci_lo > price_dollars

    if positive_ev and sig_at_price and edge_pp >= min_edge_pp:
        verdict, reason = "BUY", "positive EV, CI excludes contract price"
    elif positive_ev:
        verdict, reason = "SPECULATIVE", "positive EV but CI includes contract price"
    else:
        verdict, reason = "PASS", "negative or zero EV at this contract price"

    return PriceAwareSignal(
        slot=slot, direction=direction, p_win=p_win, ci_lo=ci_lo, ci_hi=ci_hi,
        n=n, price_cents=price_cents, ev_per_dollar=ev_per_dollar,
        break_even_price_cents=break_even_price_cents, edge_pp=edge_pp,
        positive_ev=positive_ev, sig_at_price=sig_at_price,
        verdict=verdict, reason=reason,
    )


@dataclass(frozen=True)
class SlotEdge:
    """Minimal shape of an upcoming edge slot (mirrors analysis.json top_edges)."""
    slot: str
    direction: str
    p_win: float        # 0..1 effective win rate (weekday-adjusted when n>=50)
    ci_lo: float
    ci_hi: float
    n: int
    significant: bool   # legacy: CI excludes 50%
    minutes_until: float


def golden_window(
    edges: List[SlotEdge],
    price_cents: float,
    min_edge_pp: float = 0.0,
) -> Optional[PriceAwareSignal]:
    """Price-aware Golden Window.

    Mirrors the live `enrichUpcoming()` Golden Window rule (lines 495-510) but
    replaces the hardcoded 50% break-even with the actual contract price.

    Selection (soonest-first, tie-break highest edge):
      1. significant at price (CI excludes contract price) AND positive EV
         AND edge >= min_edge_pp  -> the Golden Window (verdict BUY).
      2. else, the soonest positive-EV slot  -> shown as 'Best Available'
         (verdict SPECULATIVE) so the box never labels a sub-break-even
         play as golden.
      3. else None (verdict PASS / WAIT).

    Returns the chosen slot's PriceAwareSignal, or None if nothing clears
    positive EV at the given price.
    """
    ranked = sorted(edges, key=lambda e: (
        e.minutes_until if e.minutes_until > 0 else 0,
        -e.p_win,
    ))

    def eval_slot(e: SlotEdge) -> PriceAwareSignal:
        return price_aware_signal(
            e.slot, e.direction, e.p_win, e.ci_lo, e.ci_hi, e.n,
            price_cents, min_edge_pp,
        )

    # 1. Golden: significant at price + positive EV + meets min edge
    golden_candidates = [e for e in ranked if eval_slot(e).verdict == "BUY"]
    if golden_candidates:
        return eval_slot(golden_candidates[0])

    # 2. Best available: soonest positive-EV (speculative)
    pos_candidates = [e for e in ranked if eval_slot(e).positive_ev]
    if pos_candidates:
        return eval_slot(pos_candidates[0])

    # 3. Nothing positive-EV at this price
    return None
