import { test } from "node:test";
import assert from "node:assert/strict";
import { KalshiClient, KalshiHttpError } from "../client";
import type { FetchLike, HttpResponse } from "../types-internal";
import { mockClient, mockFetch } from "./mock";

function jsonResponse(body: unknown, status = 200): HttpResponse {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => text,
    json: async () => body,
  };
}

test("get builds URL with query string and parses JSON", async () => {
  const client = mockClient([
    {
      match: "markets",
      response: { cursor: "", markets: [{ ticker: "KXBTC15M-1", result: "yes" }] },
    },
  ]);
  const res = await client.get("markets", { series_ticker: "KXBTC15M", status: "open", limit: 5 });
  assert.deepEqual(res, { cursor: "", markets: [{ ticker: "KXBTC15M-1", result: "yes" }] });
});

test("urlFor strips leading slash and appends to base", () => {
  const client = new KalshiClient({ baseUrl: "https://example.com/v2/" });
  assert.equal(client.urlFor("/foo/bar"), "https://example.com/v2/foo/bar");
  assert.equal(client.urlFor("foo/bar"), "https://example.com/v2/foo/bar");
});

test("omits undefined / null query params", () => {
  const client = new KalshiClient({ baseUrl: "https://example.com/v2" });
  const url = client.buildUrl("markets", { series_ticker: "KXBTC15M", status: undefined, cursor: null });
  assert.equal(url, "https://example.com/v2/markets?series_ticker=KXBTC15M");
});

test("throws KalshiHttpError with status on 4xx (non-429)", async () => {
  const client = mockClient([
    { match: "series", response: { error: "bad" }, status: 400 },
  ]);
  await assert.rejects(() => client.get("series/KXBTC15M"), (err: unknown) => {
    assert.ok(err instanceof KalshiHttpError);
    assert.equal(err.status, 400);
    assert.match(err.message, /HTTP 400/);
    return true;
  });
});

test("retries on 429 then succeeds", async () => {
  let calls = 0;
  const fetchFn: FetchLike = async () => {
    calls++;
    if (calls < 3) return jsonResponse({ error: "rate" }, 429);
    return jsonResponse({ series: { ticker: "KXBTC15M", frequency: "fifteen_min" } });
  };
  const client = new KalshiClient({
    fetchFn,
    minRequestIntervalMs: 0,
    maxRetries: 5,
    requestTimeoutMs: 1000,
  });
  const res = await client.get<{ series: { frequency: string } }>("series/KXBTC15M");
  assert.equal(res.series.frequency, "fifteen_min");
  assert.equal(calls, 3);
});

test("retries on 5xx then gives up and throws", async () => {
  let calls = 0;
  const fetchFn: FetchLike = async () => {
    calls++;
    return jsonResponse({ error: "boom" }, 503);
  };
  const client = new KalshiClient({
    fetchFn,
    minRequestIntervalMs: 0,
    maxRetries: 2,
    requestTimeoutMs: 1000,
  });
  await assert.rejects(() => client.get("series/KXBTC15M"), (err: unknown) => {
    assert.ok(err instanceof KalshiHttpError);
    assert.equal(err.status, 503);
    return true;
  });
  // 1 initial + 2 retries
  assert.equal(calls, 3);
});

test("throttles concurrent requests to >= minIntervalMs spacing", async () => {
  let calls: number[] = [];
  const fetchFn: FetchLike = async () => {
    calls.push(Date.now());
    return jsonResponse({ ok: true });
  };
  const client = new KalshiClient({
    fetchFn,
    minRequestIntervalMs: 50,
    maxRetries: 0,
    requestTimeoutMs: 1000,
  });
  await Promise.all([client.get("a"), client.get("b"), client.get("c")]);
  assert.equal(calls.length, 3);
  // each call spaced by >= ~50ms (allow scheduling jitter)
  for (let i = 1; i < calls.length; i++) {
    assert.ok(calls[i] - calls[i - 1] >= 45, `call ${i} not throttled: ${calls[i] - calls[i - 1]}ms`);
  }
});

test("404 on a missing route returns a 404 KalshiHttpError", async () => {
  const client = mockClient([]);
  await assert.rejects(() => client.get("markets/NOPE"), (err: unknown) => {
    assert.ok(err instanceof KalshiHttpError);
    assert.equal(err.status, 404);
    return true;
  });
});
