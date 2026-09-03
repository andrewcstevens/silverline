// Test helper: build a KalshiClient backed by an in-memory mock transport so
// tests never touch the network. Routes are matched by substring on the path.

import { KalshiClient } from "../client";
import type { HttpResponse, FetchLike } from "../types-internal";

export interface MockRoute {
  /** Matched as a substring against the full request URL (path + query). */
  match: string;
  /** Return either a fixed JSON body, or a function of the URL. */
  response: unknown | ((url: string) => unknown);
  status?: number;
}

export function mockFetch(routes: MockRoute[]): FetchLike {
  return async (url: string): Promise<HttpResponse> => {
    for (const route of routes) {
      if (url.includes(route.match)) {
        const body = typeof route.response === "function" ? route.response(url) : route.response;
        const status = route.status ?? 200;
        const text = JSON.stringify(body);
        return {
          ok: status >= 200 && status < 300,
          status,
          headers: { get: () => null },
          text: async () => text,
          json: async () => body,
        };
      }
    }
    return {
      ok: false,
      status: 404,
      headers: { get: () => null },
      text: async () => JSON.stringify({ error: { code: "not_found", message: "not found" } }),
      json: async () => ({ error: { code: "not_found", message: "not found" } }),
    };
  };
}

/** A KalshiClient that uses zero throttle/retry latency for fast tests. */
export function mockClient(routes: MockRoute[]): KalshiClient {
  return new KalshiClient({
    fetchFn: mockFetch(routes),
    minRequestIntervalMs: 0,
    requestTimeoutMs: 1000,
    maxRetries: 0,
  });
}

/** Capture the request URLs seen by a mock fetch, in order. */
export function recordingFetch(routes: MockRoute[]): { fetchFn: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const inner = mockFetch(routes);
  const fetchFn: FetchLike = async (url, init) => {
    calls.push(url);
    return inner(url, init);
  };
  return { fetchFn, calls };
}
