# Shadow-log CSV schema (Step 2) — for Andrew's approval

**Purpose:** one row per 15-min interval, capturing (a) the features PRE saw at decision time, (b) PRE's own call, (c) the interval's actual outcome, (d) enough market/fee context to estimate realized edge for both PRE and Jev. Outcome fields stay **nullable** until the interval closes — a prediction row and an outcome row can be the same row, with `outcome_*` filled in a later pass.

**Location (to be created in Step 3, after approval):** `/data/shadow-log.csv` (append-only; one file, no rotation).

---

## Columns

### Identity / timing
| Column | Type | Notes |
|---|---|---|
| `interval_start_utc` | ISO-8601 UTC timestamp | start of the 15-min interval |
| `interval_end_utc` | ISO-8601 UTC timestamp | `interval_start_utc` + 15 min (the close boundary) |
| `feature_logged_at_utc` | ISO-8601 UTC timestamp | when PRE's row was captured (decision time) |
| `outcome_logged_at_utc` | ISO-8601 UTC timestamp, nullable | when outcome was filled in (blank until resolved) |
| `outcome_source` | string, nullable | `"kalshi"` \| `"coinbase_spot"` \| `"manual"` — which feed resolved it |
| `slot_et` | string `HH:MM` | ET wall-clock slot the interval started in (PRE's own key) |
| `weekday_et` | string `Mon..Sun` | ET weekday |
| `is_day_session_et` | boolean | true when slot is 08:00–20:00 ET (matches PRE's Day/Night split) |

### Market at decision time (the features PRE sees)
| Column | Type | Notes |
|---|---|---|
| `open_price` | float, nullable | Coinbase BTC-USD spot at `interval_start_utc` |
| `contract_price_cents` | float, nullable | Coinbase/Kalshi contract price in ¢ at decision time (Jev + PRE both need this for edge) |
| `volume_fp` | float, nullable | Kalshi market volume (if reachable at decision time) |
| `open_interest_fp` | float, nullable | Kalshi open interest (if reachable at decision time) |
| `market_ticker` | string, nullable | Kalshi `KXBTC15M-…` ticker when known |

### PRE's historical model inputs (from `analysis.json`, read at decision time)
| Column | Type | Notes |
|---|---|---|
| `slot_n` | int | slot's historical sample size |
| `slot_p_up` | float | slot's historical P(up), all days |
| `slot_ci_lo` / `slot_ci_hi` | float | Wilson 95% CI on `slot_p_up` |
| `slot_mean_ret_bps` | float | slot's mean 15-min return in bps |
| `wd_n` | int | weekday-specific sample size for this slot |
| `wd_p_up` | float | weekday-specific P(up) |
| `wd_ci_lo` / `wd_ci_hi` | float | CI on `wd_p_up` |
| `p_up_overall` | float | global base rate (~0.50) |
| `top_edges_summary` | JSON string | PRE's top-8 ranked slots + `edge_pp` + `significant` — captured as one JSON cell so the schema stays flat |

### PRE's own decision
| Column | Type | Notes |
|---|---|---|
| `pre_selected_side` | string | `"Over"` \| `"Under"` \| `"abstain"` — from the Golden Window (or `abstain` if none / WAIT) |
| `pre_decision` | string | `"up"` \| `"down"` \| `"abstain"` — normalised view of the same call for Jev's comparison key |
| `pre_confidence` | float | PRE's **effective win rate** (`eff_p`) for the selected side — NOT a calibrated model confidence, recorded as-is for honesty |
| `pre_probability_up` | float | P(up) PRE would have published for this interval |
| `pre_probability_down` | float | `1 − pre_probability_up` |
| `pre_win_prob` | float | win prob for the selected side (`p_win`) |
| `pre_ci_low` / `pre_ci_high` | float | CI on `pre_win_prob` |
| `pre_edge_pp` | float | `p_win − 0.5` in pp |
| `pre_significant` | boolean | `eff_sig` |
| `pre_is_golden_window` | boolean | whether this interval's slot was the recommended Golden Window |
| `pre_verdict` | string | e.g. `"BUY Over @ 04:30 ET"` \| `"WAIT — wins under 50% for this day"` |
| `pre_model_data_end` | ISO-8601 | the `analysis.json` `data_end` the decision was made against (so shadow rows can be tied to the model version) |

### Outcome (filled in later — nullable until resolved)
| Column | Type | Notes |
|---|---|---|
| `close_price` | float, nullable | Coinbase BTC-USD spot at `interval_end_utc` |
| `outcome_up_down` | string, nullable | `"up"` \| `"down"` — actual result of the interval |
| `outcome_kalshi_result` | string, nullable | `"yes"` \| `"no"` from Kalshi's settled `KXBTC15M` market |
| `outcome_kalshi_expiration_value` | float, nullable | Kalshi `expiration_value` (final benchmark) |
| `outcome_kalshi_floor_strike` | float, nullable | Kalshi `floor_strike` (target) |
| `outcome_return_bps` | float, nullable | `(close/open − 1) × 10,000` |
| `pnl_pre_if_bet` | float, nullable | if a fixed notional bet on PRE's call were placed — computed for shadow report only, never touches the real-money ledger |
| `pnl_jev_if_bet` | float, nullable | same, for Jev's call |
| `fee_model` | string, nullable | `"fixed_cents_per_contract"` \| `"none"` \| `"custom"` — documents the fee assumption used in the shadow P&L |

### Jev's call (filled by the proxy, nullable until replay)
| Column | Type | Notes |
|---|---|---|
| `jev_selected_side` | string, nullable | `"up"` \| `"down"` \| `"abstain"` |
| `jev_confidence` | float, nullable | Jev's own `confidence` (0–1, from `probabilities` shape) |
| `jev_probabilities` | JSON string, nullable | Jev's full probability distribution (e.g. `{"up":0.56,"down":0.41,"abstain":0.03}`) |
| `jev_model` | string, nullable | e.g. `"jev-latest"` |
| `jev_called_at_utc` | ISO-8601, nullable | when the proxy was invoked |

---

## Jev proxy contract (documented here so the schema and proxy stay aligned; proxy itself is Step 4)

Read live at `https://docs.typesafe.ai` (never guessed) — the brief's hard rule:

- **Endpoint:** `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer $JEV_API_KEY`.
- **Question type:** `choice` over `up` / `down` / `abstain`, matching PRE's decision axis:
  ```json
  {
    "state": "<feature-row payload from shadow-log>",
    "model": "jev-latest",
    "questions": {
      "direction": {
        "type": "choice",
        "instructions": "Decide whether BTC will go up, down, or abstain over the next 15 minutes.",
        "criteria": {
          "up":   "Price ends higher than it started",
          "down": "Price ends lower than it started",
          "abstain": "Not enough signal to justify either call"
        }
      }
    }
  }
  ```
- **Response:** `answers.direction.choice` ("up"|"down"|"abstain"), `answers.direction.probabilities` (distribution), `answers.direction.confidence` (0–1). Store all three — `confidence` is derived from the distribution's shape and is what Step 5's Brier/log-loss scoring uses.
- **Stub mode:** when `JEV_API_KEY` is unset, return `{stubbed: true, direction: "abstain", confidence: 0}` so development works without waitlist access.

---

## 10-row synthetic smoke test (Step 3 deliverable)

Step 3 will include a generator that writes 10 rows: mixed slots (day + night), mixed weekdays, mixed PRE calls (Over/Under/abstain), mixed outcomes (up/down), a couple of rows with Jev fields filled to confirm the columns write cleanly. The exact sample values are not specified here — the test proves the schema parses and appends, not that the data is real.

---

## Assumptions / unverified (additions to the running list)

11. **Fee assumption for the realized-edge step (Step 5) is unresolved.** Coinbase prediction-market contract fees vary by contract price band; PRE currently assumes even odds in its EV preview. `fee_model` is a column, not a constant — Step 5 must pick a documented assumption (or ask Andrew) rather than guess one and bake it in.
12. **`contract_price_cents` at decision time is not currently ingested by PRE.** Populating it for the shadow test requires either a Kalshi/Coinbase API call at decision time or a manual capture. The schema exposes the column now so the schema doesn't have to change retroactively when the source is added.
13. **Jev's `confidence` is TypeSafe's own statistic derived from `probabilities`.** The shadow test records it verbatim; it is not PRE's historical hit rate.
14. **Rows are appended, never rewritten**, except the `outcome_*` and `jev_*` nullable columns, which get filled in a later pass on the same row. This is the standard "log prediction, then resolve" pattern and must be enforced by the logger, not the schema.

---

## Approval gate

**This is the STOP point.** No Step 3 (logging layer), no Step 4 (proxy), no Step 5 (scoring), no Step 6 (handback README) until you approve this schema.

Things worth your eyes specifically:
- The **Jev decision axis** (`up` / `down` / `abstain`) — does `abstain` as a first-class Jev option match how you want to compare it to PRE's WAIT?
- Whether **`pre_confidence`** should be PRE's raw `eff_p` (as proposed — honest about what PRE is) or something derived (e.g. distance from 50%).
- Whether **Kalshi vs Coinbase spot** should be the authoritative outcome source, or whether the shadow test should log both (`outcome_source` allows either).
- Whether **`fee_model`** should stay a free-text column or be a fixed enum.
