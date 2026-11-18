#!/usr/bin/env python3
"""Xenia-compatible bridge for the Decaid E64 plugin.

The E64's `CmXeniaDriver` calls `http://<host>/api/v2/*` on TCP port 80 with no
path prefix. A Decaid plugin serves under `/api/v1/plugins/<id>/<endpoint>`, so
this small host-side sidecar forwards the four Xenia routes:

    GET  /api/v2/mako             -> plugin xenia-mako
    GET  /api/v2/machine          -> plugin xenia-machine
    POST /api/v2/brewratio        -> plugin xenia-brewratio
    POST /api/v2/scripts/execute  -> plugin xenia-scripts-execute

It does not start a brew and does not touch the E64. The plugin's
`xenia-scripts-execute` endpoint only acknowledges the E64 request.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

GET_ROUTES = {
    "/api/v2/mako": "xenia-mako",
    "/api/v2/machine": "xenia-machine",
}
POST_ROUTES = {
    "/api/v2/brewratio": "xenia-brewratio",
    "/api/v2/scripts/execute": "xenia-scripts-execute",
}
MAX_BODY = 64 * 1024


def target_url(base: str, plugin_id: str, endpoint: str, query: str = "") -> str:
    url = f"{base.rstrip('/')}/api/v1/plugins/{urllib.parse.quote(plugin_id, safe='')}/{endpoint}"
    if query:
        url += "?" + query
    return url


def forward(method: str, url: str, body: bytes | None,
            timeout: float) -> tuple[int, bytes, str]:
    request = urllib.request.Request(
        url, data=body, method=method,
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read(), response.headers.get_content_type()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(), exc.headers.get_content_type()
    except Exception as exc:  # noqa: BLE001 - return a bridge error
        return 502, json.dumps({"error": f"bridge: {type(exc).__name__}: {exc}"}).encode(), "application/json"


class Handler(BaseHTTPRequestHandler):
    server_version = "DecaidXeniaBridge/0.1"

    def _config(self) -> tuple[str, str, float]:
        return self.server.decaid, self.server.plugin_id, self.server.timeout  # type: ignore[attr-defined]

    def _respond(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _proxy(self, method: str, endpoint: str, body: bytes | None = None) -> None:
        base, plugin_id, timeout = self._config()
        query = urllib.parse.urlsplit(self.path).query
        url = target_url(base, plugin_id, endpoint, query)
        status, payload, content_type = forward(method, url, body, timeout)
        self._respond(status, payload, content_type)

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        path = urllib.parse.urlsplit(self.path).path
        if path == "/health":
            self._respond(200, b'{"ok":true}', "application/json")
            return
        endpoint = GET_ROUTES.get(path)
        if endpoint is None:
            self._respond(404, b'{"error":"unknown Xenia route"}', "application/json")
            return
        self._proxy("GET", endpoint)

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        path = urllib.parse.urlsplit(self.path).path
        endpoint = POST_ROUTES.get(path)
        if endpoint is None:
            self._respond(404, b'{"error":"unknown Xenia route"}', "application/json")
            return
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length < 0 or length > MAX_BODY:
            self._respond(413, b'{"error":"body too large"}', "application/json")
            return
        body = self.rfile.read(length) if length else b""
        if body:
            try:
                json.loads(body)
            except ValueError:
                self._respond(400, b'{"error":"invalid JSON"}', "application/json")
                return
        self._proxy("POST", endpoint, body)

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s %s\n" % (self.log_date_time_string(), fmt % args))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--decaid", default="http://127.0.0.1:8080")
    parser.add_argument("--plugin-id", default="mahlkoenig-e64.reaplugin")
    parser.add_argument("--bind", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=80)
    parser.add_argument("--timeout", type=float, default=10.0)
    args = parser.parse_args(argv)
    if args.port < 1024 and hasattr(os, "geteuid") and os.geteuid() != 0:
        print(f"warning: port {args.port} needs root; use sudo or a container",
              file=sys.stderr)
    if args.bind not in ("127.0.0.1", "::1", "localhost"):
        print("warning: the Xenia routes have no authentication; "
              "keep the bridge on an isolated LAN", file=sys.stderr)
    server = ThreadingHTTPServer((args.bind, args.port), Handler)
    server.decaid = args.decaid  # type: ignore[attr-defined]
    server.plugin_id = args.plugin_id  # type: ignore[attr-defined]
    server.timeout = args.timeout  # type: ignore[attr-defined]
    print(f"Xenia bridge on http://{args.bind}:{args.port} -> {args.decaid} "
          f"({args.plugin_id})", file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        return 130
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
