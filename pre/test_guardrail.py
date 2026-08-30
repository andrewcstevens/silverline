"""
Tests for the PRE-0 price-aware signal guardrail.

Run:  python -m pytest pre/test_guardrail.py -v
      (or: python pre/test_guardrail.py   for the standalone runner)
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import unittest

from guardrail import price_aware_signal, golden_window, SlotEdge


def _edge(slot, p_win, ci_lo, ci_hi, n=600, minutes=30, direction="Over", sig=True):
    return SlotEdge(slot=slot, direction=direction, p_win=p_win,
                    ci_lo=ci_lo, ci_hi=ci_hi, n=n, significant=sig,
                    minutes_until=minutes)


class SingleSlotTests(unittest.TestCase):

    def test_positive_ev_at_even_odds(self):
        # 52% win, contract 50¢ -> +2pp EV, CI excludes price -> BUY
        s = price_aware_signal("14:00", "Over", 0.52, 0.505, 0.535, n=872, price_cents=50)
        self.assertTrue(s.positive_ev)
        self.assertTrue(s.sig_at_price)
        self.assertAlmostEqual(s.ev_per_dollar, 0.02)
        self.assertAlmostEqual(s.break_even_price_cents, 52.0)
        self.assertAlmostEqual(s.edge_pp, 2.0)
        self.assertEqual(s.verdict, "BUY")

    def test_negative_ev_when_price_above_winrate(self):
        # 52% win but contract 53¢ -> -1pp EV -> PASS (the core guardrail case)
        s = price_aware_signal("14:00", "Over", 0.52, 0.505, 0.535, n=872, price_cents=53)
        self.assertFalse(s.positive_ev)
        self.assertAlmostEqual(s.edge_pp, -1.0)
        self.assertEqual(s.verdict, "PASS")

    def test_break_even_boundary_is_pass(self):
        # p_win exactly equals price -> zero EV -> PASS (not BUY)
        s = price_aware_signal("14:00", "Over", 0.52, 0.505, 0.535, n=872, price_cents=52)
        self.assertFalse(s.positive_ev)
        self.assertEqual(s.verdict, "PASS")

    def test_speculative_when_ci_includes_price(self):
        # 54% win, contract 50¢ -> +4pp EV, but CI [0.48,0.60] includes 50¢ -> SPECULATIVE
        s = price_aware_signal("14:00", "Over", 0.54, 0.48, 0.60, n=120, price_cents=50)
        self.assertTrue(s.positive_ev)
        self.assertFalse(s.sig_at_price)  # 0.48 < 0.50
        self.assertEqual(s.verdict, "SPECULATIVE")

    def test_under_side_uses_one_minus_p_up(self):
        # direction Under: p_win = 1 - p_up. A 48% Up slot is a 52% Under bet.
        s = price_aware_signal("14:00", "Under", 0.52, 0.505, 0.535, n=872, price_cents=50)
        self.assertEqual(s.verdict, "BUY")
        self.assertAlmostEqual(s.edge_pp, 2.0)

    def test_min_edge_threshold_blocks_marginal_buy(self):
        # +2pp EV but min_edge_pp=3 -> not enough edge -> SPECULATIVE (positive EV, below threshold)
        s = price_aware_signal("14:00", "Over", 0.52, 0.505, 0.535, n=872, price_cents=50, min_edge_pp=3.0)
        self.assertEqual(s.verdict, "SPECULATIVE")


class GoldenWindowTests(unittest.TestCase):

    def test_golden_picks_soonest_positive_ev_at_price(self):
        edges = [
            _edge("04:30", 0.548, 0.512, 0.583, n=610, minutes=30),   # +4.8pp, BUY
            _edge("14:00", 0.564, 0.531, 0.596, n=872, minutes=90),   # +6.4pp, BUY
        ]
        gw = golden_window(edges, price_cents=50)
        self.assertIsNotNone(gw)
        self.assertEqual(gw.slot, "04:30")  # soonest
        self.assertEqual(gw.verdict, "BUY")

    def test_no_golden_when_all_below_price(self):
        # all 52% win, contract 53¢ -> all PASS
        edges = [_edge("14:00", 0.52, 0.505, 0.535, minutes=30)]
        gw = golden_window(edges, price_cents=53)
        self.assertIsNone(gw)

    def test_falls_back_to_speculative_best_available(self):
        # positive EV but CI includes price -> SPECULATIVE, not None
        edges = [_edge("14:00", 0.54, 0.48, 0.60, n=120, minutes=30)]
        gw = golden_window(edges, price_cents=50)
        self.assertIsNotNone(gw)
        self.assertEqual(gw.verdict, "SPECULATIVE")

    def test_price_changes_the_golden_window(self):
        # Same slots, but contract 54¢ -> the 52% slot flips from BUY to PASS
        edges = [_edge("14:00", 0.52, 0.505, 0.535, n=872, minutes=30)]
        self.assertEqual(golden_window(edges, price_cents=50).verdict, "BUY")
        # At 54¢ a 52% win slot is negative-EV, so there is no Golden Window.
        self.assertIsNone(golden_window(edges, price_cents=54))


class ParityWithCurrentLogicTests(unittest.TestCase):
    """At 50¢ (even odds), the price-aware guardrail should agree with the
    current hardcoded-50% Golden Window rule for the BUY/PASS decision."""

    def test_at_50cents_matches_legacy_break_even(self):
        # Current rule: eff_p > 0.5 and significant -> golden.
        # Price-aware at 50¢: p_win > 0.50 and CI excludes 0.50 -> BUY.
        edges = [_edge("14:00", 0.52, 0.505, 0.535, n=872, minutes=30)]
        gw = golden_window(edges, price_cents=50)
        self.assertEqual(gw.verdict, "BUY")  # parity with legacy

    def test_at_50cents_below_break_even_is_pass(self):
        edges = [_edge("14:00", 0.49, 0.46, 0.52, n=872, minutes=30)]
        gw = golden_window(edges, price_cents=50)
        self.assertIsNone(gw)  # legacy: below break-even -> not golden


if __name__ == "__main__":
    unittest.main(verbosity=2)
