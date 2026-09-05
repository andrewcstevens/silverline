# Blocker A — Production Pipeline Recovery

**Opened:** 2026-08-30 · **Still open:** 2026-09-04 · **Severity:** highest standing risk

## The problem in one sentence

The code that generates the model the live site serves every morning is not in
version control and has no backup.

## Specifics

Three files live only inside the daily cron session's sandbox:

- `refresh_analysis.py` — the daily refresh driver that rebuilds `analysis.json`
- `analysis.py` — the analysis engine (edge, win rate, confidence intervals)
- `candles.parquet` — the cached BTC-USD candle store (~105k candles)

The daily cron (`26 13 * * *` UTC / ~6:26 AM PT) runs inside that session and uses
these files to refresh the model, deploy to Vercel, and push `analysis.json` here.
The pipeline is working — today's refresh committed normally. The risk is not that
it is broken; it is that it is **unbacked**. Lose that sandbox and the daily refresh
stops with no source to rebuild from.

## Why this was not fixed automatically

A sandbox belongs to the session that owns it. An agent in a different session
cannot read another session's workspace, and there is no capability to send a
command into another session. Verified: the session CLI exposes only
list / new / fork / get / set_title / members / archive / pin — nothing that posts a
message into an existing thread.

The files are also not recoverable from the session transcript — the stored record
for that session is a ~940-line conversation with three images and one HTML export.
It does not contain the Python source.

So this fix has to originate **inside** the cron session. It needs one action from
Andrew, and it is genuinely one action.

## The fix — literally what to do

The cron session is the Computer task titled **"Bitcoin 15-Minute Prediction Market
Wizard"** in the Silverline project.

1. Open the Silverline project and click into that thread.
2. Confirm the mode selector on the message box says **Computer** (not Search). If it
   says Search, switch it to Computer. A Search-mode message cannot reach the sandbox.
3. Paste this message and send it:

```
Commit the backend pipeline into GitHub so it stops being a single point of failure.

Add these to the andrewcstevens/silverline repo on master, under backend/:
  - refresh_analysis.py
  - analysis.py

Do NOT commit candles.parquet yet — report its file size first so we can decide
between Git LFS and regenerating it from the Coinbase API.

Copy the .py files verbatim. Do not refactor, rename, or repoint paths.
This is additive only: do not modify index.html, analysis.json, assets/, or any
existing ops/ file. Production deploys are CLI uploads and are unaffected by a
push to master.

When done, report the commit SHA and confirm nothing existing was modified.
```

4. It will report a commit SHA. Blocker A is then closed for the two `.py` files.

## Why `candles.parquet` is held back

It is a binary cache of ~105k candles. Committing it blindly could push a large
binary into a public repo on every refresh. Two options once its size is known:

- **Small (< ~50 MB):** commit once via Git LFS as a cold-start seed; keep it out of
  the daily commit so it does not bloat history.
- **Large, or regenerable:** do not commit it. Instead confirm `refresh_analysis.py`
  can rebuild it from the Coinbase Exchange API on a cold start, and record that as
  the documented recovery path. A regenerable cache does not need version control —
  only a proven regeneration procedure does.

`refresh_analysis.py` has to be read before this can be decided, which is another
reason step 1 above comes first.

## Definition of done

- [ ] `refresh_analysis.py` in `backend/`, verbatim
- [ ] `analysis.py` in `backend/`, verbatim
- [ ] `candles.parquet` size reported; LFS-vs-regenerate decision recorded
- [ ] Cold-start regeneration path confirmed or documented as a gap
- [ ] This brief updated and the Command Center's Blocker A entry closed

## Related standing finding (RE-0)

Production carries no Git metadata — deployments are CLI folder uploads, not
Git-triggered builds. So the deployed-SHA vs `master`-SHA mismatch and the
`gitDirty: "1"` flag recur permanently by design, and `master` is a mirror rather
than the deploy source. Separate from Blocker A, still open.
