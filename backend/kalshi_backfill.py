#!/usr/bin/env python3
"""
Silverline — Kalshi KXBTC15M settlement backfill (Step 1 prototype).

Paginates Kalshi's public, no-auth endpoints server-side to collect REAL
settlement outcomes for the BTC 15-min Up/Down series, then reports depth.

Two endpoints are needed because of the live/historical boundary:
  - /markets?series_ticker=KXBTC15M&status=settled   -> recent settled (after cutoff)
  - /historical/markets?series_ticker=KXBTC15M        -> archived settled (before cutoff)
  - /historical/cutoff                                 -> the boundary timestamp

No API key, no Kalshi account. Public market data only.
Per Developer Agreement 3.1: caching is permitted to facilitate Andrew's own
trading. Output here is a measured prototype, not a published feed.
"""
import json
import time
import sys
from datetime import datetime, timezone

import requests

BASE = "https://external-api.kalshi.com/trade-api/v2"
SERIES = "KXBTC15M"
TIMEOUT = 30
SLEEP_BETWEEN_PAGES = 0.15  # light throttle; public reads, no token budget
MAX_PAGES_PER_ENDPOINT = 2000  # safety cap against cursor loops

OUT_PATH = "/home/user/workspace/btc-wizard/backend/kalshi_settlement_raw.json"
SUMMARY_PATH = "/home/user/workspace/btc-wizard/backend/kalshi_backfill_summary.json"

# NOTE: verified field names from the live schema. Earlier guesses
# (settlement_time, volume) do not exist; use settlement_ts, volume_fp.
FIELDS = [
    "event_ticker", "result", "expiration_value", "floor_strike",
    "settlement_ts", "close_time", "open_time", "occurrence_datetime",
    "last_price_dollars", "volume_fp", "volume_24h_fp", "open_interest_fp",
    "notional_value_dollars", "settlement_value_dollars",
    "market_type", "yes_bid_dollars", "yes_ask_dollars", "yes_sub_title",
    "status",
]


def cutoff():
    r = requests.get(f"{BASE}/historical/cutoff", timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def paginate(path, extra_params=None):
    """Walk a cursor-paginated Kalshi endpoint. Yields (market_dict, page_no)."""
    params = dict(extra_params or {})
    seen = set()
    cursor = ""
    page = 0
    while page < MAX_PAGES_PER_ENDPOINT:
        if cursor:
            params["cursor"] = cursor
        r = requests.get(f"{BASE}/{path}", params=params, timeout=TIMEOUT)
        if r.status_code == 429:
            # rate limited; back off
            time.sleep(2)
            continue
        r.raise_for_status()
        body = r.json()
        markets = body.get("markets", [])
        if not markets:
            break
        new_count = 0
        for m in markets:
            t = m.get("event_ticker")
            if t in seen:
                continue
            seen.add(t)
            yield m, page
            new_count += 1
        cursor = body.get("cursor", "")
        page += 1
        if not cursor or new_count == 0:
            break
        time.sleep(SLEEP_BETWEEN_PAGES)
    return page


def parse_ts(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def main():
    cut = cutoff()
    print("=== /historical/cutoff ===")
    print(json.dumps(cut, indent=2))

    all_markets = {}

    # 1. Recent settled (live side of cutoff)
    print("\n=== Paginating /markets?status=settled (recent) ===")
    p_recent = 0
    for m, pg in paginate("markets", {"series_ticker": SERIES, "status": "settled", "limit": 100}):
        all_markets[m["event_ticker"]] = m
        p_recent = pg
    print(f"recent pages walked: ~{p_recent}; collected so far: {len(all_markets)}")

    # 2. Archived settled (historical side of cutoff)
    print("\n=== Paginating /historical/markets (archived) ===")
    p_hist = 0
    for m, pg in paginate("historical/markets", {"series_ticker": SERIES, "limit": 100}):
        all_markets[m["event_ticker"]] = m
        p_hist = pg
    print(f"historical pages walked: ~{p_hist}; total collected: {len(all_markets)}")

    # Schema check: show first market's keys
    sample = next(iter(all_markets.values())) if all_markets else {}
    print("\n=== Sample market keys ===")
    print(list(sample.keys()))

    # Per-field presence check across the corpus
    present = {f: 0 for f in FIELDS}
    result_values = {}
    for m in all_markets.values():
        for f in FIELDS:
            v = m.get(f)
            if v not in (None, "", []):
                present[f] += 1
        rv = m.get("result")
        if rv:
            result_values[rv] = result_values.get(rv, 0) + 1

    # Date range — use close_time (window end) as the settlement anchor
    times = [parse_ts(m.get("close_time")) for m in all_markets.values()]
    times = [t for t in times if t]
    earliest = min(times) if times else None
    latest = max(times) if times else None

    # Win/loss outcome distribution (Up/Yes result)
    n_yes = result_values.get("yes", 0)
    n_no = result_values.get("no", 0)
    n_resolved = n_yes + n_no
    n_with_value = present.get("expiration_value", 0)
    n_with_strike = present.get("floor_strike", 0)

    summary = {
        "series": SERIES,
        "run_utc": datetime.now(timezone.utc).isoformat(),
        "historical_cutoff": cut,
        "total_settled_markets_collected": len(all_markets),
        "date_range": {
            "earliest_close_time": earliest.isoformat() if earliest else None,
            "latest_close_time": latest.isoformat() if latest else None,
            "span_days": (latest - earliest).days if earliest and latest else None,
            "span_years_approx": round((latest - earliest).days / 365.25, 2) if earliest and latest else None,
        },
        "field_presence": present,
        "result_distribution": result_values,
        "resolved_yes_no": {"yes": n_yes, "no": n_no, "total_resolved": n_resolved},
        "base_rate_yes": round(n_yes / n_resolved, 4) if n_resolved else None,
        "base_rate_no": round(n_no / n_resolved, 4) if n_resolved else None,
        "markets_with_expiration_value": n_with_value,
        "markets_with_floor_strike": n_with_strike,
        "note": "expiration_value=final benchmark price; floor_strike=target strike; result=yes/no=Up/Down outcome",
    }

    print("\n=== SUMMARY ===")
    print(json.dumps(summary, indent=2))

    # Persist raw + summary for later cron integration
    with open(OUT_PATH, "w") as f:
        json.dump(list(all_markets.values()), f)
    with open(SUMMARY_PATH, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"\nRaw settlement written: {OUT_PATH} ({len(all_markets)} markets)")
    print(f"Summary written: {SUMMARY_PATH}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(130)
