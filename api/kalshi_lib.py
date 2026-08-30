"""
Silverline Kalshi proxy core (CTO-02).

Pure, Vercel-free logic so it is unit-testable locally without a deploy.
The Vercel entrypoint (api/kalshi.py) and the local test harness both call
`handle(...)`.

Design / security posture
-------------------------
- GET-only, read-only. No request body is ever forwarded.
- Path allowlist (regex, exact shapes). Anything not matching is 403. This is an
  allowlist, not a blocklist: trading, portfolio, ws, auth, orders, positions,
  balances, etc. are all rejected because they don't match the allowed shapes.
- Token gate: `Authorization: Bearer <SILVERLINE_PROXY_TOKEN>`. This is
  LIGHTWEIGHT anti-abuse auth (as permitted by the Kalshi Developer Agreement),
  NOT a real secret — anyone who reads the deployed frontend source can see the
  token. It stops random bots from using Andrew's proxy as a free Kalshi API.
  Combined with CORS origin restriction + the read-only allowlist, the attack
  surface is bounded.
- CORS: only configured origins (default https://silverline.global) are
  allowed; Origin is reflected only if it matches the allowlist.
- Fails closed: if no token is configured, every GET is 403.

This proxies PUBLIC no-auth Kalshi endpoints. It does NOT handle Kalshi RSA
authenticated endpoints (trading) and never will.
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from typing import Dict, List, Tuple

KALSHI_BASE = "https://external-api.kalshi.com/trade-api/v2"

# Allowlist: only these exact path shapes are proxied.
ALLOWED_PATHS = [
    re.compile(r"^series/[^/]+$"),                       # series/{ticker}
    re.compile(r"^markets$"),                             # markets?series_ticker=...&status=...
    re.compile(r"^markets/[^/]+/(orderbook|candlesticks)$"),  # markets/{ticker}/{orderbook|candlesticks}
    re.compile(r"^historical/markets$"),                 # historical/markets?series_ticker=...&cursor=...
    re.compile(r"^historical/cutoff$"),                  # historical/cutoff
]

# Query params we forward per path (deny anything else to prevent param injection).
ALLOWED_QUERY: Dict[str, set] = {
    "series/": {"cursor"},
    "markets": {"series_ticker", "status", "cursor", "limit"},
    "markets/": {"cursor", "limit"},
    "historical/markets": {"series_ticker", "cursor", "limit"},
    "historical/cutoff": set(),
}

DEFAULT_ALLOWED_ORIGINS = [
    "https://silverline.global",
    "https://silverline-global.vercel.app",
]

JSON_HEADERS = [
    ("Content-Type", "application/json; charset=utf-8"),
    ("Cache-Control", "no-store"),
]


def _origin_ok(origin: str | None, allowed: List[str]) -> bool:
    if not origin:
        return True  # non-browser / same-server call; token gate still applies
    return origin in allowed


def _path_allowed(path: str) -> bool:
    return any(p.match(path) for p in ALLOWED_PATHS)


def _allowed_query_for(path: str) -> set:
    for prefix, params in ALLOWED_QUERY.items():
        if path.startswith(prefix):
            return params
    return set()


def _strip_query(params: Dict[str, str], allowed: set) -> Dict[str, str]:
    return {k: v for k, v in params.items() if k in allowed}


def handle(
    method: str,
    headers: Dict[str, str],
    query: Dict[str, str],
    token: str | None,
    allowed_origins: List[str] | None = None,
    fetch: "callable | None" = None,
) -> Tuple[int, List[Tuple[str, str]], bytes]:
    """
    Core handler. Returns (status, response_headers, body_bytes).

    `fetch` is injectable so tests don't hit the network. In production it is
    urllib-based (see _real_fetch).
    """
    allowed = allowed_origins or DEFAULT_ALLOWED_ORIGINS
    origin = headers.get("origin") or headers.get("Origin")

    # CORS preflight
    if method == "OPTIONS":
        resp_headers = [
            ("Access-Control-Allow-Methods", "GET, OPTIONS"),
            ("Access-Control-Allow-Headers", "Authorization, Content-Type"),
            ("Access-Control-Max-Age", "86400"),
        ]
        if _origin_ok(origin, allowed):
            resp_headers.append(("Access-Control-Allow-Origin", origin or "*"))
        return (204, resp_headers, b"")

    if method != "GET":
        body = json.dumps({"error": "method_not_allowed", "detail": "GET only"}).encode()
        return (405, JSON_HEADERS, body)

    # Token gate (fail closed if no token configured)
    auth = headers.get("authorization") or headers.get("Authorization") or ""
    expected = f"Bearer {token}" if token else None
    if not token or auth != expected:
        body = json.dumps({"error": "unauthorized"}).encode()
        resp = list(JSON_HEADERS)
        if _origin_ok(origin, allowed):
            resp.append(("Access-Control-Allow-Origin", origin or "*"))
        return (401, resp, body)

    # Origin gate: a browser Origin that is not allowlisted is rejected even with a
    # valid token (spec: only Andrew's browser is served). Absent Origin
    # (non-browser / ops / curl) is allowed — the token gate already covered it.
    if origin and not _origin_ok(origin, allowed):
        body = json.dumps({"error": "forbidden_origin",
                           "detail": "origin not allowed"}).encode()
        return (403, _cors(origin, allowed), body)

    # Resolve the requested Kalshi path
    path = (query.get("path") or "").strip("/")
    if not path:
        body = json.dumps({"error": "missing_param", "detail": "path required"}).encode()
        return (400, _cors(origin, allowed), body)

    if not _path_allowed(path):
        body = json.dumps({"error": "forbidden_path", "detail": "path not in allowlist"}).encode()
        return (403, _cors(origin, allowed), body)

    # Build the sanitized upstream URL
    upstream_query = _strip_query(query, _allowed_query_for(path))
    # `path` itself must not be forwarded as a Kalshi query param
    upstream_query.pop("path", None)
    qs = urllib.parse.urlencode(upstream_query) if upstream_query else ""
    url = f"{KALSHI_BASE}/{path}" + (f"?{qs}" if qs else "")

    fetcher = fetch or _real_fetch
    try:
        status, data = fetcher(url)
    except urllib.error.HTTPError as e:
        body = json.dumps({"error": "upstream_error", "status": e.code, "detail": e.reason}).encode()
        return (502, _cors(origin, allowed), body)
    except Exception as e:  # noqa: BLE001 - surface upstream failure, no secret leak
        body = json.dumps({"error": "upstream_unreachable", "detail": type(e).__name__}).encode()
        return (502, _cors(origin, allowed), body)

    resp_headers = [
        ("Content-Type", "application/json; charset=utf-8"),
        ("Cache-Control", "no-store"),
        ("X-Upstream-Url", url),
    ]
    resp_headers.extend(_cors_headers(origin, allowed))
    return (status, resp_headers, data)


def _cors(origin: str | None, allowed: List[str]) -> List[Tuple[str, str]]:
    h = list(JSON_HEADERS)
    h.extend(_cors_headers(origin, allowed))
    return h


def _cors_headers(origin: str | None, allowed: List[str]) -> List[Tuple[str, str]]:
    if _origin_ok(origin, allowed) and origin:
        return [("Access-Control-Allow-Origin", origin)]
    return []


def _real_fetch(url: str) -> Tuple[int, bytes]:
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "silverline-proxy/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.status, resp.read()


# late import to keep the module self-contained but not require urllib.parse at top
import urllib.parse  # noqa: E402
