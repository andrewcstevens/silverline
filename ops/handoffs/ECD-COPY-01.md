# ECD-COPY-01 — ECD & Copy Editor Operating System

## Status

**Review ready — documentation only**

## Branch

`feature/ecd-copy-operations`

## Scope

This workstream creates a net-new operating package for the Silverline Executive Creative Director and Copy & Nomenclature Editor roles.

It establishes:

- ECD authority boundaries, operating loop, data/state contract discipline, cross-functional handoffs, release gates, and reporting.
- Copy Editor authority boundaries, three-layer copy model, terminology governance, verification chain, and reporting.
- A controlled Silverline nomenclature registry.
- Product voice rules.
- A consistent state copy system.
- Prohibited language and source/proxy protections.

## Files added

- `docs/SILVERLINE_ECD_OPERATING_PROTOCOL.md`
- `docs/SILVERLINE_COPY_NOMENCLATURE_OPERATING_PROTOCOL.md`
- `docs/SILVERLINE_NOMENCLATURE.md`
- `docs/SILVERLINE_VOICE.md`
- `docs/SILVERLINE_COPY_STATES.md`
- `docs/SILVERLINE_PROHIBITED_LANGUAGE.md`
- `ops/handoffs/ECD-COPY-01.md`

## Existing production files modified

No.

## Production behavior changed

No.

## Data, security, and deployment

- No live data used.
- No data source, PRE, Kalshi proxy, ledger, validation, backup, cron, Vercel, domain, environment-variable, or secret changes.
- No production deployment.
- No merge to `master`.

## Core operating decision

The work package adopts this governing language rule:

> Silverline may name the experience. It may not rename the truth.

Accordingly, proprietary experience language is paired with clear market/data truth. Example:

```text
QUOTE SURFACE
Kalshi reference quote
YES 54¢ · NO 46¢ · Updated 11 sec ago
Reference only. Manual decision required.
```

## Initial approved terminology

- The Field
- Field State
- Quiet Field
- Reading
- Watch
- Golden Window
- PRE Posture
- Signal Integrity
- Alignment
- Window
- Settlement Plane
- Resolve
- Trace
- Reeding
- Quote Surface
- Price-Adjusted Edge
- Evidence Range
- Observation Count
- Reference Feed
- Data Freshness

`Signal Grain` remains a Founder-choice candidate; the plainer alternative is `Evidence State`.

## Acceptance checks

- [x] No existing production file changes
- [x] No technical/data model claims introduced as implementation facts
- [x] Historical/proxy/fixture/live distinction protected
- [x] Manual-decision language preserved
- [x] Compliance language requirements included
- [x] Explicit prohibitions added for outcome promises, execution implications, and casino-style urgency
- [x] CTO verification required for data-backed claims
- [x] Founder approval required for permanent terminology and production integration

## Dependencies

Before terminology is integrated into a data-backed product surface, CTO must provide or confirm the relevant data/state contract: source, freshness, live/historical/replay/fixture state, error behavior, field semantics, and permitted claims.

## Founder decisions required

1. Approve the ECD + Copy Editor operating package for merge into the operational documentation set.
2. Select whether `Signal Grain` is retained as an elevated evidence label or replaced with `Evidence State`.
3. After ECD art-direction studies exist, choose the v3 visual route before any integration work begins.

## Recommended next action

Keep this as a draft review package. In parallel, authorize the ECD to produce `ECD-01` Creative Constitution, `ECD-02` three art-direction studies, and `ECD-05` voice/prototype applications using this operating protocol. Do not integrate into the live application until the Founder selects a visual direction and CTO verifies data contracts.

## Rollback/removal

This branch can be abandoned or its draft PR closed without production effect. No production data, configuration, or code requires rollback.
