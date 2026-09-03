import { test } from "node:test";
import assert from "node:assert/strict";
import { getSeries, BTC_15M_SERIES } from "../series";
import { mockClient } from "./mock";

const SERIES_BODY = {
  series: {
    ticker: "KXBTC15M",
    title: "Bitcoin price up down",
    category: "Crypto",
    frequency: "fifteen_min",
    tags: ["BTC", "15 min"],
    settlement_sources: [{ name: "CF Benchmarks", url: "https://www.cfbenchmarks.com/" }],
  },
};

test("getSeries returns the series object", async () => {
  const client = mockClient([{ match: "series/KXBTC15M", response: SERIES_BODY }]);
  const s = await getSeries(client, "KXBTC15M");
  assert.equal(s.ticker, "KXBTC15M");
  assert.equal(s.frequency, "fifteen_min");
  assert.equal(s.category, "Crypto");
  assert.deepEqual(s.settlement_sources?.[0], { name: "CF Benchmarks", url: "https://www.cfbenchmarks.com/" });
});

test("getSeries defaults to KXBTC15M", async () => {
  const client = mockClient([{ match: "series/KXBTC15M", response: SERIES_BODY }]);
  const s = await getSeries(client);
  assert.equal(s.ticker, BTC_15M_SERIES);
});

test("getSeries requests the correct path", async () => {
  const client = mockClient([{ match: "series/KXBTC15M", response: SERIES_BODY }]);
  await getSeries(client, "KXBTC15M");
  // The mock matched on the substring "series/KXBTC15M"; a mismatched path
  // would have returned 404 and thrown, so reaching here means the path was right.
  assert.ok(true);
});
