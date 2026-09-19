# SILVERLINE — UX Language & Interface Contract
**Snapshot:** 2026-09-18

## Top-level navigation
**PROSPECT · PROOF · P/L**

## Prospect
Tabs / states: **PRESENT · PRIME**

Use one stable Prospect instrument architecture for both states.

Required first-class fields:
```ts
{
  status: 'present' | 'prime',
  startAtUtc,
  endAtUtc,
  displayTimeZone: 'PT' | 'ET',
  market,
  contract,
  predictionProbability,
  direction,
  marketImpliedProbability,
  edgePercentagePoints,
  purity,
  evidenceDepth,
  countdownTarget,
  freshness,
  source
}
```

### Time behavior
- Show **START → END** prominently.
- Global **PT / ET** control changes all timestamps.
- Present counts down to END.
- Prime counts down to START.

### Illustrative hierarchy only
```text
PRESENT
9:45 PM → 10:00 PM       PT | ET
START        END

BTC · 15 MIN
57.2% OVER                PREDICTION
+8.1 pp                   EDGE
884                       PURITY
Kalshi 49.1%
MINTAGE 436               [working terminology]
```
Numbers above are placeholders, not performance claims.

## Proof
Purpose: answer **“Has Silverline demonstrated that its predictions deserve confidence?”**

Candidate content:
- historical performance measure (final label unresolved)
- calibration
- evidence quality / qualitative state
- Purity in historical analysis where meaningful
- relevant / comparable settled Cast population
- immutable history of predictions matched to actual settlement

Proof is the **container**, not another metric called “Proof.”

## P/L
Purpose: actual user financial outcomes.

Candidate content:
- positions
- realized P/L
- unrealized P/L
- return
- deployed capital
- reserve / available capital
- fees
- later: balances, deposits, withdrawals and allocation where useful

Keep personal Coinbase / Kalshi accounting separate from the public prediction engine and public repo data.

## Reeded Edge UX
Every consequential reading exposes:
- **Reality** — actual observed inputs
- **Relevance** — why they matter here
- **Receipt** — provenance / frozen evidence

Desktop = hover/focus. Mobile = tap.

### Example: Edge
**Reality:** Silverline 57.2%; Kalshi 49.1%.  
**Relevance:** Silverline assigns 8.1 percentage points more probability than the market.  
**Receipt:** market snapshot + model version + timestamp + frozen prediction.

### Example: P/L
**Reality:** realized amount.  
**Relevance:** entry, settlement and net fees.  
**Receipt:** position record + transaction + settlement + corresponding frozen prediction.

## Visual implementation
The new shell may be developed against mocked data while the truth engine is consolidated, but mock values must be unmistakably non-production. Connect the shell to one stable data object rather than duplicating Present / Prime logic.
