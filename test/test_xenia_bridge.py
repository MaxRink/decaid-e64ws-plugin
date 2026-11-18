"""Tests for the Xenia sidecar path mapping and forwarding."""
from __future__ import annotations

import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from tools.xenia_bridge import forward, target_url


class _FakeDecaid(BaseHTTPRequestHandler):
    seen: list[dict] = []

    def do_GET(self) -> None:  # noqa: N802
        self.seen.append({"method": "GET", "path": self.path, "body": ""})
        payload = json.dumps({"MA_STATUS": 1, "path": self.path}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length).decode()
        self.seen.append({"method": "POST", "path": self.path, "body": body})
        payload = b'{"ok":true}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *_args) -> None:
        pass


class XeniaBridgeTests(unittest.TestCase):
    def setUp(self) -> None:
        _FakeDecaid.seen = []
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), _FakeDecaid)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def test_target_url_keeps_query(self) -> None:
        self.assertEqual(
            target_url("http://127.0.0.1:8080/", "mahlkoenig-e64.reaplugin",
                       "xenia-mako", "a=1"),
            "http://127.0.0.1:8080/api/v1/plugins/mahlkoenig-e64.reaplugin/xenia-mako?a=1",
        )

    def test_get_forward(self) -> None:
        status, body, _ = forward("GET", target_url(self.base, "id", "xenia-mako"), None, 5)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["MA_STATUS"], 1)
        self.assertEqual(_FakeDecaid.seen[-1]["path"],
                         "/api/v1/plugins/id/xenia-mako")

    def test_post_forward(self) -> None:
        status, body, _ = forward(
            "POST", target_url(self.base, "id", "xenia-scripts-execute"),
            b'{"ID":9}', 5)
        self.assertEqual(status, 200)
        self.assertEqual(_FakeDecaid.seen[-1]["path"],
                         "/api/v1/plugins/id/xenia-scripts-execute")
        self.assertEqual(_FakeDecaid.seen[-1]["body"], '{"ID":9}')

    def test_unreachable_decaid_returns_502(self) -> None:
        status, body, _ = forward("GET", "http://127.0.0.1:1/api/v1/plugins/id/x",
                                  None, 1)
        self.assertEqual(status, 502)
        self.assertIn("bridge", json.loads(body)["error"])


if __name__ == "__main__":
    unittest.main()
