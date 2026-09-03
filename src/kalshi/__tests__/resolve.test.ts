import { test } from "node:test";
import assert from "node:assert/strict";
import { getResolution, getResolutions, toResolution } from "../resolve";
import { mockClient } from "./mock";

test("toResolution maps result=yes to outcome=up", () => {
  const r = toResolution({
    ticker: "KXBTC15M-26SEP022115-15",
    result: "yes",
    floor_strike: 77066.29,
    expiration_value: "77389.73",
    occurrence_datetime: "2026-09-03T01:20:00Z",
    close_time: "2026-09-03T01:15:00Z",
  });
  assert.equal(r.resolved, true);
  assert.equal(r.outcome, "up");
  assert.equal(r.settlement_price, 77389.73);
  assert.equal(r.target_price, 77066.29);
  assert.equal(r.occurrence_time, "2026-09-03T01:20:00Z");
  assert.equal(r.close_time, "2026-09-03T01:15:00Z");
});

test("toResolution maps result=no to outcome=down", () => {
  const r = toResolution({
    ticker: "KXBTC15M-26SEP022100-00",
    result: "no",
    floor_strike: 77080.53,
    expiration_value: "77066.29",
    occurrence_datetime: "2026-09-03T01:05:00Z",
    close_time: "2026-09-03T01:00:00Z",
  });
  assert.equal(r.resolved, true);
  assert.equal(r.outcome, "down");
  assert.equal(r.settlement_price, 77066.29);
});

test("toResolution treats empty result as unresolved", () => {
  const r = toResolution({
    ticker: "KXBTC15M-26SEP022115-15",
    result: "",
    floor_strike: 77066.29,
    expiration_value: "",
  });
  assert.equal(r.resolved, false);
  assert.equal(r.outcome, null);
  assert.equal(r.settlement_price, null);
});

test("toResolution tolerates missing floor_strike", () => {
  const r = toResolution({ ticker: "X", result: "yes", expiration_value: "100" });
  assert.equal(r.target_price, null);
  assert.equal(r.settlement_price, 100);
});

test("getResolution returns full Resolution for a resolved market", async () => {
  const client = mockClient([
    {
      match: "markets/KXBTC15M-26SEP022100-00",
      response: {
        ticker: "KXBTC15M-26SEP022100-00",
        result: "no",
        floor_strike: 77080.53,
        expiration_value: "77066.29",
        occurrence_datetime: "2026-09-03T01:05:00Z",
        close_time: "2026-09-03T01:00:00Z",
      },
    },
  ]);
  const r = await getResolution(client, "KXBTC15M-26SEP022100-00");
  assert.ok(r);
  assert.equal(r?.resolved, true);
  assert.equal(r?.outcome, "down");
});

test("getResolution returns null when market 404s", async () => {
  const client = mockClient([]); // no routes -> 404
  const r = await getResolution(client, "NOPE");
  assert.equal(r, null);
});

test("getResolutions resolves a batch, preserving order", async () => {
  const client = mockClient([
    {
      match: "markets/",
      response: (url: string) => {
        const m = url.match(/markets\/(KXBTC15M-[A-Z0-9-]+)/);
        const ticker = m ? m[1] : "X";
        const result = ticker.includes("YES") ? "yes" : "no";
        return { ticker, result, floor_strike: 100, expiration_value: result === "yes" ? "110" : "90" };
      },
    },
  ]);
  const out = await getResolutions(client, ["KXBTC15M-YES-1", "KXBTC15M-NO-2"]);
  assert.equal(out.length, 2);
  assert.equal(out[0]?.outcome, "up");
  assert.equal(out[1]?.outcome, "down");
});
