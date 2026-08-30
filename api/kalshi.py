"""
Vercel serverless entrypoint for the Silverline Kalshi proxy.

Route: GET /api/kalshi?path=<kalshi_path>&<kalshi_query_params>...
       OPTIONS /api/kalshi  (CORS preflight)

Example:
  GET /api/kalshi?path=markets&series_ticker=KXBTC15M&status=open
  -> proxies https://external-api.kalshi.com/trade-api/v2/markets?series_ticker=KXBTC15M&status=open

Env vars (set in Vercel project settings; never commit real values):
  SILVERLINE_PROXY_TOKEN   shared-secret bearer token (anti-abuse; not a real secret)
  SILVERLINE_ALLOWED_ORIGINS  comma-separated allowed Origins (default: silverline.global + vercel preview)

This file is the Vercel Python runtime handler (BaseHTTPRequestHandler subclass).
The real logic lives in kalshi_lib.handle(...) so it can be unit-tested locally.
"""

from __future__ import annotations

import os
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Vercel imports this module as `api.kalshi`; local tests import it as `kalshi`.
# Try both so the entrypoint resolves in either context.
try:
    from kalshi_lib import handle
except ModuleNotFoundError:
    from api.kalshi_lib import handle


TOKEN = os.environ.get("SILVERLINE_PROXY_TOKEN")
_ORIGINS = os.environ.get("SILVERLINE_ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in _ORIGINS.split(",") if o.strip()] or None


class handler(BaseHTTPRequestHandler):
    def _send(self, status: int, headers, body: bytes) -> None:
        self.send_response(status)
        for k, v in headers:
            self.send_header(k, v)
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # CORS preflight
        status, headers, body = _dispatch("OPTIONS", self.headers, {})
        self._send(status, headers, body)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        # parse_qs returns lists; flatten to single values for our handler
        qsl = parse_qs(parsed.query, keep_blank_values=True)
        query = {k: (v[0] if v else "") for k, v in qsl.items()}
        status, headers, body = _dispatch("GET", self.headers, query)
        self._send(status, headers, body)

    def do_POST(self) -> None:  # explicitly blocked
        status, headers, body = _dispatch("POST", self.headers, {})
        self._send(status, headers, body)

    do_PUT = do_DELETE = do_PATCH = do_POST

    def log_message(self, *args, **kwargs):  # silence default logging
        pass


def _dispatch(method, headers_obj, query):
    # normalize header keys to lowercase
    headers = {k.lower(): v for k, v in headers_obj.items()}
    return handle(
        method=method,
        headers=headers,
        query=query,
        token=TOKEN,
        allowed_origins=ALLOWED_ORIGINS,
    )
