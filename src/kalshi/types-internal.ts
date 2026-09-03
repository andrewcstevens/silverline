// Internal types for the HTTP transport layer. Not re-exported from the public
// barrel — consumers only need these if they're injecting a custom fetch
// (primarily for tests).

export interface HttpResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text: () => Promise<string>;
  json: () => Promise<unknown>;
}

export type FetchLike = (
  url: string,
  init?: Record<string, unknown>,
) => Promise<HttpResponse>;

export interface KalshiClientOptions {
  /** Override the API base URL (default: https://external-api.kalshi.com/trade-api/v2). */
  baseUrl?: string;
  /** Max retries on 429/5xx/network errors (default 3). */
  maxRetries?: number;
  /** Minimum spacing between requests, in ms (default 1000). */
  minRequestIntervalMs?: number;
  /** Per-request timeout, in ms (default 30000). */
  requestTimeoutMs?: number;
  /** User-Agent header (default identifies this client). */
  userAgent?: string;
  /** Inject a custom fetch (used by tests to avoid the network). */
  fetchFn?: FetchLike;
}
