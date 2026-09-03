import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getOpenMarkets,
  getMarket,
  getSettledMarkets,
  listMarkets,
  seriesOfTicker,
} from "../markets";
import { mockClient } from "./mock";

function marketPage(markets: unknown[], cursor = ""): unknown {
  return { cursor, markets };
}

test("seriesOfTicker extracts series prefix", () => {
  assert.equal(seriesOfTicker("KXBTC15M-26SEP022115-15"), "KXBTC15M");
  assert.equal(seriesOfTicker("KXBTC-1H-26SEP02"), "KXBTC");
  assert.equal(seriesOfTicker("NOTICKERDASH"), "NOTICKERDASH");
});

test("listMarkets unwraps a single page", async () => {
  const client = mockClient([
    {
      match: "series_ticker=KXBTC15M",
      response: marketPage([{ ticker: "KXBTC15M-A", result: "yes" }]),
    },
  ]);
  const out = await listMarkets(client, "KXBTC15M", { status: "settled" });
  assert.equal(out.length, 1);
  assert.equal(out[0].ticker, "KXBTC15M-A");
});

test("listMarkets follows cursor pagination until empty", async () => {
  const client = mockClient([
    {
      match: "series_ticker=KXBTC15M",
      response: (url: string) => {
        if (url.includes("cursor=PAGE2")) return marketPage([{ ticker: "B", result: "no" }]);
        return marketPage([{ ticker: "A", result: "yes" }], "PAGE2");
      },
    },
  ]);
  const out = await listMarkets(client, "KXBTC15M", { limit: 1 });
  assert.equal(out.length, 2);
  assert.equal(out[0].ticker, "A");
  assert.equal(out[1].ticker, "B");
});

test("listMarkets stops at maxPages", async () => {
  // Always returns a non-empty cursor -> would loop forever without maxPages.
  const client = mockClient([
    {
      match: "series_ticker=KXBTC15M",
      response: marketPage([{ ticker: "A" }], "AGAIN"),
    },
  ]);
  const out = await listMarkets(client, "KXBTC15M", { limit: 1, maxPages: 3 });
  assert.equal(out.length, 3);
});

test("getOpenMarkets queries status=open", async () => {
  let seenUrl = "";
  const client = mockClient([
    {
      match: "series_ticker=KXBTC15M",
      response: (url: string) => {
        seenUrl = url;
        return marketPage([{ ticker: "OPEN-1" }]);
      },
    },
  ]);
  const out = await getOpenMarkets(client, "KXBTC15M");
  assert.equal(out.length, 1);
  assert.match(seenUrl, /status=open/);
});

test("getMarket returns the market object directly", async () => {
  // Some Kalshi versions return the market bare; others wrap in { market: ... }.
  const client = mockClient([
    {
      match: "markets/KXBTC15M-26SEP022115-15",
      response: { ticker: "KXBTC15M-26SEP022115-15", result: "", floor_strike: 77066.29 },
    },
  ]);
  const m = await getMarket(client, "KXBTC15M-26SEP022115-15");
  assert.ok(m);
  assert.equal(m?.ticker, "KXBTC15M-26SEP022115-15");
  assert.equal(m?.floor_strike, 77066.29);
});

test("getMarket unwraps { market: ... } when Kalshi wraps the response", async () => {
  const client = mockClient([
    {
      match: "markets/KXBTC15M-26SEP022115-15",
      response: { market: { ticker: "KXBTC15M-26SEP022115-15", result: "yes", expiration_value: "77389.73" } },
    },
  ]);
  const m = await getMarket(client, "KXBTC15M-26SEP022115-15");
  assert.ok(m);
  assert.equal(m?.ticker, "KXBTC15M-26SEP022115-15");
  assert.equal(m?.result, "yes");
});

test("getMarket returns null on 404", async () => {
  const client = mockClient([]); // no routes -> 404
  const m = await getMarket(client, "NOPE-123");
  assert.equal(m, null);
});

test("getSettledMarkets filters by since using close_time", async () => {
  const client = mockClient([
    {
      match: "series_ticker=KXBTC15M",
      response: marketPage([
        { ticker: "OLD", close_time: "2026-09-01T00:00:00Z", result: "yes" },
        { ticker: "NEW", close_time: "2026-09-02T12:00:00Z", result: "no" },
        { ticker: "MISSING_TIME", close_time: null, result: "yes" },
      ]),
    },
  ]);
  const out = await getSettledMarkets(client, "KXBTC15M", "2026-09-02T00:00:00Z");
  assert.equal(out.length, 1);
  assert.equal(out[0].ticker, "NEW");
});

test("getSettledMarkets returns all when since omitted", async () => {
  const client = mockClient([
    {
      match: "series_ticker=KXBTC15M",
      response: marketPage([
        { ticker: "A", close_time: "2026-09-01T00:00:00Z", result: "yes" },
        { ticker: "B", close_time: "2026-09-02T12:00:00Z", result: "no" },
      ]),
    },
  ]);
  const out = await getSettledMarkets(client, "KXBTC15M");
  assert.equal(out.length, 2);
});
