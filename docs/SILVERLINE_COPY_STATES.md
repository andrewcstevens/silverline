# Silverline State Copy System

## Usage

This document provides the approved state-copy pattern. Rendering must remain consistent with the data/state contract. No state may be shown when its technical preconditions are false or unavailable.

## Quiet Field

- **Display label:** `QUIET FIELD`
- **Plain explanation:** `No qualifying price-adjusted historical alignment is currently available.`
- **Action:** `View methodology`
- **Qualification:** `A quiet Field does not predict that price will remain still.`
- **Freshness treatment:** show relevant model-through date and reference status.
- **Prohibited implication:** no opportunity exists anywhere; price cannot move; risk is low.

## Reading

- **Display label:** `READING`
- **Plain explanation:** `Silverline is presenting available historical evidence, price context, and data integrity.`
- **Action:** `Inspect inputs`
- **Qualification:** `A Reading is an assessment, not a forecast.`
- **Freshness treatment:** identify each input as live, historical, replay, fixture, delayed, stale, or unavailable.
- **Prohibited implication:** real-time market inference unless technically verified.

## Watch

- **Display label:** `WATCH`
- **Plain explanation:** `Some conditions align. Evidence and price still require manual review.`
- **Action:** `Inspect entry`
- **Qualification:** `Historical alignment can change with price, freshness, and market regime.`
- **Freshness treatment:** display source/timestamp for price-dependent input.
- **Prohibited implication:** urgency, recommendation, or suggested execution.

## Golden Window

- **Display label:** `GOLDEN WINDOW`
- **Plain explanation:** `Best currently observed alignment under PRE rules.`
- **Action:** `Review price and evidence`
- **Qualification:** `Historical and price-dependent. Not a guarantee or financial advice.`
- **Freshness treatment:** must display historical/model source limits plus source/timestamp of price reference where used.
- **Prohibited implication:** strong buy, winning trade, high-certainty result, or automatic action.

## Price Blocked

- **Display label:** `PRICE BLOCKED`
- **Plain explanation:** `Historical direction may be present, but the displayed price removes the expected-value context.`
- **Action:** `Compare price`
- **Qualification:** `Reference price and historical rate can change; review source and freshness.`
- **Freshness treatment:** source, quote/reference designation, and timestamp are required.
- **Prohibited implication:** price will improve, wait-to-buy instruction, or a forecast of quote movement.

## Field Interrupted

- **Display label:** `FIELD INTERRUPTED`
- **Plain explanation:** `A required reference is delayed, stale, unavailable, or failed validation.`
- **Action:** `Check source`
- **Qualification:** `Do not treat this as a current read.`
- **Freshness treatment:** show exact source status and most recent timestamp if available.
- **Prohibited implication:** no risk; an opportunity is unavailable only temporarily; a previous reading remains current.

## Resolved

- **Display label:** `RESOLVED`
- **Plain explanation:** `Recorded historical outcome.`
- **Action:** `Review replay`
- **Qualification:** `Historical/replay outcome only unless live settlement is technically verified.`
- **Freshness treatment:** show outcome source and record time.
- **Prohibited implication:** live settlement or automatic ledger/bet resolution without verified data.

## State transition rule

When a state changes, communicate what changed in plain language. Example:

```text
WATCH → PRICE BLOCKED
Historical evidence remains visible. The updated reference price no longer meets the displayed price-adjusted criteria.
```

Never animate state transitions in a way that suggests an outcome is becoming more likely. Motion may clarify a state change; it may not dramatize prediction certainty.
