// Low-level HTTP client for Kalshi's PUBLIC market-data API.
//
// No auth. No secrets. No trading. No orderbook.
// Read-only GETs against https://external-api.kalshi.com/trade-api/v2 only.
//
// Design goals:
//  - dependency-light: uses global `fetch` (Node 18+); a custom fetch can be
//    injected so tests run without any network at all.
//  - polite to the public API: 1 req/sec throttle by default, exponential
//    backoff + retry on 429/5xx/network errors.
//  - transparent: every public method returns parsed JSON; errors carry status.

import type {
  HttpResponse,
  FetchLike,
  KalshiClientOptions,
} from "./types-internal";

const DEFAULT_BASE_URL = "https://external-api.kalshi.com/trade-api/v2";
const DEFAULT_USER_AGENT = "silverline-kalshi-client/1.0 (+read-only public data)";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MIN_INTERVAL_MS = 1000; // ~1 req/sec throttle
const DEFAULT_TIMEOUT_MS = 30000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A normalized error with the HTTP status code attached, when known. */
export class KalshiHttpError extends Error {
  public readonly status: number | null;
  public readonly url: string;
  public readonly body: string;

  constructor(message: string, opts: { status?: number | null; url: string; body?: string }) {
    super(message);
    this.name = "KalshiHttpError";
    this.status = opts.status ?? null;
    this.url = opts.url;
    this.body = opts.body ?? "";
  }
}

/**
 * Read-only HTTP transport for Kalshi's public market-data API.
 *
 * This class only knows how to perform GET requests with throttling + retry.
 * Endpoint-specific helpers live in series.ts / markets.ts / candlesticks.ts /
 * resolve.ts and are all built on top of `client.get(path)`.
 */
export class KalshiClient {
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly maxRetries: number;
  private readonly minIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly fetchFn: FetchLike;

  // throttle bookkeeping
  private lastRequestTime = 0;
  private inFlight: Promise<unknown> | null = null;
  private readonly queue: Array<() => void> = [];

  constructor(options: KalshiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.minIntervalMs = options.minRequestIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.timeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetchFn ?? defaultFetch;
  }

  /** Absolute URL for a given path (path may start with "/" or not). */
  urlFor(path: string): string {
    const p = path.startsWith("/") ? path.slice(1) : path;
    return `${this.baseUrl}/${p}`;
  }

  /**
   * Perform a GET against `path` (relative to baseUrl) and return parsed JSON.
   * Throttles to <= 1 req / minIntervalMs, retries with exponential backoff on
   * 429 / 5xx / network errors.
   */
  async get<T = unknown>(path: string, query?: Record<string, string | number | undefined | null>): Promise<T> {
    const url = this.buildUrl(path, query);
    return this.requestJson<T>(url);
  }

  buildUrl(path: string, query?: Record<string, string | number | undefined | null>): string {
    const base = this.urlFor(path);
    if (!query) return base;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  /** Run `fn` under the global throttle so concurrent callers serialize politely. */
  private async throttled<T>(fn: () => Promise<T>): Promise<T> {
    // Simple per-client mutex + spacing. This keeps the public API polite even
    // when many promises are awaited at once.
    while (this.inFlight) {
      await this.inFlight.catch(() => {});
    }
    this.inFlight = (async () => {
      const elapsed = Date.now() - this.lastRequestTime;
      const wait = this.minIntervalMs - elapsed;
      if (wait > 0) await sleep(wait);
      this.lastRequestTime = Date.now();
    })();
    try {
      await this.inFlight;
    } finally {
      this.inFlight = null;
    }
    return fn();
  }

  private async requestJson<T>(url: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        // exponential backoff: 500ms, 1s, 2s, ...
        const backoff = 500 * Math.pow(2, attempt - 1);
        await sleep(backoff);
      }
      try {
        const res = await this.throttled(() =>
          this.fetchFn(url, {
            method: "GET",
            headers: { "User-Agent": this.userAgent, Accept: "application/json" },
            signal: abortSignal(this.timeoutMs),
          }),
        );
        if (res.status === 429 || res.status >= 500) {
          // retryable
          lastError = new KalshiHttpError(
            `retryable status ${res.status}`,
            { status: res.status, url, body: await safeText(res) },
          );
          continue;
        }
        if (!res.ok) {
          const body = await safeText(res);
          throw new KalshiHttpError(`HTTP ${res.status} for ${url}`, { status: res.status, url, body });
        }
        const text = await res.text();
        if (!text) return undefined as unknown as T;
        return JSON.parse(text) as T;
      } catch (err) {
        if (err instanceof KalshiHttpError && err.status !== null && (err.status === 429 || err.status >= 500)) {
          lastError = err;
          continue;
        }
        // Network / abort / JSON parse errors -> retryable unless it's a definitive parse failure.
        lastError = err;
        // Don't retry a non-retryable KalshiHttpError (4xx other than 429).
        if (err instanceof KalshiHttpError && err.status !== null) {
          throw err;
        }
        continue;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new KalshiHttpError("request failed after retries", { url });
  }
}

/** Default fetch implementation using the global `fetch` (Node 18+). */
const defaultFetch: FetchLike = async (url, init) => {
  const res = await fetch(url, init as RequestInit);
  return {
    ok: res.ok,
    status: res.status,
    headers: {
      get: (name: string) => res.headers.get(name),
    },
    text: () => res.text(),
    json: () => res.json(),
  } satisfies HttpResponse;
};

async function safeText(res: HttpResponse): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function abortSignal(timeoutMs: number): AbortSignal | undefined {
  if (typeof AbortController === "undefined") return undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Allow the signal to be GC-friendly.
  controller.signal.addEventListener("abort", () => clearTimeout(timer));
  return controller.signal;
}
