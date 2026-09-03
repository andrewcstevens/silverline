import { test } from "node:test";
import assert from "node:assert/strict";
import { getCandlesticks, getHistoricalCutoff } from "../candlesticks";
import { mockClient } from "./mock";

const NOW = Date.parse("2026-09-03T01:10:00Z") / 1000;

function candle(ts: number): unknown {
  return { end_period_ts: ts, price: { close_dollars: "0.50", open_dollars: "0.40" } };
}

test("getHistoricalCutoff parses the cutoff response", async () => {
  const client = mockClient([
    {
      match: "historical/cutoff",
      response: {
        market_positions_last_updated_ts: "2026-07-04T00:00:00Z",
        market_settled_ts: "2026-07-04T00:00:00Z",
      },
    },
  ]);
  const c = await getHistoricalCutoff(client);
  assert.equal(c.market_settled_ts, "2026-07-04T00:00:00Z");
});

test("getCandlesticks rejects invalid interval", async () => {
  const client = mockClient([
    { match: "candlesticks", response: { candlesticks: [] } },
    { match: "historical/cutoff", response: { market_settled_ts: "2026-07-04T00:00:00Z" } },
  ]);
  await assert.rejects(() => getCandlesticks(client, "KXBTC15M-X", NOW - 60, NOW, 30 as never));
});

test("getCandlesticks returns empty when end <= start", async () => {
  const client = mockClient([
    { match: "historical/cutoff", response: { market_settled_ts: "2026-07-04T00:00:00Z" } },
  ]);
  const out = await getCandlesticks(client, "KXBTC15M-X", NOW, NOW);
  assert.deepEqual(out, []);
});

test("getCandlesticks uses live endpoint for recent ranges", async () => {
  let calledPath = "";
  const client = mockClient([
    {
      match: "candlesticks",
      response: (url: string) => {
        calledPath = url;
        if (url.includes("historical/markets")) {
          return { candlesticks: [] };
        }
        return { candlesticks: [candle(NOW - 60), candle(NOW)], ticker: "KXBTC15M-X" };
      },
    },
    { match: "historical/cutoff", response: { market_settled_ts: "2026-07-04T00:00:00Z" } },
  ]);
  const out = await getCandlesticks(client, "KXBTC15M-26SEP022115-15", NOW - 120, NOW, 1);
  assert.equal(out.length, 2);
  assert.match(calledPath, /series\/KXBTC15M\/markets\/KXBTC15M-26SEP022115-15\/candlesticks/);
});

test("getCandlesticks routes to historical endpoint when range predates cutoff", async () => {
  let calledPath = "";
  const client = mockClient([
    {
      match: "candlesticks",
      response: (url: string) => {
        calledPath = url;
        return { candlesticks: [candle(NOW - 200), candle(NOW - 60)] };
      },
    },
    { match: "historical/cutoff", response: { market_settled_ts: "2026-09-02T00:00:00Z" } },
  ]);
  // NOW is 2026-09-03, cutoff is 2026-09-02, so end (NOW) > cutoff -> NOT fully historical.
  // Use a range fully before the cutoff.
  const before = Date.parse("2026-09-01T00:00:00Z") / 1000;
  const out = await getCandlesticks(client, "KXBTC15M-26SEP022115-15", before - 120, before, 1);
  assert.match(calledPath, /historical\/markets\/KXBTC15M-26SEP022115-15\/candlesticks/);
  assert.equal(out.length, 2);
});

test("getCandlesticks falls back to historical endpoint on live 404", async () => {
  const seenPaths: string[] = [];
  const client = mockClient([
    {
      match: "series/KXBTC15M/markets",
      response: { error: "not found" },
      status: 404,
    },
    {
      match: "historical/markets/KXBTC15M-26SEP022115-15/candlesticks",
      response: { candlesticks: [candle(NOW - 60), candle(NOW)] },
    },
    { match: "historical/cutoff", response: { market_settled_ts: "2026-07-04T00:00:00Z" } },
  ]);
  const out = await getCandlesticks(client, "KXBTC15M-26SEP022115-15", NOW - 120, NOW, 1);
  assert.equal(out.length, 2);
});

test("getCandlesticks chunks wide ranges to respect the 5000-candle cap", async () => {
  let requests = 0;
  const client = mockClient([
    {
      match: "candlesticks",
      response: (url: string) => {
        requests++;
        // each window returns one candle whose ts is derived from start_ts in URL
        const m = url.match(/start_ts=(\d+)/);
        const ts = m ? Number(m[1]) : 0;
        return { candlesticks: [candle(ts)] };
      },
    },
    { match: "historical/cutoff", response: { market_settled_ts: "2026-07-04T00:00:00Z" } },
  ]);
  // 1-minute interval, 12000 seconds = 12000 candles -> needs 3 windows of 5000.
  const out = await getCandlesticks(client, "KXBTC15M-X", NOW - 12000, NOW, 1);
  assert.ok(requests >= 3, `expected >=3 chunked requests, got ${requests}`);
  assert.equal(out.length, requests); // one candle per window
  // sorted ascending by end_period_ts
  assert.ok(out[0].end_period_ts < out[out.length - 1].end_period_ts);
});

test("getCandlesticks dedups overlapping windows by end_period_ts", async () => {
  const client = mockClient([
    {
      match: "candlesticks",
      response: { candlesticks: [candle(NOW - 60), candle(NOW)] },
    },
    { match: "historical/cutoff", response: { market_settled_ts: "2026-07-04T00:00:00Z" } },
  ]);
  const out = await getCandlesticks(client, "KXBTC15M-X", NOW - 120, NOW, 1);
  const ts = out.map((c) => c.end_period_ts);
  assert.equal(new Set(ts).size, ts.length);
});
