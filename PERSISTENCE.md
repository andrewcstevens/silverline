# Silverline V3 — Ledger persistence (DORMANT-READY, not yet active)

> **Status:** CODE IS WIRED AND DORMANT. The persistence layer (`api/_lib/persist.js`),
> the route (`api/ledger.js`), and the frontend wiring (`index.html` loads/saves
> `/api/ledger`) are all in place and shipped on `v3/production`. They are **no-op
> until the Founder adds the `BLOB_READ_WRITE_TOKEN` repo secret** — until then
> the ledger stays in memory and resets on reload. No personal financial data
> leaves the browser until the Founder opts in. This is the one remaining
> Gate A item; it is a 2-tap decision away from live.

## What is already built (dormant)

- `api/_lib/persist.js` — `loadLedger()` / `saveLedger(ledger)` / `hasBlob()`.
  Uses `@vercel/blob`'s `put` / `get` lazily (dynamic import inside the
  functions), keyed at `silverline-ledger.json`. With no token it returns the
  in-memory array and writes nothing; the SDK is never even loaded.
- `api/ledger.js` — `GET /api/ledger` → `{ ledger, persisted }`,
  `POST /api/ledger` (body `{ ledger: [...] }`) → `{ ok, persisted, count }`.
  Same structured logging + 503-style error handling as the other routes.
- `index.html` — boot calls `loadLedgerRemote()` then renders; `addBet` and
  `clear` call `saveLedgerRemote()` (debounced 300ms). If the API is absent or
  errors, it silently falls back to in-memory — the page never breaks.
- `package.json` — `@vercel/blob` declared in `dependencies`, so Vercel
  installs it automatically on the next deploy. The frontend works without it
  because the import is lazy.
- `vercel.json` — `/api/ledger` route mapped.

## To ACTIVATE persistence (Founder — 2 taps, no code change)

1. **Create the Vercel Blob store + connect it** (Vercel dashboard):
   - Project `silverline-v3` → **Storage** tab → **Create Blob Store**.
   - Name it `silverline-ledger` (any name works; the key inside is
     `silverline-ledger.json`).
   - **Connect** the store to the `silverline-v3` project. Vercel automatically
     injects the `BLOB_READ_WRITE_TOKEN` environment variable — you do not
     paste any token yourself, and it never appears in code or git.
2. **Redeploy once** so the connected store + `@vercel/blob` dep take effect:
   ```bash
   npx vercel deploy --prod --yes --token "$VERCEL_TOKEN"
   ```
   (Or push any commit to `v3/production` — Vercel auto-deploys from git and
   will install `@vercel/blob` from `package.json`.)

That's it. The moment the token exists, `hasBlob()` flips to `true`,
`loadLedger()`/`saveLedger()` start hitting Vercel Blob, and the frontend's
`/api/ledger` calls begin persisting — all with the exact code already on
`v3/production`. No further code change, no schema change, no UI change.

## To verify it activated

- `curl https://silverline-v3.vercel.app/api/ledger` → `{"ledger":[],"persisted":true}`
  (`persisted: true` confirms the token is present).
- Add a bet in the UI, reload the page, confirm it survived.

## Scope guardrails (already enforced)

- The Kalshi relay, PRE engine, snapshot/grade/series/cutoff routes are
  untouched by persistence — `persist.js` only owns the ledger.
- The ledger row shape is unchanged (`{slot,side,price,stake,result}`); only
  its storage backing changes when activated.
- `persist.js` never throws — a missing SDK or a Blob error logs a warning and
  falls back to memory, so a Blob outage degrades gracefully rather than
  breaking the ledger UI.
- Persistence does not make Silverline advice or auto-trading; the compliance
  copy stays in place.
