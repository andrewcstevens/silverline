# CTO-02 Preview Deploy — Runbook & Results

**Last Updated:** 2026-08-30 13:58 PT
**Branch:** `feature/kalshi-proxy` (tip `ddcc3ac`)
**Safe-mode status:** preview deploy only. Production (`master` + `silverline-global` prod deployment) untouched.

## What was done

1. Linked the local repo to the existing Vercel project `silverline-global` (local `.vercel/` only — `projectId prj_5WAGhZZ8…`, team `etherescape`). No project config changed.
2. Preview-deployed `feature/kalshi-proxy` with `vercel deploy --yes` (no `--prod`). This deploys the full site (index.html + analysis.json + assets) **plus** the new `api/kalshi` serverless function as a **preview** deployment. Production deployment is untouched.
3. Inspected the deployment (read-only).

## Verified

| Check | Result | Evidence |
|---|---|---|
| Preview deploy | **Ready** | `vercel inspect`: `status ● Ready`, `target preview` |
| Python function built | **Yes** | inspect Builds: `λ api/kalshi (5.48MB) [iad1]` — Vercel's Python runtime built the `BaseHTTPRequestHandler` handler with no build error |
| Production deployment | **Untouched** | deploy used no `--prod`; `vercel ls` shows the preview as a separate deployment |
| Local proxy logic | **21/21 unit tests pass** | `api/test_proxy.py` (token gate, origin allowlist, path allowlist, injection, GET-only, query stripping, mocked happy path) |
| Local live smoke (through proxy) | **Pass** | real Kalshi via proxy: markets→200, orderbook→200 (live Up/Down ¢), historical/markets→200, historical/cutoff→200, injection→403 |
| Compile + imports | **Pass** | `py_compile` clean; entrypoint imports as both `kalshi` and `api.kalshi` |

## Blocker — Vercel Deployment Protection (SSO)

Automated runtime smoke of the preview URL is **blocked** by the `etherescape` team's Deployment Protection. Every request to the preview (including `/api/kalshi` and `/`) returns `302 → https://vercel.com/login?next=/sso-api?…`. The protection layer intercepts **before** the function executes, so the function's runtime response (401 fail-closed / 200 with token / 204 preflight) could not be verified via unauthenticated `curl`.

This is a verified environmental blocker, not a code defect:
- The function is built and Ready (proven by `vercel inspect`).
- The proxy logic is verified locally (unit tests + live smoke through the proxy).
- The only unverified piece is the **Vercel Python runtime invocation** — i.e., does Vercel correctly route an incoming `/api/kalshi` request into the `handler` class and return its response.

## Founder decision needed (Founder Inbox #3, expanded)

To fully smoke the Vercel runtime, one of:
- **(a) Andrew opens the preview URL in a browser** logged into the `etherescape` team. The function would then execute: `GET /api/kalshi?path=historical/cutoff` returns 401 (no token set — fail-closed, proving routing); `OPTIONS` returns 204 + CORS. This is the least-invasive verification and needs no config change. The preview URL: `https://silverline-global-gnamw5bla-etherescape.vercel.app`
- **(b) Temporarily disable Deployment Protection** for preview testing (Vercel project setting → "Deployment Protection" → off). This is a **production-setting change requiring Founder approval** — NOT done in safe mode.
- **(c) Defer runtime smoke** to the production-go-live gate and accept current local + build verification.

Separately, the token model (D-006) is itself a Founder decision: the bearer token is anti-abuse, not a real secret (visible in frontend source). Full happy-path smoke (200 + data) additionally requires setting `SILVERLINE_PROXY_TOKEN` as a preview-scoped env var — also a Founder decision, not done unattended.

## Commands used (reproducible)

```bash
# from the silverline-repo, on feature/kalshi-proxy
npx vercel link --yes --project silverline-global --token "$VERCEL_TOKEN"
npx vercel deploy --yes --token "$VERCEL_TOKEN"           # preview, NO --prod
npx vercel inspect <preview-url> --token "$VERCEL_TOKEN"   # read-only
```

## What was NOT done (safe-mode compliance)

- No `--prod` deploy. No merge to `master`.
- No Vercel env vars set (token or otherwise) — `SILVERLINE_PROXY_TOKEN` remains unset.
- No Vercel project config, domain, cron, or build-setting change.
- No change to `index.html`, `analysis.json`, the ledger, or PRE logic.
- The link is local-only (`.vercel/` is gitignored; not committed).
