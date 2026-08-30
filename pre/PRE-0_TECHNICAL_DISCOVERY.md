# PRE-0 — Price-Aware Signal Guardrails: Technical Discovery & Test Plan

**Last Updated:** 2026-08-30 14:22 PT
**Branch:** `feature/pre-0-guardrails`
**Artifacts:** `pre/guardrail.py` (reference implementation), `pre/test_guardrail.py` (12 tests, all pass)
**Safe-mode status:** documentation + isolated reference module + tests only. No production file modified. `master` untouched. The production PRE engine (`refresh_analysis.py` / `analysis.py`) lives in the cron session workspace and was NOT modified — see Blocker A.

---

## 1. The gap this closes

Silverline's Buy Signal / Golden Window currently ranks slots by **win-rate edge vs a hardcoded 50% break-even** (even-odds / 50¢ pricing). That rule is only correct when the contract actually trades at 50¢. Coinbase (and Kalshi) 15-min Up/Down contracts are priced anywhere across 1–99¢, and the price moves with demand. A slot with a 52% historical win rate is a genuine positive-EV bet at 50¢ (+2pp) but a **negative-EV bet at 53¢ (−1pp)** — yet today's Golden Window would flag it "golden" either way, because it never sees the price.

PRE-0 makes the signal **price-aware**: a slot is positive-EV only when its win probability beats the *actual* contract price, and the edge must be statistically significant *at that price* (the 95% CI excludes the price, not just 50%).

## 2. Current signal logic (read from production `index.html`)

The EV math already exists client-side in `renderEV()` (index.html lines 616-631):

```
p_win      = probability the chosen side wins (0..1)
price      = contract cost in ¢ per $1 payout (1..99)
ev         = p_win*stake - stake*(price/100)      // EV in $
break_even = p_win * 100                            // ¢ — the price at which EV=0
edge_pp    = (p_win - price/100) * 100              // = p_win*100 - price
// BUY iff ev > 0  i.e. p_win*100 > price
```

The Golden Window (`enrichUpcoming()`, lines 495-510) selects the soonest upcoming slot that is **significant AND `eff_p > 0.5`** (above the 50¢ break-even), tie-break highest rate, falling back to the highest significant effective rate ("Best Available") if nothing clears 50%.

So the EV *calculator* is already price-aware (the user types the price); the *signal generation* is not — it hardcodes the 0.5 threshold. PRE-0 connects the two.

## 3. Guardrail design (reference implementation: `pre/guardrail.py`)

Two functions, pure-Python, no production dependency:

### `price_aware_signal(slot, direction, p_win, ci_lo, ci_hi, n, price_cents, min_edge_pp=0)`

Verdict logic:

| Verdict | Condition | Meaning |
|---|---|---|
| **BUY** | positive EV AND CI lower bound excludes the contract price AND edge ≥ min_edge_pp | Win rate is statistically above the cost — a justified bet |
| **SPECULATIVE** | positive EV but CI includes the contract price | Edge is real but not statistically significant at this price |
| **PASS** | zero or negative EV | The contract is too expensive for this win rate |

Key formulas (mirror `renderEV`):
- `ev_per_dollar = p_win - price_cents/100`
- `break_even_price_cents = p_win * 100`
- `edge_pp = p_win*100 - price_cents`
- `sig_at_price = ci_lo > price_dollars` (the 95% CI excludes the cost — the price-aware upgrade of the legacy "CI excludes 50%" significance flag)

### `golden_window(edges, price_cents, min_edge_pp=0)`

Mirrors the live soonest-first / tie-break-highest logic, but with the contract price as break-even:
1. Golden = soonest slot that is **significant at price + positive EV + meets min edge** → verdict BUY.
2. Else soonest positive-EV slot → "Best Available", verdict SPECULATIVE (box stays honest, never labels a sub-break-even play golden).
3. Else `None` (verdict PASS / WAIT).

## 4. Worked examples (covered by tests)

| Slot | p_win | 95% CI | Price ¢ | EV/$ | Verdict | Why |
|---|---|---|---|---|---|---|
| 14:00 Over | 0.52 | 0.505–0.535 | 50 | +0.02 | BUY | +2pp, CI excludes 50¢ |
| 14:00 Over | 0.52 | 0.505–0.535 | 53 | −0.01 | PASS | **same win rate, but price too high — the core guardrail case** |
| 14:00 Over | 0.52 | 0.505–0.535 | 52 | 0.00 | PASS | break-even boundary |
| 14:00 Over | 0.54 | 0.48–0.60 | 50 | +0.04 | SPECULATIVE | +4pp but CI includes 50¢ |
| 14:00 Under | 0.52 (1−p_up) | 0.505–0.535 | 50 | +0.02 | BUY | Under side = 1 − p_up |

The decisive case: the same 52% slot is BUY at 50¢ and PASS at 53¢ — today's logic cannot tell those apart.

## 5. Test plan (`pre/test_guardrail.py` — 12/12 pass)

- `SingleSlotTests` (6): positive EV at even odds; **negative EV when price > win rate**; break-even boundary is PASS; SPECULATIVE when CI includes price; Under side uses 1−p_up; min-edge threshold blocks marginal BUY.
- `GoldenWindowTests` (4): picks soonest positive-EV; returns None when all below price; falls back to SPECULATIVE best-available; price changes the verdict (52% flips BUY→None as price rises 50→54¢).
- `ParityWithCurrentLogicTests` (2): at 50¢ the price-aware guardrail agrees with the legacy hardcoded-50% rule (BUY above 0.5, PASS below) — so it's a strict superset, not a behavior change at even odds.

Run: `python pre/test_guardrail.py` (stdlib `unittest`, no deps). `py_compile` clean.

## 6. File-level integration plan (for the live site — NOT applied)

This is a plan. All changes are additive and feature-branch-only; nothing existing is modified without Founder approval (D-002).

| Step | Where | Change | Risk to existing |
|---|---|---|---|
| 1 | `index.html` JS | Add a `priceAwareGolden(edges, priceCents, minEdgePp)` function (port of `pre/guardrail.py` `golden_window`) alongside `enrichUpcoming` | None — additive function |
| 2 | `index.html` JS | When the Kalshi proxy (CTO-02) returns a live contract price for the slot's market, pass it as `priceCents`; fall back to 50¢ (current behavior) if no price available | None — defaults to current logic when price is unknown |
| 3 | `index.html` JS | Use the price-aware verdict to label the Golden Window (BUY / Best Available·speculative / WAIT) and to gate the "My Bet → You'd Win" BUY hint | Low — changes the label/verdict string only, not the data |
| 4 | analysis pipeline (cron) | Optional server-side: add `price_cents` + `ev_per_dollar` + `verdict` to each `top_edges`/`slots` entry so the signal is price-aware at generation time | **Requires Blocker A** — `refresh_analysis.py`/`analysis.py` source must be read first (cron session `471139aa`) before any change |

**Gate:** when no live price is available, the price-aware function falls back to `price_cents=50`, which reproduces the current Golden Window exactly (verified by `ParityWithCurrentLogicTests`). So wiring PRE-0 can never make the signal worse than today — only more honest when a price is known.

## 7. Blocker A (unchanged, does not block this deliverable)

The production PRE engine (`refresh_analysis.py` / `analysis.py` / `candles.parquet`) lives in the cron session's persistent workspace (`/home/user/workspace/btc-wizard/`), not in the GitHub repo or this CTO sandbox. This reference module is a standalone, tested spec of the guardrail logic — it does not require reading those sources. Wiring it into the live analysis pipeline (Step 4) does require reading them first, and that's a Founder decision (#4 in the Founder Inbox).

## 8. Founder decisions needed

1. **Live price source** — wire the CTO-02 Kalshi proxy orderbook price into the Golden Window (requires the proxy merged + token/access model decided, Founder Inbox #3), or use a manual/configurable price assumption first?
2. **min_edge_pp floor** — should a minimum edge threshold (e.g. +1pp or +2pp) gate BUY to avoid marginal plays, or keep it at 0 and let significance do the work?
3. **SPECULATIVE labeling** — surface the SPECULATIVE tier in the UI (a third verdict state), or keep the box binary (BUY / WAIT) and just suppress speculative slots?
4. **Server-side vs client-side** — port the guardrail into the analysis pipeline (Step 4, needs Blocker A) so `analysis.json` ships price-aware verdicts, or keep it client-side only?

## 9. Checks run

- `python pre/test_guardrail.py` — 12/12 pass.
- `python -m py_compile pre/guardrail.py pre/test_guardrail.py` — clean.
- Code review: reference module is pure-Python, no production imports, no mutation of analysis.json/PRE/index.html.

## 10. Not done (safe-mode compliance)

- No edit to production `index.html`, `analysis.json`, the ledger, the live PRE engine, or any existing file.
- No merge, no deploy to Vercel/production.
- The guardrail is a standalone reference module + tests on `feature/pre-0-guardrails`.
