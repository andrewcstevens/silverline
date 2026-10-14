# Silverline × Jev Shadow Test — Recon (Step 1)

**Branch:** `jev-shadow-test` (off `origin/master`) — created from a **fresh clone**, not the daily cron's checkout, so the scheduled refresh never sees this branch.
**Date:** 2026-09-21
**Purpose:** Read PRE end-to-end so the shadow log records exactly what PRE knew at decision time, so Jev can be scored against the same truth.

---

## 1. Where 15-min price marks are ingested

PRE runs **entirely in the browser**, on two inputs:

| Input | Source | Refresh |
|---|---|---|
| **Historical edge model** | `analysis.json` (committed build artifact at the repo root, regenerated daily by `refresh_analysis.py` in the daily cron sandbox) | loaded once per page load |
| **Live spot price** | `COINBASE_SPOT` (`api.coinbase.com/v2/prices/BTC-USD/spot`) with fallback `COINBASE_TICKER` (exchange bid/ask mid) | every 30s |
| **Current time** | `Intl.DateTimeFormat` with `timeZone: America/New_York` → current slot `HH:MM` on :00/:15/:30/:45 | recompute every 60s |

No pasted transaction text feeds PRE — the manual bet ledger (localStorage) is downstream output, not an input to the signal.

PRE's price marks are therefore:
- **At decision time:** the live Coinbase spot at the moment `refreshSignal()` fires.
- **At outcome time:** the Coinbase spot price ~15 minutes later, when the next `refreshSignal()` or `refreshSpot()` lands on the new boundary.

## 2. The exact feature vector PRE computes at each mark

PRE is a **slot+weekday lookup**, not a live feature model. `buildRecommend(an, now)` produces:

- `current_slot` (ET `HH:MM`, floor to 15 min)
- `current_slot_stat` from `analysis.json → slots[]` (match by `slot`):
  - `n` (sample size, min 200 to "take seriously")
  - `p_up` (historical P(up) for that slot, all days)
  - `ci_lo`, `ci_hi` (Wilson 95% CI)
- **Weekday refinement** via `analysis.json → slot_weekday[slot][weekday]`:
  - `p_up_today` (weekday-specific P(up))
  - `n_today`, `today_ci_lo`, `today_ci_hi`
- **Effective rate** (`eff_p`): the value PRE actually bets on:
  - weekday-specific rate when `n_today ≥ 50`, else the overall slot rate
  - `eff_sig` (significance): true if weekday cell used or slot flagged significant
- `p_up_overall`, `n_deltas` (global base rate, ~50% by construction)
- For each ranked `top_edges` (top 8 slots by |edge|, `MIN_N_SLOT=200`): `slot`, `direction` ("Over"/"Under"), `p_win`, `edge_pp` (p_win − 0.5 in pp), `significant`
- For each upcoming window: `minutes_until`, `day_iso`, `next_when`, `p_win_today` / `eff_p` for the slot+weekday combination
- Live spot: `price`, `price_time`

So the **runtime feature vector is** (per decision, per slot):
`{ current_slot, weekday, spot_price, slot.p_up, slot.n, slot.ci_lo, slot.ci_hi, slot_weekday.p_up_today, slot_weekday.n_today, slot_weekday.today_ci_lo, slot_weekday.today_ci_hi, eff_p, eff_sig, p_up_overall, n_deltas, top_edges[], edge_pp, significant }`

The backend (`analysis.py`) computes the model the frontend looks up against: 15-min same-day close-to-close deltas, `up = ret > 0`, Wilson CI, `MIN_N_SLOT=200`, `MIN_N_WEEKDAY=400`.

## 3. Where PRE emits its up/down/abstain decision and any confidence value

**Emission point:** `renderBuySignal()` — wired to the "Buy Signal" panel and "Golden Window" callout, recomputed every 60s and re-rendered every 1s (countdown) / 30s (spot).

The decision is the **Golden Window** (`enrichUpcoming` → `upc.recommended`), defined as: **the soonest upcoming slot whose effective win rate is significant AND above 50%**, tie-break by highest rate, and if nothing clears break-even the fallback "Best Available · below break-even" with verdict WAIT.

Per that recommendation PRE publishes:
- `direction` ("Over" / "Under") — the **decision**
- `eff_p` (the win rate for the favored side) — closest thing to a **confidence**, but it's a historical hit rate, not a model confidence
- `ev` = `eff_p × 2×bet − bet` (even-odds payout preview)
- `bsVerd`: "BUY Over/Under @ HH:MM ET" vs "WAIT — wins under 50% for this day"
- No explicit **abstain** class — WAIT is the closest analogue (fires when `ev ≤ 0` or no qualifying slot exists).

PRE's **abstain-equivalent** is: `eff_sig` false, or `eff_p ≤ 0.5`, or no Golden Window found at all.

## 4. How actual interval outcomes can be derived

The outcome of each 15-min mark is whether BTC went up or down over that interval:

- **At the current mark:** the `close_price` at t+15 minus the `open_price` at t=0 (i.e. Coinbase spot at t+15 vs Coinbase spot at t=0). PRE's own model already defines `up = close_t / close_{t-1} - 1 > 0` (same-day adjacent, no overnight gap).
- **Authoritative source (preferred for shadow test):** Kalshi's settled `KXBTC15M` markets. `backend/kalshi_backfill.py` (committed, unmodified) already demonstrates: 24,415 settled markets, 2025-12-10 → 2026-08-30 (~262 days), each with `result` ("yes"/"no"), `expiration_value` (final benchmark price), `floor_strike` (target), `close_time`. Base rate over that archive: yes 0.4993 / no 0.5007 — near coin-flip, exactly as the compliance language says.

**Hard rule preserved:** spot close may calibrate the model, but must never auto-resolve Andrew's real-money ledger bets. Outcome fields in the shadow log are a model-calibration record only.

---

## 5. Assumptions / unverified (running list)

1. **Branch base:** brief says "off `main`"; the repo's default branch is `master` (`origin/HEAD → origin/master`). Branched from `origin/master`; recorded as a discrepancy with the brief, not a violation.
2. **PRE is read from the live checkout, not reconstructed from memory.** `index.html` lines 340–763 and `analysis.py` were read directly.
3. **The repo's `analysis.json` is a build artifact**, regenerated daily by `refresh_analysis.py`, which is NOT version-controlled (Blocker A in `backend/README.md`). The shadow test must not depend on the model file's provenance — it reads the runtime inputs at decision time.
4. **Deploy reality:** production is NOT deployed from this repo (CLI uploads, no git metadata, RE-0). Pushing `jev-shadow-test` will not affect the live site.
5. **The Kalshi archive is a measured prototype** from Aug 30 2026 — 24,415 settled markets over 262 days. Whether the archive can be re-paginated to keep extending this live (not just as a one-time snapshot) is unverified — Kalshi's `/historical/cutoff` currently sits at 2026-06-30, and Kalshi's exact archive-depth policy for this series is unconfirmed.
6. **Jev API shape read from live docs** (`docs.typesafe.ai`) — the Choice primitive, HTTP API endpoint, and confidence semantics are captured in `02-schema.md`'s "Jev proxy" section. The proxy itself (Step 4) must re-verify against the live docs before writing code.
7. **Jev's decision target** maps cleanly to a Choice over `up` / `down` / `abstain`; `confidence` is Jev's own number derived from the probability distribution (see `docs.typesafe.ai/confidence.md`). No attempt made to reuse PRE's historical hit rate as Jev's confidence.
8. **Crypto API shape for Coinbase fees / live contract prices:** not ingested anywhere in PRE. The "realized edge minus fees" step (Step 5) will require either a fixed fee assumption or a new input source — flagged for the schema to expose a column for, so it's additive, not retrofitted.
9. **The daily refresh cron (cf411975) writes to `analysis.json` on `master`** — the shadow log will be a separate, append-only CSV in `/data/shadow-log.csv`, never touched by PRE's model pipeline.
10. **No PR will be opened** — the branch is a hand-back review artifact.

---

## 6. What changes nothing

- No change to `analysis.json`.
- No change to `index.html`, `assets/`, `backend/`, or `ops/`.
- No change to the daily refresh cron.
- No deploy.
