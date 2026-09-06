# Silverline V3 — Rollback

This branch (`v3/production`) is the immutable source of truth for the V3
deployment. Every push is a reviewable, revertible change.

## Production identity

| Field        | Value                                                              |
| ------------ | ------------------------------------------------------------------- |
| Project       | `silverline-v3`                                                     |
| Project ID    | `prj_jVfaWKTkE9Z7YQ1iQkpovsFB6zXl`                                  |
| Production URL | https://silverline-v3.vercel.app                                   |
| Source branch | `v3/production` (repo `andrewcstevens/silverline`)                   |
| Health check  | https://silverline-v3.vercel.app/api/health                         |

## Instant rollback (Vercel)

Vercel keeps every production deployment and lets you switch the prod alias to a
previous one in seconds — no redeploy, no code change.

### Option A — Dashboard (recommended)

1. Open https://vercel.com/silverline-v3 (project `silverline-v3`).
2. **Deployments** tab → find the last known-good deployment.
3. Open its overflow menu (⋯) → **Rollback to this Deployment**.
4. Confirm. The production alias flips immediately; the old deployment stays
   available for another rollback if needed.

### Option B — CLI

```bash
# List recent production deployments and pick the target URL.
npx vercel ls --prod --yes --token "$VERCEL_TOKEN"

# Roll the prod alias back to a previous deployment.
npx vercel rollback <deployment-url> --prod --yes --token "$VERCEL_TOKEN"
```

`<deployment-url>` is the full `https://silverline-v3-<hash>-<scope>.vercel.app`
URL from `vercel ls`.

## Rollback checklist

- [ ] Confirm the target deployment predates the incident (check its commit SHA
      against `v3/production` history).
- [ ] After rollback, hit `https://silverline-v3.vercel.app/api/health` and
      verify `{ ok: true, kalshi: true }`.
- [ ] Load the page and confirm the snapshot/grade endpoints render data.
- [ ] If the issue is in code (not a transient Kalshi outage), open a hotfix
      PR against `v3/production`, merge, and let Vercel redeploy from the
      corrected commit — this supersedes the rollback once green.

## Notes

- The live V2 at https://silverline-global.vercel.app is **untouched** and
  remains a fallback surface; rolling back V3 never affects V2.
- `master` in the repo is the V2 source and is never modified by V3 work.
- Vercel also exposes runtime logs and deployment history automatically under
  the project dashboard — use these to confirm a rollback landed.
