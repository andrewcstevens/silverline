# Silverline Creative Constitution (ECD-01)

**Status:** Study-stage document · Review-ready · Not integrated  
**Owner:** Executive Creative Director  
**Branch:** `feature/silverline-creative-system` (from `feature/ecd-copy-operations` @ `e3952969`)  
**Scope:** Governs art direction, visual hierarchy, mobile UX, interaction grammar, motion, and creative QA for all Silverline surfaces.  
**Product truth:** Silverline is a historical-edge and pricing-context tool for manual decisions on 15-minute binary-market contracts. Not financial advice. Not an auto-trader. Not spot-BTC prediction.

---

## 1. Governing principle

> **Silverline may name the experience. It may not rename the truth.**

Design may elevate the experience. It may never make an uncertain, historical, proxy, stale, or fixture-backed fact feel more certain, live, verified, or actionable than it is. Every visual decision is tested against this sentence first.

## 2. What the product must feel like

A **calibrated field instrument** — the kind of composed, technically precise tool an experienced operator uses to inspect uncertain conditions. Not a casino. Not a generic crypto terminal. Not a hype-driven AI oracle. Not a certainty engine.

The emotional target is **nocturnal composure**: the feeling of a quiet observatory at 3 a.m. — alert, restrained, and unhurried. The operator should feel equipped, not stimulated.

## 3. Creative pillars

### 3.1 Composure over urgency
No countdown pressure, no streak language, no celebration of hypothetical gains, no loss-shaming. Motion clarifies state; it never dramatizes prediction certainty. A Golden Window is presented for inspection, never as a "last chance."

### 3.2 Provenance over prediction
Every number is accompanied by its source, timestamp, freshness, and limitation. The instrument always shows *where the number came from and how stale it is* before it shows the number itself. Provenance is a first-class visual element, not a footer.

### 3.3 Mobile legibility beats desktop spectacle
Designed 360–430 px first. A one-handed operator on a phone in poor light is the canonical user. Desktop is a generous second. If a composition fails on mobile, it fails.

### 3.4 Restraint is the brand
One accent. Two typefaces. Decorative elements must encode meaning. The eye should land on one or two small moments of color per screen; everything else is neutral. If everything is colored, nothing stands out.

### 3.5 Manual agency is sacred
No visual language implies execution, automatic betting, or "one-click" action. Approved actions are *Inspect, Review, Compare, Wait*. The operator always decides manually.

## 4. Color philosophy

**Earn every color.** Color is emphasis, not decoration. The canonical surface is a calm, mostly-neutral field with one accent and 0–2 semantic colors.

- **Accent (single):** a cooled, slightly desaturated cyan-teal — instrument light, not crypto-green. Used for focus, active state, and primary affordance only.
- **Semantic — direction:** Up/Over and Down/Under use a muted green and a muted rust. **Never red/green alone** — always paired with a text label, glyph, or position. Blue/orange is the safer underlying axis.
- **State colors:** amber for caution/stale, neutral gray for unavailable. Reserved for data-health states, not decoration.
- **No casino palette.** No gold-on-black "winner" treatment. Golden Window may use a restrained warm tint, never a celebratory glow.

Light and dark must both be built. The product is primarily dark (nocturnal), but light mode is a real first-class surface, not an inversion.

## 5. Typography

Two typefaces, two to three weights.

- **Display (instrument):** a refined serif or a precise grotesk with optical sizing. Reserved for the single most important number on a screen and for the product wordmark. Never used for body or chrome.
- **Body / data:** a neutral humanist sans or a workhorse monospace for tabular figures. Numbers use `font-variant-numeric: tabular-nums lining-nums`.
- **Floor:** 12 px absolute minimum; 16 px body. No display face below 24 px.

Type carries hierarchy. Size steps mark content-role changes; the same role is the same size everywhere.

## 6. Motion grammar (factual motion)

Motion is allowed only when it serves comprehension. It must never imply that an outcome is becoming more likely.

- Numbers may settle into place; they may not "count up" toward a target in a way that feels like a rising probability.
- State transitions may animate a change; they may not dramatize prediction certainty. (`WATCH → PRICE BLOCKED` is a plain recoloration, not a flashing alert.)
- A historical **Trace** may draw itself as recorded replay; it must not imply a forecast path.
- Motion pauses or materially throttles on hidden tabs.
- `prefers-reduced-motion` preserves all utility. Continuous drift, parallax, and ambient pulsing are removed or replaced with static equivalents under reduced motion.
- Critical information is always available as accessible HTML, not locked inside motion or canvas.

## 7. Information hierarchy (mobile)

Canonical mobile stack, top to bottom:

1. **Field State** — the single high-level state (`QUIET FIELD` / `READING` / `WATCH` / `GOLDEN WINDOW` / `PRICE BLOCKED` / `FIELD INTERRUPTED` / `RESOLVED`). One state, one screen, immediately legible.
2. **Window** — the 15-minute interval under review, with time remaining.
3. **Evidence** — observed historical rate, Evidence Range (95% CI), Observation Count (`n`), model-through period.
4. **Quote Surface** — source, quote/reference label, price, timestamp, freshness.
5. **Price-Adjusted Edge** — EV context at the displayed price, with all required accompaniment.
6. **Signal Integrity** — data availability, validation, source clarity, freshness.
7. **Compliance context** — dignified, adjacent to the claim it qualifies.

Three-second comprehension check: state, timer, reason, data status must be readable in three seconds on a mobile screen.

## 8. Data-state labeling (non-negotiable)

Every data-backed surface must explicitly label its state. A state may not render when its technical preconditions are false.

- **FIXTURE** — synthetic sample data for study/prototype only.
- **REPLAY** — recorded historical movement being replayed.
- **HISTORICAL** — observed past data, model-through date shown.
- **DELAYED / STALE / UNAVAILABLE** — reference health states.
- **LIVE** — only when the underlying source and rendering are technically live/current and freshness is visible, CTO-verified.

Fixture, replay, historical, delayed, or stale data must never be presented as live. Coinbase BTC-USD spot candles are a **Reference Feed** (proxy), never prediction-market settlement data.

## 9. Accessibility standard

- **Contrast:** WCAG AA — 4.5:1 body, 3:1 large text and graphical objects.
- **Color independence:** never color alone. Direction, state, and health always carry a text label or glyph.
- **Focus:** visible, keyboard-reachable, logical order. No keyboard traps.
- **Reduced motion:** full utility preserved; no continuous drift or parallax.
- **Readable hierarchy:** semantic HTML; canvas/animation is secondary to accessible text.
- **Touch:** minimum 44 × 44 px hit targets; comfortable one-handed reach.

## 10. Prohibited visual patterns

- Countdown timers that create urgency around a contract.
- Confetti, streaks, celebration, or "winner" visual language.
- "AI confidence" gauges that read as a probability of outcome.
- Red/green-only direction encoding.
- Animating a number toward a target to imply rising likelihood.
- Presenting fixture/replay/historical/proxy/stale data as live.
- Any visual implying Silverline can execute, place, or auto-resolve a bet.
- Casino framing, gold-on-black winner treatment, hype-driven motion.

## 11. Creative QA gate (release)

Before any study advances toward integration, the ECD confirms:

1. Coherent system — palette, type, spacing, motion are consistent across states.
2. Three-second comprehension — state, timer, reason, data status legible on mobile.
3. State labeling — every data-backed surface labels live/historical/replay/fixture/delayed/stale/unavailable.
4. Source + freshness visible wherever a price/quote could affect a manual decision.
5. Reduced-motion and accessibility checks pass (contrast, focus, color-independence).
6. Empty, error, and stale-data states exist and are dignified.
7. Compliance language is adjacent to the claim it qualifies, not exiled to a footer.
8. No prohibited visual pattern present.

A study never becomes production automatically. Advancing to Prototype, Integration proposal, or Release requires the stage-model gates and Founder approval.

## 12. Dependencies and stop conditions

- **CTO dependency:** a verified data/state contract is required before any data-backed UI is represented as anything beyond fixture. Without it, studies use fixture-only data clearly labeled as such.
- **Copy Editor dependency:** proprietary terms must have a plain-language companion on first use and match the approved nomenclature registry.
- **Stop condition:** this work stops at Study stage. No integration into the live application, no merge to `master`, no production deploy, no changes to PRE/proxy/ledger/validation/cron/Vercel/credentials.

## 13. Relationship to the copy & nomenclature system

This Constitution directs the experience system; the Copy Editor governs the word-level voice and terminology under ECD review. The two are bound: no proprietary term appears in a study without its registry entry, plain companion, and correct data-state label. Direction of the voice — composed, precise, brief, honest — is fixed here; the Copy Editor realizes it word by word.

---

*Design may elevate the experience. It may never make an uncertain fact feel certain.*
