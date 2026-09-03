// Optional LIVE integration test. Only runs when KALSHI_LIVE=1 is set.
// Skipped by default so CI never touches the network. No auth is used — this
// hits Kalshi's public market-data endpoints only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { KalshiClient } from "../client";
import { getSeries, BTC_15M_SERIES } from "../series";
import { getOpenMarkets, getMarket, getSettledMarkets } from "../markets";
import { getCandlesticks } from "../candlesticks";
import { getResolution } from "../resolve";

const LIVE = process.env.KALSHI_LIVE === "1";
const skip = LIVE ? test : test.skip;

skip("live: series KXBTC15M is public and returns fifteen_min frequency", async () => {
  const client = new KalshiClient({ minRequestIntervalMs: 1100 });
  const s = await getSeries(client, BTC_15M_SERIES);
  assert.equal(s.ticker, "KXBTC15M");
  assert.equal(s.frequency, "fifteen_min");
});

skip("live: open + settled markets and a single market round-trip", async () => {
  const client = new KalshiClient({ minRequestIntervalMs: 1100 });
  const open = await getOpenMarkets(client, BTC_15M_SERIES);
  assert.ok(open.length >= 0);
  const settled = await getSettledMarkets(client, BTC_15M_SERIES);
  assert.ok(settled.length > 0, "expected at least one settled KXBTC15M market");
  const sample = settled[0];
  const one = await getMarket(client, sample.ticker);
  assert.ok(one);
  assert.equal(one?.ticker, sample.ticker);
  const r = await getResolution(client, sample.ticker);
  assert.ok(r?.resolved, "settled market should be resolved");
  assert.ok(r?.outcome === "up" || r?.outcome === "down");
});

skip("live: candlesticks for an open market return chronologically", async () => {
  const client = new KalshiClient({ minRequestIntervalMs: 1100 });
  const open = await getOpenMarkets(client, BTC_15M_SERIES);
  if (open.length === 0) return; // no open market right now — nothing to assert
  const m = open[0];
  const end = Math.floor(Date.now() / 1000);
  const start = end - 600; // last 10 minutes
  const candles = await getCandlesticks(client, m.ticker, start, end, 1);
  assert.ok(candles.length >= 0);
  for (let i = 1; i < candles.length; i++) {
    assert.ok(candles[i - 1].end_period_ts <= candles[i].end_period_ts, "candles must be time-ordered");
  }
});
