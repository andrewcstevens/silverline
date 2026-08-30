# REEDING-01 — Motion Study 01: Technical Discovery & File-Level Implementation Plan

**Last Updated:** 2026-08-30 14:10 PT
**Branch:** `feature/reeding-01-motion`
**Artifact:** `motion/prototype.html` (live preview deployed; static, self-contained)
**Safe-mode status:** documentation + static prototype only. No production file modified. `master` untouched.

---

## 1. Technical Discovery — current site

Read from the production `index.html` (master `edddb188`, 986 lines) during this study:

- **Aesthetic:** already dark/card-based — matches the proposed v3 direction. Tokens: `--bg:#0b0e11`, `--panel:#14181d`, `--line:#262d36`, `--txt:#e6e8eb`, `--teal:#2dd4bf` accent, `--up/--down/--amber/--blue` for direction semantics.
- **Typography:** `--display:"Fraunces"` (serif, KPIs/numbers), `--sans/--mono:"General Sans"`. `font-variant-numeric:tabular-nums` throughout — numbers must not jitter.
- **Layout:** `.wrap` max 1180px; card grids `.g3/.g2/.g4` collapse to single column at `@media(max-width:860px)`. Mobile-first reorder already exists (KPI row pulled above Buy Signal under 860px). So the v3 mobile-first base is largely present — the gap is motion, not layout.
- **Sections (DOM order):** sticky-ish topbar (logo + live price + clock) → tabs → Buy Signal panel (3 winboxes) → KPI grid (Live BTC / Right-Now Slot / Best Edge) → Top Edge Slots table → Win Rate by Weekday (Chart.js) → Day/Night session heatmaps (Chart.js canvas) → EV calculator → ledger → footer.
- **Existing motion:** only `@keyframes sh` (skeleton shimmer). No parallax, no ambient, no scroll reveals. Charts are Chart.js canvases.
- **Live data cadence:** the topbar price/clock and the "Right-Now Slot" update on a timer; the daily model refresh rewrites `analysis.json`. Motion must not compete with these.

## 2. Motion requirements (from v3 build directives)

1. **Parallax scrolling** across sections (Buy Signal → Ticker → Heatmaps → EV → Ledger).
2. **Ambient background** looping animation — subtle, continuous motion behind content, not a one-shot.
3. **Mobile-first** — design for phone viewport first, scale up.
4. **`prefers-reduced-motion`** — parallax/ambient layers degrade gracefully.
5. **Performance** — checked in real time against a live market clock; motion must not introduce input lag or drop the live ticker's update cadence.

### Hard constraint (Silverline-specific)
Legibility of numbers wins over spectacle whenever the two conflict. This is a probability tool people bet real money against — tabular-nums, KPI contrast, and chart readability are non-negotiable. Motion is atmosphere, never foreground.

## 3. Motion design — "reeding"

Named for the milled grooves on a coin's edge (the Silverline identity). The motion layers evoke sensing a statistical edge before the market shows it.

| Layer | What it does | Mechanism | Why it's safe |
|---|---|---|---|
| **Ambient reeding** | Vertical milled grooves drift slowly horizontally across the whole viewport | `position:fixed` layer, `repeating-linear-gradient`, `background-position` animation 46s linear infinite | Fixed/out-of-flow → no CLS; `background-position` runs on the compositor → no main-thread work, ticker unaffected |
| **Ambient glow** | Two soft radial glows (teal top-right, blue bottom-left) breathing | `opacity` 14s ease-in-out infinite | `opacity` only, compositor-friendly |
| **Parallax depth** | Reeding drifts slower than scroll for depth | `animation-timeline: scroll()` on the fixed reed layer | Applied ONLY to a fixed, out-of-flow layer — never to in-flow content (avoids CLS) |
| **Section reveals** | Cards fade/clip-reveal as they enter viewport | `clip-path: inset()` + `opacity`, `animation-timeline: view()` | Element occupies final space immediately; only the visual mask animates → zero layout shift |
| **Staggered cards** | Cards in a grid reveal 60ms apart | `animation-delay` per `:nth-child` | Total stagger < 400ms; feels alive, not slow |
| **Sticky topbar** | Topbar stays during scroll with blur | `position:sticky` + `backdrop-filter: blur()` | Keeps the live price always visible (the most-glanced datum) |

**Easing:** reveal = ease-out `cubic-bezier(0.16,1,0.3,1)`; ambient continuous = `linear` (correct for constant loops). Per the motion guide, scroll-reveals use `opacity`/`clip-path` only — never `translateY` (which causes CLS).

### Reduced-motion fallback
`@media (prefers-reduced-motion: reduce)` disables all ambient + reveal animations, sets the reed layer static, forces reveals to `opacity:1; clip-path:none`. The page is fully usable and legible with zero motion. Numbers still update (value changes are not motion).

### Performance verification
- No JS scroll listeners (`scroll` / `IntersectionObserver`) — reveals use native CSS scroll-driven animations, which the browser batches off the main thread.
- Ambient layers are `position:fixed` + compositor properties (`background-position`, `opacity`) → they do not trigger layout or block the price/clock timer.
- The prototype's mock ticker updates every 1.5s on a `setInterval` (no rAF loop) to prove motion does not steal the frame budget the ticker needs. In production the ticker is the Coinbase spot fetch; the motion layers never touch that code path.

## 4. File-level implementation plan (for the real index.html)

This is a plan, not applied. All changes are additive and gated behind feature flags / `@supports` so nothing existing breaks. No production edit happens without Founder approval (D-002).

| Step | File | Change | Risk to existing |
|---|---|---|---|
| 1 | `index.html` | Wrap existing `<div class="wrap">` content: add `<div class="ambient" aria-hidden="true"><div class="reed"></div><div class="glow"></div></div>` before `.wrap`, set `.wrap{position:relative;z-index:1}` | None — additive layer, behind existing content |
| 2 | `index.html` `<style>` | Append the motion CSS block (ambient + reveals + reduced-motion) from `motion/prototype.html` | None — appended CSS; existing rules keep precedence for shared selectors via specificity |
| 3 | `index.html` | Add `class="reveal"` / `class="fade"` to existing section cards (Buy Signal, KPI grid, Top Edge, Heatmaps, EV, ledger) | None — classes are additive; `@supports` gates the animation so browsers without scroll-driven support see no change |
| 4 | `index.html` | Make `.topbar` sticky + blur (it is currently not sticky) | Low — sticky is a non-breaking position change; verify it doesn't overlap the tabs row on mobile |
| 5 | none | No JS changes. The live ticker, Chart.js, ledger, and PRE logic are untouched. | None — motion is CSS-only by design |

**Gate:** every motion rule is wrapped in `@supports (animation-timeline: view())` / `scroll()` so browsers without support (older Safari) render the current static site. The reduced-motion media query is the second gate.

## 5. What this prototype proves

- The dark/card aesthetic + Fraunces/General Sans tokens already match v3 — no reskin needed, only motion.
- Parallax + ambient motion can be added as pure CSS (no JS, no new deps) without touching the live-data code path or the Chart.js canvases.
- The motion is legibility-safe: atmosphere lives behind content on fixed compositor layers; numbers and tables stay crisp and tabular.
- `prefers-reduced-motion` degrades to the current static experience cleanly.

## 6. Founder decisions needed

1. **Aesthetic confirmation** — confirm dark/card-based as the v3 direction (the prototype uses the existing tokens). Or specify a different lane.
2. **v3 as replacement or parallel build** — does this replace the live v2.0 deploy outright, or ship as a parallel comparison build?
3. **Motion intensity** — the prototype is deliberately subtle. Want it more or less pronounced?
4. **Reference feel** — AlphaLedger (Behance) was the earlier UX reference. Same lane for the motion layer, or a different reference?

## 7. Checks run

- `deploy_website` preview: rendered cleanly, no clipping/overlap, all sections + table + heatmaps aligned (auto visual QA).
- Code review: motion CSS is `@supports`-gated + reduced-motion media query present; no JS scroll listeners; ambient layers `position:fixed` (out of flow).

## 8. Not done (safe-mode compliance)

- No edit to production `index.html`, `analysis.json`, the ledger, PRE logic, or any existing file.
- No merge, no deploy to Vercel/production.
- The prototype is a standalone static file in `motion/`, committed to `feature/reeding-01-motion`.
