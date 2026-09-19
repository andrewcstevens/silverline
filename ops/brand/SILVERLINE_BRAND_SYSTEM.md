# SILVERLINE — Brand & Product Language System
**Snapshot:** 2026-09-18  
**Status:** Canonical working record of the completed naming / architecture sprint. Unresolved language is explicitly quarantined in `HAMMER_OUT.md`.

## 1. Locked product architecture
### PROSPECT → PROOF → P/L
- **PROSPECT** — what Silverline sees; opportunity now and next.
  - **PRESENT** — opportunity Silverline is reading now.
  - **PRIME** — strongest forthcoming opportunity Silverline has identified.
- **PROOF** — historical validation; whether Silverline predictions deserve confidence.
- **P/L** — Andrew’s actual financial outcomes: positions, realized/unrealized P/L, return, deployed capital, reserve/available capital, fees as appropriate.

Conceptual progression: **Opportunity → Evidence → Outcome.**

### Present / Prime invariant
Present and Prime use the **same readout architecture and component**. They differ only by temporal status.

Every Prospect prominently carries:
- exact **START → END**
- global **PT / ET** toggle
- Prediction
- Direction
- Edge
- Purity
- Mintage / evidence depth (working terminology; see Hammer Out)
- Kalshi implied probability
- countdown

For **Present**, countdown = time until END.  
For **Prime**, countdown = time until START.

Time is a primary visual element, nearly as prominent as probability. Store timestamps in UTC and render PT/ET with daylight-saving-aware zones, never hard-code PST/EST.

## 2. Locked evidentiary architecture: REEDED EDGE
**Reeded Edge is not a step in the flow. It is the system-wide evidentiary / information architecture surrounding Silverline intelligence.**

Governing principle: no consequential Silverline assertion should be presented without the ability to expose its evidence, context and provenance.

Reeded Edge can manifest through:
- hover / tap explanations
- provenance and source timestamps
- frozen predictions
- historical comparisons
- calibration views
- model/version records
- market snapshots
- drill-down evidence

### Reality · Relevance · Receipt
These are the three evidentiary dimensions carried through Reeded Edge.
- **REALITY** — what is actually observed / materially true, current and sourced.
- **RELEVANCE** — why those facts matter to this specific prediction or decision.
- **RECEIPT** — timestamped evidence, calculation, model state, market snapshot, settlement or transaction substantiating the claim.

`R³` is acceptable shorthand. Do **not** force a descriptor such as “Protocol” or “Assay” until naming is resolved.

## 3. Reading explanation behavior
Every primary reading should be self-explaining.
- Desktop: hover + keyboard focus.
- Mobile: tap.
- Compact editorial popover, not a generic oversized SaaS tooltip.
- Explain the **actual live reading**, not only a canned glossary definition.

Working reading object:
```ts
{
  label,
  value,
  unit,
  definition,
  interpretation,
  calculation,
  source,
  freshness
}
```

Attach this behavior to Prediction, Edge, Purity, Mintage/evidence depth, Kalshi implied probability, countdown and P/L metrics.

UX progression: **glance → understand reading → audit evidence**.

## 4. Core metric language
### PREDICTION
Model probability for the specific contract.

### EDGE
Silverline model probability minus market-implied probability, expressed in percentage points.

### PURITY
Strong working proprietary term for Silverline-specific signal / opportunity quality. Proposed scale: **0–1000**. Formula is **not yet canonical and must not be fabricated**.

Potential inputs include edge magnitude, evidence reliability, calibration, historical consistency, freshness, liquidity and execution quality. Avoid double-counting.

Purity visual grammar can become progressively reflective: **diffuse → satin → polished → brilliant → mirror**. These are visual states, not a second “Luster” metric. Keep the system materially silver / monochrome rather than traffic-light colored.

## 5. Strong working language, not yet locked
### CAST
Promising name for a single Silverline prediction issued / committed forward in time. The double meaning is valuable: cast forward / forecast and cast material.

Potential UI vocabulary: Current Cast, Cast At, Cast Window, Settled Cast, Cast History.

### MINTAGE
Strong term whose exact ontology remains unresolved. Current direction: the accumulated body / population of settled and validated Casts. A readout such as `MINTAGE 436` may mean the number of relevant comparable settled Casts supporting a Prospect, but this needs explicit definition before implementation.

## 6. Voice / material world
Silverline’s native metaphor is **metals / minting / numismatic / metallurgy**, used with restraint and only where it clarifies a real software or evidence concept.

Preferred conceptual language includes value **forming**, material permanence, provenance and evidentiary edges. Avoid mixing this with meteorological branding or generic software-branded nouns simply to sound technical.

Do not turn the interface into themed-restaurant copy. Proprietary vocabulary is earned only where Silverline has actually invented a concept.

## 7. Visual direction
- cinematic editorial financial instrument, not a crypto dashboard
- asymmetrical but balanced
- machined / metallic restraint
- black, silver, mineral and controlled warm-metal notes
- large numerals + tiny precise labels
- sculptural topography / material field can carry evidence visually
- references: Paper / Wallpaper / Monocle editorial intelligence rather than generic fintech SaaS
- information must remain legible and epistemically honest beneath the atmosphere

See `/references/` for the two V3 concept directions and the current functioning UI baseline.

## 8. Data / scientific integrity
Do not ship dramatic probabilities merely because they look good. Preserve the epistemic honesty of the underlying evidence.

Coinbase BTC-USD spot behavior is proxy evidence, not proof of edge on actual Kalshi contracts. Credible Proof should use frozen, reproducible out-of-sample evaluation against actual KXBTC15M outcomes and incorporate contract price / implied probability, payout, fees, spread/slippage where applicable, calibration, sample size and look-ahead leakage protection.

## 9. Superseded / rejected terminology
Do not resurrect as canonical without Founder approval:
- Treasury → use **P/L**
- Census
- Grade / A1-A2 grade nomenclature
- Luster as a separate metric
- Strike as prediction object or accuracy metric
- Reeding as “methodology”
- Assay
- R³ Protocol
- R³ Assay

Historical branches may contain these terms. They are not current authority.
