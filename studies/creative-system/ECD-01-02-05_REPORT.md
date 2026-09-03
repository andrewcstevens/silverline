# ECD-01 / ECD-02 / ECD-05 — Creative System Report

**Workstream:** ECD-01 Creative Constitution · ECD-02 Art-Direction Studies · ECD-05 Voice/Nomenclature Application  
**Status:** Study complete · Review-ready · Not integrated  
**Owner:** Executive Creative Director  
**Branch:** `feature/silverline-creative-system`  
**Commit:** `aa20723db4f4116bb51f6232aac761ec2d2a6542`  
**Base branch / SHA:** `feature/ecd-copy-operations` @ `e395296971fbd7b98d751f092ff0b0653240adc2`

## Files added
- `docs/SILVERLINE_CREATIVE_CONSTITUTION.md` — ECD-01 governing art-direction document
- `studies/creative-system/index.html` — study landing/index
- `studies/creative-system/observatory/index.html` — Study 1
- `studies/creative-system/mint/index.html` — Study 2
- `studies/creative-system/signal-room/index.html` — Study 3

## Files modified
None existing. All work is net-new in `docs/` and `studies/`.

## Existing production files modified: no
## Production behavior changed: no

## Studies completed
1. **The Observatory** — astronomical, deep-field dark, instrument grammar. Calibrated cyan-teal accent, refined serif display over monospace data, starfield + slow instrument sweep on the Field State marker. Composure through restraint.
2. **The Mint** — cold patinated metal, provenance over prediction. Oxidized brass-green accent, struck-plate metaphor, engraved arc gauge for Price-Adjusted Edge, provenance strip (Struck / Hallmark / Dated). Tactile, numismatic.
3. **The Signal Room** — structured grid, tabular, high density. Instrument cyan, terminal/operational telemetry strip, modular panels, sparkline Trace. Dense and scannable.

## Recommended route: The Observatory
The Observatory best satisfies the product thesis: a calm, nocturnal, technically precise field instrument. It leads with provenance and composure rather than density or spectacle, which matches the governing rule that design must never make an uncertain fact feel certain. Its restraint leaves room for the data and compliance language to carry authority — the single most important quality for a real-money-decision tool. The Mint is the strongest runner-up (provenance strip is an excellent truth-device) and is recommended as a secondary influence on The Observatory's provenance treatment. The Signal Room is powerful for an advanced/operator view but risks reading as a "trading terminal," which the Constitution cautions against as a default identity.

## Core visual principles (from the Constitution)
- Composure over urgency; provenance over prediction; mobile legibility beats desktop spectacle; restraint is the brand; manual agency is sacred.
- One accent + 0–2 semantic colors; color is emphasis, never decoration. Direction never color alone (text label + glyph + position).
- Two typefaces, 2–3 weights. Display reserved for the single most important number + wordmark. 12 px floor, 16 px body.
- Factual motion only; never dramatize prediction certainty; pauses on hidden tabs; full utility under `prefers-reduced-motion`.

## Copy/nomenclature applied (ECD-05)
All three studies use only approved registry terms with plain-language companions and correct data-state labels: **Field State, Watch, Window, Evidence Range (95% CI), Observation Count, Quote Surface, Reference Feed, Data Freshness, Signal Integrity, Price-Adjusted Edge, Trace, Reference only · Manual decision required.** Direction language is "Historical evidence favors Up" (never "signal says Up"). Compliance text is dignified and adjacent to the claim, not exiled to a footer. No prohibited language used (no guarantee, winner, strong buy, urgent, execute, etc.). "Live" is not claimed anywhere — the reference is explicitly "delayed."

## Fixture/replay/live data status
Fixture/Replay/Historical only. No live data. Every study carries a "Fixture · Replay · Historical · Not live" banner. The Quote Surface states "Reference Feed delayed · updated 11 sec ago." The Coinbase BTC-USD spot proxy is labeled as a reference feed, not settlement data. No verified CTO data/state contract was available, so fixture-only UI was used per protocol §2.

## Mobile checks
Rendered at 390 px (iPhone-class) and 440 px viewports. Verified end-to-end: header, Field State hero, Window, Evidence card (badge on one line + model-through date), direction indicator (up-arrow + 54.8%), Evidence Range bar, Quote Surface (Yes/No ¢ + freshness), action buttons, compliance footer, fixture banner. All three render cleanly with no truncation, overflow, or overlap. 44 × 44 px minimum touch targets met on buttons.

## Accessibility and reduced-motion behavior
- Contrast: WCAG AA — body 4.5:1, large text 3:1. Secondary label colors were lightened during QA to clear the 4.5:1 bar (e.g. Observatory `--ink-faint` → `#718089`).
- Color independence: direction always carries a glyph + text label, never color alone. State and freshness carry text.
- `prefers-reduced-motion`: all transitions and animations disabled; the Observatory's instrument sweep is removed entirely under reduced motion; critical information is accessible HTML, not locked in motion/canvas.
- Semantic HTML: `aria-label` on sections, `role="status"` on direction indicators, `aria-hidden` on decorative SVG.

## Performance observations
Single-file static HTML, no frameworks, no external JS runtime. Observatory loads Google Fonts (Instrument Serif / Geist) via CDN — the only network dependency; all others use system fallbacks. No Chart.js / canvas in the studies (unlike production). First paint is immediate; the only animation is a single `requestAnimationFrame` sweep that pauses on hidden tabs. No layout shift. No network calls at runtime.

## Known limitations
- Fixture data is illustrative only; numbers (54.8%, n=438, 54¢/46¢, +2.8¢ EV, 2026-08-30) are not real and must be replaced by CTO-verified values before any integration.
- The studies are visual/structural only — no interactivity beyond hover/focus states and the Observatory sweep. No state transitions, empty/error/stale states are wired (they are specified in the Constitution and COPY_STATES but not built here).
- Fonts depend on CDN availability; system fallbacks are specified but the distinctive character depends on the web fonts loading.
- `Signal Grain` vs `Evidence State` Founder decision (from ECD-COPY-01) is unresolved; the studies use the plainer evidence framing and avoid the candidate term.

## Dependencies on CTO / COO / Copy Editor
- **CTO:** a verified data/state contract is required before any data-backed UI advances beyond fixture. Needed: field names/types, source provenance, live/historical/replay/fixture state, timestamps, freshness semantics, error/stale behavior, allowed rounding, and sample fixture payloads. Without it, no claim of "live," "current," or "real-time" may be made or rendered.
- **COO:** review of this branch for scope and rollback readiness; record in Command Center; confirm it does not touch protected technical scope.
- **Copy Editor:** ECD review of the applied nomenclature is complete at study stage; Copy Editor should verify word-level voice and propose any candidate-term refinements before prototype.

## Founder decision required
1. **Select the v3 visual route.** ECD recommends **The Observatory** (with provenance treatment influenced by The Mint). This is the single gating decision before any integration proposal.
2. **Resolve `Signal Grain` vs `Evidence State`** (carried from ECD-COPY-01).
3. After a route is chosen and CTO provides a verified data contract, authorize the ECD to produce the selected route as a Prototype (isolated, fixture-schema, with empty/error/stale states).

## Recommended next action
Stop at Study stage. Awaiting Founder route selection + CTO data/state contract. The natural next ECD task is **ECD-03: Prototype the selected route** (Observatory recommended) with wired state transitions, empty/error/stale states, and reduced-motion parity — but only after the Founder selects a route and the CTO supplies a verified data/state contract.

## Rollback/removal path
The branch `feature/silverline-creative-system` is fully isolated: net-new files only, no existing production file touched, no merge to `master`, no production deploy, no changes to PRE/proxy/ledger/validation/cron/Vercel/credentials. To remove: `git push origin --delete feature/silverline-creative-system` and delete the local branch. No production data, configuration, or code requires rollback. The deployed preview is a private, non-production study artifact and carries no production effect.
