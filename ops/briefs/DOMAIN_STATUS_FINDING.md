# Finding — `silverline.global` is not resolving

**Found:** 2026-09-04 21:35 PT, during post-commit verification
**Status:** Open. Not caused by any change made this session (this session's only
change was additive files on `master`; production deploys do not come from Git).

## What was observed

Three independent checks:

| Check | Result |
|---|---|
| Fetch `https://silverline.global/analysis.json` | `dns_failed_to_resolve` |
| DNS lookup `silverline.global` | No record returned |
| DNS lookup `silverline-global.vercel.app` | Resolves — `216.198.79.67`, `64.29.17.67` |
| Fetch `https://silverline-global.vercel.app/analysis.json` | **200 OK**, model current through `2026-09-04 13:30 UTC` |
| `vercel domains ls` (team `etherescape`) | **0 domains found** |
| `vercel inspect` on current production deployment | Still lists `silverline.global` among its aliases |

## What this means

- **The app is fine.** It is live, healthy, and serving today's model at
  `https://silverline-global.vercel.app`. No data loss, no build failure.
- **The custom domain is not reachable.** `silverline.global` has no DNS record and
  the Vercel team account lists zero domains — while deployments still carry it as a
  configured alias. So the alias points at a name that no longer resolves to anything.
- Earlier documentation in this repo and in the project spec describes
  `silverline.global` as "custom domain live, auto-SSL." That is **no longer accurate**
  and should not be repeated in status reports until re-verified.

## Not yet determined

The cause is not established and should not be guessed. Candidates, in rough order
of likelihood:

1. Domain registration lapsed or was not completed at the registrar.
2. Domain was removed from the Vercel team (leaving a stale deployment alias).
3. Nameservers were never fully pointed at Vercel, so it never resolved publicly and
   was only ever verified from a cached or authenticated context.

Distinguishing these requires a registrar check, which needs Andrew's account access.

## Next action (needs Andrew, ~5 minutes)

1. Check the registrar where `silverline.global` was bought — is it still registered
   and paid, and what nameservers are set?
2. If registered: re-add it in Vercel under project `silverline-global` (Settings →
   Domains) and point the nameservers as Vercel instructs.
3. If lapsed: decide whether to re-register `silverline.global` or stand down to the
   `.vercel.app` URL and update the docs accordingly.

Until then, treat `https://silverline-global.vercel.app` as the canonical live URL.

## Docs to correct once resolved

- `KALSHI_BUILD_SPEC.md` (project files) — "custom domain live, auto-SSL"
- `ops/COMMAND_CENTER.md` — "Live site" row
- Silverline project instructions — live URL line
