# Silverline Nomenclature Registry

## Purpose

This registry governs user-facing proprietary terminology. Every term is designed to create a coherent Silverline instrument language while retaining clear, plain financial and data truth.

**Rule:** Silverline may name the experience. It may not rename the truth.

## Status definitions

- **Approved:** allowed in study/prototype copy under its stated constraints; permanent production use still requires the applicable release gate.
- **Candidate:** under consideration; do not use as a product-wide default.
- **Prohibited:** do not use in any Silverline surface.

## Core terms

### The Field

- **Status:** Approved
- **Part of speech:** noun
- **Definition:** Silverline's combined decision environment: historical evidence, price context, timing, and data integrity.
- **Plain-language companion:** Current decision environment.
- **First use:** `THE FIELD — Current decision environment: evidence, price context, time, and data health.`
- **Approved use:** product orientation, methodology, high-level status framing.
- **Do not use for:** a literal live market, order book, hidden market force, or guaranteed prediction.
- **Approved examples:** `The Field is quiet.` / `Inspect the Field.` / `Field view uses historical and reference inputs.`
- **Disallowed examples:** `The Field knows where BTC will close.` / `The Field sees hidden liquidity.` / `Follow the Field.`

### Field State

- **Status:** Approved
- **Definition:** Silverline's high-level current state.
- **Plain-language companion:** Current Silverline state.
- **First use:** `FIELD STATE — Current Silverline state.`
- **Approved use:** header, status rail, accessibility labels.
- **Do not use for:** a probabilistic output framed as an instruction.
- **Approved examples:** `Field State: Watch.` / `Field State: Quiet Field.` / `Field State is unavailable while references are delayed.`
- **Disallowed examples:** `Field State says buy.` / `Trust the Field State.` / `Field State guarantees alignment.`

### Quiet Field

- **Status:** Approved
- **Definition:** No qualifying price-adjusted historical alignment is presently available.
- **Plain-language companion:** No action is indicated by current PRE criteria.
- **First use:** `QUIET FIELD — No qualifying price-adjusted historical alignment is currently available.`
- **Approved use:** No Action state.
- **Do not use for:** a claim that price will not move.
- **Approved examples:** `The Field is quiet.` / `No action under current PRE criteria.` / `Review the methodology while the Field is quiet.`
- **Disallowed examples:** `Nothing will happen.` / `Safe to ignore the market.` / `No risk.`

### Reading

- **Status:** Approved
- **Definition:** Silverline is presenting an assessment of available evidence, price context, and data integrity.
- **Plain-language companion:** Evidence and reference conditions are being assessed.
- **First use:** `READING — Silverline is assessing available evidence, price context, and data integrity.`
- **Approved use:** neutral active state.
- **Do not use for:** an assertion that data is being processed live unless verified.
- **Approved examples:** `Reading available conditions.` / `Inspect this Reading.` / `Reading uses historical evidence and reference context.`
- **Disallowed examples:** `Real-time AI reading.` / `Reading the market's intent.` / `Reading confirms the outcome.`

### Watch

- **Status:** Approved
- **Definition:** Some conditions meet preliminary criteria, but evidence and/or price context still require inspection.
- **Plain-language companion:** Some conditions align; manual review is still required.
- **First use:** `WATCH — Some conditions align; evidence and price still require manual review.`
- **Approved use:** intermediate opportunity state.
- **Do not use for:** urgency, a recommendation, or an implied trade.
- **Approved examples:** `Watch the window.` / `Conditions merit inspection.` / `Price remains part of the decision.`
- **Disallowed examples:** `Get ready to enter.` / `Trade alert.` / `Do not miss this.`

### Golden Window

- **Status:** Approved
- **Definition:** The strongest currently observed decision environment that qualifies under configured PRE historical-evidence and price-context rules.
- **Plain-language companion:** Best currently observed alignment under PRE rules; historical and price-dependent, not a guarantee.
- **First use:** `GOLDEN WINDOW — Best currently observed alignment under PRE rules. Historical and price-dependent; not a guarantee.`
- **Approved use:** qualifying high-salience state, methodology, replay annotation.
- **Do not use for:** a guaranteed win, strong buy, urgent instruction, or outcome certainty.
- **Approved examples:** `Golden Window is available for inspection.` / `Review price before acting manually.` / `This designation can change with price or data freshness.`
- **Disallowed examples:** `Take the Golden Window.` / `Highest-probability winner.` / `Golden Window guarantees an edge.`

### PRE Posture

- **Status:** Approved
- **Definition:** The relationship between current verified inputs and PRE's configured qualifying criteria.
- **Plain-language companion:** How current inputs compare with PRE rules.
- **First use:** `PRE POSTURE — How verified inputs compare with configured PRE rules.`
- **Approved use:** advanced inspection panels.
- **Do not use for:** exposing model internals not approved for display or implying a forecast.
- **Approved examples:** `PRE Posture: Watch.` / `PRE Posture is unavailable without a current reference.` / `Inspect qualifying conditions.`
- **Disallowed examples:** `PRE predicts Up.` / `PRE has conviction.` / `PRE certainty: high.`

### Signal Integrity

- **Status:** Approved
- **Definition:** The availability, validation, source clarity, and freshness of inputs used for a displayed read.
- **Plain-language companion:** Data availability, validation, source clarity, and freshness.
- **First use:** `SIGNAL INTEGRITY — Data availability, validation, source clarity, and freshness.`
- **Approved use:** health/status indicator.
- **Do not use for:** a measure of predicted outcome quality.
- **Approved examples:** `Signal Integrity: Current.` / `Signal Integrity: Reference delayed.` / `Inspect source details.`
- **Disallowed examples:** `Signal Integrity confirms the signal.` / `High integrity means likely win.` / `Integrity score.`

### Signal Grain

- **Status:** Candidate
- **Definition:** A compact descriptor for the consistency and amount of historical support behind a read.
- **Plain-language companion:** Historical evidence strength and uncertainty.
- **First use:** `SIGNAL GRAIN — Historical evidence strength and uncertainty.`
- **Required accompaniment:** observed rate, 95% confidence interval, observation count, and model-through period.
- **Founder decision:** keep as a poetic evidence label or use the plainer `Evidence State`.

### Alignment

- **Status:** Approved
- **Definition:** A documented condition in which historical evidence and price context jointly meet relevant PRE criteria.
- **Plain-language companion:** Historical evidence and price conditions meet configured PRE criteria.
- **First use:** `ALIGNMENT — Historical evidence and price conditions meet configured PRE criteria.`
- **Do not use for:** certainty, market consensus, or an order/execution instruction.
- **Approved examples:** `Alignment is present.` / `Alignment does not replace price review.` / `Historical alignment can be regime-dependent.`
- **Disallowed examples:** `Perfect alignment.` / `Market alignment guarantees a result.` / `Align and enter.`

### Window

- **Status:** Approved
- **Definition:** A specific 15-minute contract interval being viewed or assessed.
- **Plain-language companion:** 15-minute contract interval.
- **First use:** `WINDOW — The 15-minute contract interval under review.`
- **Approved examples:** `Current Window.` / `Time remaining in this Window.` / `Review the next Window.`
- **Disallowed examples:** `Profit window.` / `Winning window.` / `Entry window` when entry is not supported.

### Settlement Plane

- **Status:** Approved
- **Definition:** The time boundary at the end of a 15-minute interval; chiefly a Reeding Field/replay visual metaphor.
- **Plain-language companion:** Interval end time.
- **First use:** `SETTLEMENT PLANE — The end boundary of this 15-minute interval.`
- **Do not use for:** a future settlement prediction or unverified market resolution.
- **Approved examples:** `The trace approaches the Settlement Plane.` / `Interval end: 10:15 ET.` / `Historical replay only.`
- **Disallowed examples:** `The Settlement Plane confirms Over.` / `Predict the plane.` / `Crossing the plane wins.`

### Resolve

- **Status:** Approved
- **Definition:** A recorded, verified historical or replay outcome becoming known.
- **Plain-language companion:** Recorded historical outcome.
- **First use:** `RESOLVED — Recorded historical outcome.`
- **Approved use:** replay and verified ledger context.
- **Do not use for:** a current/live resolution unless technically verified.
- **Approved examples:** `Historical interval resolved Up.` / `Resolve appears only in replay.` / `Outcome record available.`
- **Disallowed examples:** `Resolved live` without verified live settlement. / `Resolve the bet.` / `Automatic resolve.`

### Trace

- **Status:** Approved
- **Definition:** A visualized historical/replay price path or data movement.
- **Plain-language companion:** Displayed price path or historical movement.
- **First use:** `TRACE — Visualized historical or replay price movement.`
- **Do not use for:** a forecast path or fabricated market movement.
- **Approved examples:** `Trace uses replay data.` / `Central trace represents recorded BTC-USD movement.` / `Trace is decorative only when explicitly labeled.`
- **Disallowed examples:** `Future trace.` / `The trace predicts settlement.` / `Follow the trace.`

### Reeding

- **Status:** Approved
- **Definition:** Silverline's product metaphor for sensing structured historical conditions at the edge of a decision window.
- **Plain-language companion:** Reviewing historical evidence and price context near an interval boundary.
- **First use:** `REEDING — Reviewing historical evidence and price context near an interval boundary.`
- **Do not use for:** privileged market access, hidden order flow, or exclusive alpha.
- **Approved examples:** `Reeding is a review process, not a prediction.` / `Inspect the Reeding methodology.` / `The product reads historical structure.`
- **Disallowed examples:** `Reeding sees the market before it moves.` / `Private reeding advantage.` / `Guaranteed reeding edge.`

### Quote Surface

- **Status:** Approved
- **Definition:** The product container for a contract's clearly identified source quote and price context.
- **Plain-language companion:** Contract quote source, price, and freshness.
- **First use:** `QUOTE SURFACE — Kalshi reference quote, price, and freshness.`
- **Required visible data:** source, quote/reference label, timestamp or freshness, and data state.
- **Do not use for:** an execution interface or a source-agnostic quote.
- **Approved examples:** `Quote Surface: Kalshi reference quote.` / `Updated 11 seconds ago.` / `Reference only. Manual decision required.`
- **Disallowed examples:** `Truth price.` / `Execution price` without execution support. / `Live quote` without technical verification.

### Price-Adjusted Edge

- **Status:** Approved
- **Definition:** The expected-value context after comparing observed historical probability to the displayed contract price.
- **Plain-language companion:** Expected-value context at the displayed price.
- **First use:** `PRICE-ADJUSTED EDGE — Expected-value context at the displayed price.`
- **Required accompaniment:** observed historical rate, contract price/reference, break-even price, source/time state, and uncertainty context.
- **Do not use for:** profit promises or unqualified claims of positive EV.

### Evidence Range

- **Status:** Approved
- **Definition:** The displayed statistical uncertainty around an observed historical rate.
- **Plain-language companion:** 95% confidence interval.
- **First use:** `EVIDENCE RANGE — 95% confidence interval around the observed historical rate.`
- **Required accompaniment:** actual interval and observation count.
- **Do not use for:** a future-outcome probability interval.

### Observation Count

- **Status:** Approved
- **Definition:** Number of relevant historical intervals in the displayed calculation.
- **Plain-language companion:** `n` historical intervals.
- **First use:** `OBSERVATION COUNT — Number of historical intervals in this read.`

### Reference Feed

- **Status:** Approved
- **Definition:** A named external source used as context, distinct from an execution or settlement feed.
- **Plain-language companion:** Named source used for reference only.
- **First use:** `REFERENCE FEED — Named source used for context; not an execution feed.`
- **Do not use for:** a verified settlement or trade-fill feed unless it is one.

### Data Freshness

- **Status:** Approved
- **Definition:** Age and current availability of a displayed data source.
- **Plain-language companion:** Updated time / delayed / stale / unavailable.
- **First use:** `DATA FRESHNESS — Age and availability of this source.`
- **Required display:** timestamp or elapsed age; stale/unavailable fallback where applicable.

## Market-truth terms that must remain plain

The following may sit inside branded containers but must remain visibly identifiable: Kalshi reference quote, bid, ask, spread, contract price, observed historical rate, 95% confidence interval, `n`, expected value, break-even price, source, timestamp, live/historical/replay/fixture status, stale, delayed, unavailable, and manual decision required.

## Prohibited naming directions

Do not use proprietary terms that make evidence sound more authoritative than it is, including `Oracle`, `Truth Price`, `Pulse`, `Market Intent`, `Flow`, `Alpha Generator`, `Prediction Engine`, `Execution Window`, or `Winner`.
