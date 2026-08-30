# Silverline Kalshi Proxy — CTO-02

A Vercel serverless function that proxies **public, read-only** Kalshi API
endpoints server-side so the browser can read live Kalshi data (order book,
real-time Up/Down ¢, instant settlement) without hitting Kalshi's CORS block.

**Safe-mode status (as built):** code + tests live on branch
`feature/kalshi-proxy`, based on `master` (`edddb188`). **Not deployed, not
merged, no Vercel config/env change, no prod change.** master untouched. This is
a non-production artifact awaiting Founder/COO review and a deploy decision.

---

## Why a proxy

The browser cannot call `external-api.kalshi.com` directly — Kalshi returns no
`Access-Control-Allow-Origin` header, so any `fetch()` is blocked by the browser.
The proxy runs on Vercel (server-side, no CORS restriction) and re-adds a
restricted CORS header so only Andrew's browser origin is served.

## Files

- `api/kalshi_lib.py` — pure, Vercel-free core logic (unit-testable).
- `api/kalshi.py` — Vercel Python runtime entrypoint (`BaseHTTPRequestHandler`).
- `api/test_proxy.py` — 17 local unit tests (no network, mocked upstream).

## Route

```
GET    /api/kalshi?path=<kalshi_path>&<kalshi_query_params>
OPTIONS /api/kalshi   (CORS preflight)
```

Examples:

```
GET /api/kalshi?path=markets&series_ticker=KXBTC15M&status=open
  -> https://external-api.kalshi.com/trade-api/v2/markets?series_ticker=KXBTC15M&status=open

GET /api/kalshi?path=historical/markets&series_ticker=KXBTC15M&cursor=<cursor>
GET /api/kalshi?path=markets/KXBTC15M-20260830T1600/orderbook
GET /api/kalshi?path=series/KXBTC15M
GET /api/kalshi?path=historical/cutoff
```

## Security posture

1. **GET-only, read-only.** No request body is ever forwarded. POST/PUT/DELETE/PATCH → 405.
2. **Path allowlist (exact regex shapes).** Only these are proxied:
   - `series/{ticker}`
   - `markets` (list, with query params)
   - `markets/{ticker}/orderbook`
   - `historical/markets` (paginated)
   - `historical/cutoff`
   Everything else → 403. This is an **allowlist**, not a blocklist: trading,
   portfolio, ws, auth, orders, positions, balances are all rejected because they
   don't match an allowed shape. (Candlesticks were tried and return 404 on Kalshi
   for KXBTC15M markets, so that path is not in the allowlist.)
3. **Query-param stripping + path quoting.** Only allowlisted params per path are
   forwarded; any extra param is dropped. Each path segment is URL-quoted when
   building the upstream URL, so `?`, `#`, `&`, and whitespace cannot inject into
   the upstream URL (the segment regex also restricts chars to `[\w.\-:]+`).
4. **Token gate (lightweight anti-abuse).** `Authorization: Bearer <SILVERLINE_PROXY_TOKEN>`.
   Fails closed (401) if no token is configured. **This is NOT a real secret** —
   anyone who reads the deployed frontend source can see it. It stops random bots
   from using Andrew's proxy as a free Kalshi API, which is the "lightweight
   authentication permitted" by the Kalshi Developer Agreement. It is not, and is
   not claimed to be, real access control.
5. **CORS origin allowlist.** `silverline.global` and the Vercel preview alias
   are allowed; the `Origin` header is reflected only if it matches. A browser
   Origin not on the list is rejected (403) even with a valid token. Non-browser
   callers (curl, ops) have no Origin header and are allowed via the token gate.
   This bounds the surface to Andrew's browser origins — but because the token is
   visible in frontend source and absent-Origin requests are allowed, this is
   **lightweight anti-abuse, not hard access control** (see #4).
6. **No logging of request bodies** (there are none to log — GET only).
7. **Upstream errors** are surfaced as 502 with the Kalshi status, but no Kalshi
   auth tokens or internal headers leak.

### What it does NOT do

- No trading. No order placement. No portfolio access. No Kalshi RSA auth. Ever.
- No rate limiting built in (Vercel imposes its own; document a cap if abuse appears).
- The token is visible in frontend source — by design, as lightweight auth.

## Tests

```
python3 api/test_proxy.py            # 17 tests, ~0s, no network
```

Covers: token gate (missing/wrong/none-configured), origin allowlist (allowed
browser / blocked browser / no-Origin ops), CORS preflight, path allowlist
(read-only allowed, trading endpoints blocked, unknown subpaths blocked),
path-injection attempts (`?`, `&` in segments -> 403), segment URL-quoting,
query-param stripping, GET-only enforcement, mocked upstream happy path.

A live read-only smoke was run **through the proxy itself** (real fetch against
`external-api.kalshi.com`, test token) for every CTO-02 path:
- `markets?series_ticker=KXBTC15M&status=open` → 200 (returned open market
  `KXBTC15M-26AUG292315-15`)
- `markets/{ticker}/orderbook` → 200 (real `no_dollars`/`yes_dollars` prices →
  this is the live Up/Down ¢ feed)
- `historical/markets?series_ticker=KXBTC15M&limit=1` → 200 (cursor + market)
- `historical/cutoff` → 200
- `markets/{ticker}/candlesticks` → 404 on Kalshi (removed from allowlist)
- injection `series/KXBTC15M?evil=1` → 403 (blocked)

## Exact future wiring (NOT done in safe mode — Founder decision required)

To go live (separate, Founder-approved step — not part of this branch's build):

1. **Merge** `feature/kalshi-proxy` into `master` after COO review.
2. **Vercel env vars** (set in the `silverline-global` project settings; never
   commit real values):
   - `SILVERLINE_PROXY_TOKEN` — a random shared secret (e.g. `openssl rand -hex 32`).
   - `SILVERLINE_ALLOWED_ORIGINS` — `https://silverline.global` (+ preview if wanted).
3. **Frontend** must send `Authorization: Bearer <token>` with each `/api/kalshi`
   request. Because the site is vanilla JS (no framework build step), the token
   would be embedded in `index.html` / a small JS constant — visible in source.
   Acceptable as lightweight auth per the design above; Andrew should decide
   whether to accept that visibility or add a build step.
4. **Deploy**: the existing daily cron already deploys via
   `npx vercel deploy --yes --prod --token $VERCEL_TOKEN`; merging to master and a
   deploy is expected to pick up the new `api/` functions (Vercel detects the
   Python runtime from `api/*.py`), but this has **not been preview-tested** —
   it must be verified on a preview deploy before going to prod.
5. **Smoke** live: `curl -H "Authorization: Bearer $T" "https://silverline.global/api/kalshi?path=historical/cutoff"`.

## Kalshi Developer Agreement posture

This proxy facilitates Andrew's own trading by serving **public market data** to
his own browser origins. It does not redistribute Kalshi data to third parties
(token + origin gate bound the surface to Andrew's browser origins, though as
noted this is lightweight anti-abuse, not hard access control). It uses only
lightweight authentication (a shared secret), which is permitted. It does not use,
store, or proxy Kalshi's authenticated (trading) API. Live order book /
settlement data shown is the same data Kalshi publishes on its own website; this
surface just makes it reachable from the browser by relocating the fetch
server-side.

## Kalshi API facts (verified during OPS-01)

- Base URL: `https://external-api.kalshi.com/trade-api/v2` (NOT `api.kalshi.com` /
  `trapi.kalshi.com` — those do not resolve from the sandbox).
- These endpoints are public, no-auth: `/series/{ticker}`, `/markets`,
  `/historical/markets`, `/markets/{ticker}/orderbook`, `/markets/{ticker}/candlesticks`,
  `/historical/cutoff`.
- No CORS header from Kalshi → browser fetch blocked → this proxy is required.
