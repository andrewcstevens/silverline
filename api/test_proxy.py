"""
Local test harness for the Silverline Kalshi proxy (CTO-02).

No Vercel deploy, no network. Validates: token gate, CORS origin allowlist,
path allowlist (read-only, trading endpoints blocked), query-param stripping,
GET-only enforcement, OPTIONS preflight, and a mocked upstream happy path.

Run:  python3 -m pytest api/test_proxy.py -q
  or: python3 api/test_proxy.py        (self-contained, no pytest)
"""

from __future__ import annotations

import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
from kalshi_lib import handle  # noqa: E402

TOKEN = "test-token-abc"
ALLOWED = ["https://silverline.global", "https://silverline-global.vercel.app"]


def _hdr(origin=None, auth=None):
    h = {}
    if origin:
        h["origin"] = origin
    if auth:
        h["authorization"] = auth
    return h


def _fake_fetch_factory(status=200, data=b'{"ok": true}', captured=None):
    def _fetch(url):
        if captured is not None:
            captured.append(url)
        return status, data
    return _fetch


class TokenGate(unittest.TestCase):
    def test_missing_token_401(self):
        s, _, b = handle("GET", _hdr(origin="https://silverline.global"),
                        {"path": "markets"}, token=None)
        self.assertEqual(s, 401)
        self.assertEqual(json.loads(b)["error"], "unauthorized")

    def test_wrong_token_401(self):
        s, _, b = handle("GET", _hdr(origin="https://silverline.global", auth="Bearer wrong"),
                        {"path": "markets"}, token=TOKEN)
        self.assertEqual(s, 401)

    def test_correct_token_passes_gate(self):
        s, _, _ = handle("GET", _hdr(origin="https://silverline.global", auth=f"Bearer {TOKEN}"),
                        {"path": "markets"}, token=TOKEN,
                        fetch=_fake_fetch_factory())
        self.assertEqual(s, 200)

    def test_unauthorized_origin_403(self):
        # token correct but browser origin not allowlisted -> rejected
        s, _, b = handle("GET", _hdr(origin="https://evil.example", auth=f"Bearer {TOKEN}"),
                         {"path": "markets"}, token=TOKEN,
                         fetch=_fake_fetch_factory())
        self.assertEqual(s, 403)
        self.assertEqual(json.loads(b)["error"], "forbidden_origin")

    def test_no_origin_allowed_for_ops(self):
        # curl / non-browser has no Origin header; token gate still applies
        s, _, _ = handle("GET", _hdr(auth=f"Bearer {TOKEN}"),
                        {"path": "markets"}, token=TOKEN,
                        fetch=_fake_fetch_factory())
        self.assertEqual(s, 200)


class CORS(unittest.TestCase):
    def test_options_preflight_allowed_origin(self):
        s, h, b = handle("OPTIONS", _hdr(origin="https://silverline.global"), {}, token=TOKEN)
        self.assertEqual(s, 204)
        hdrs = dict(h)
        self.assertEqual(hdrs.get("Access-Control-Allow-Origin"), "https://silverline.global")
        self.assertEqual(hdrs.get("Access-Control-Allow-Methods"), "GET, OPTIONS")

    def test_options_preflight_blocked_origin(self):
        s, h, _ = handle("OPTIONS", _hdr(origin="https://evil.example"), {}, token=TOKEN)
        self.assertEqual(s, 204)
        self.assertNotIn("Access-Control-Allow-Origin", dict(h))

    def test_get_reflects_allowed_origin(self):
        s, h, _ = handle("GET", _hdr(origin="https://silverline.global", auth=f"Bearer {TOKEN}"),
                        {"path": "historical/cutoff"}, token=TOKEN,
                        fetch=_fake_fetch_factory())
        self.assertEqual(s, 200)
        self.assertEqual(dict(h).get("Access-Control-Allow-Origin"), "https://silverline.global")


class PathAllowlist(unittest.TestCase):
    def _get(self, path):
        return handle("GET", _hdr(origin="https://silverline.global", auth=f"Bearer {TOKEN}"),
                      {"path": path}, token=TOKEN, fetch=_fake_fetch_factory())

    def test_allowed_paths(self):
        for p in ["series/KXBTC15M", "markets", "historical/markets", "historical/cutoff"]:
            s, _, _ = self._get(p)
            self.assertEqual(s, 200, f"{p} should be allowed")

    def test_allowed_market_subpaths(self):
        for p in ["markets/KXBTC15M-20260830T1600/orderbook", "markets/KXBTC15M-20260830T1600/candlesticks"]:
            s, _, _ = self._get(p)
            self.assertEqual(s, 200, f"{p} should be allowed")

    def test_trading_endpoint_blocked(self):
        for p in ["trades", "portfolio/orders", "portfolio/positions", "auth/login", "portfolio/balances"]:
            s, _, b = self._get(p)
            self.assertEqual(s, 403, f"{p} must be blocked")
            self.assertEqual(json.loads(b)["error"], "forbidden_path")

    def test_unknown_market_subpath_blocked(self):
        # markets/{ticker}/trades is not in allowlist
        s, _, _ = self._get("markets/KXBTC15M-20260830T1600/trades")
        self.assertEqual(s, 403)

    def test_missing_path_400(self):
        s, _, b = handle("GET", _hdr(origin="https://silverline.global", auth=f"Bearer {TOKEN}"),
                        {}, token=TOKEN, fetch=_fake_fetch_factory())
        self.assertEqual(s, 400)
        self.assertEqual(json.loads(b)["error"], "missing_param")


class MethodEnforcement(unittest.TestCase):
    def test_post_blocked(self):
        s, _, b = handle("POST", _hdr(origin="https://silverline.global", auth=f"Bearer {TOKEN}"),
                        {"path": "markets"}, token=TOKEN, fetch=_fake_fetch_factory())
        self.assertEqual(s, 405)
        self.assertEqual(json.loads(b)["error"], "method_not_allowed")

    def test_put_blocked(self):
        s, _, _ = handle("PUT", _hdr(origin="https://silverline.global", auth=f"Bearer {TOKEN}"),
                        {"path": "markets"}, token=TOKEN, fetch=_fake_fetch_factory())
        self.assertEqual(s, 405)


class QueryStripping(unittest.TestCase):
    def test_forbidden_query_dropped(self):
        captured = []
        s, _, _ = handle("GET", _hdr(origin="https://silverline.global", auth=f"Bearer {TOKEN}"),
                        {"path": "markets", "series_ticker": "KXBTC15M", "status": "open",
                         "evil": "inject", "path": "markets"},
                        token=TOKEN, fetch=_fake_fetch_factory(captured=captured))
        self.assertEqual(s, 200)
        self.assertEqual(len(captured), 1)
        url = captured[0]
        self.assertIn("series_ticker=KXBTC15M", url)
        self.assertIn("status=open", url)
        self.assertNotIn("evil", url)          # stripped
        self.assertNotIn("path=markets", url)  # path not forwarded as query
        self.assertTrue(url.startswith(
            "https://external-api.kalshi.com/trade-api/v2/markets?"))


class UpstreamHappyPath(unittest.TestCase):
    def test_proxies_and_returns_data(self):
        payload = b'{"markets": [{"ticker": "KXBTC15M-1"}]}'
        s, h, b = handle("GET", _hdr(origin="https://silverline.global", auth=f"Bearer {TOKEN}"),
                        {"path": "markets", "series_ticker": "KXBTC15M", "status": "open"},
                        token=TOKEN, fetch=_fake_fetch_factory(data=payload))
        self.assertEqual(s, 200)
        self.assertEqual(b, payload)
        self.assertEqual(dict(h).get("X-Upstream-Url"),
                         "https://external-api.kalshi.com/trade-api/v2/markets?series_ticker=KXBTC15M&status=open")


if __name__ == "__main__":
    unittest.main(verbosity=2)
