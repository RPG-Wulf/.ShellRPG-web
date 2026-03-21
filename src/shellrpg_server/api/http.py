
from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from shellrpg_server.core.bootstrap import describe_foundation
from shellrpg_server.core.engine import GameEngine

ENGINE = GameEngine.create_demo()

class ShellRPGHandler(BaseHTTPRequestHandler):
    server_version = "ShellRPG/v0.4.0"

    def _write_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self._write_json({"ok": True})

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)
        lang = params.get("lang", [None])[0]
        if lang in {"de", "en"}:
            ENGINE.player.language = lang
        if path == "/health":
            self._write_json({"ok": True, "service": "shellrpg-server", "version": "v0.4.0"})
            return
        if path == "/api/bootstrap":
            self._write_json({"ok": True, "message": describe_foundation()})
            return
        if path == "/api/state":
            self._write_json(ENGINE.state_snapshot().to_dict())
            return
        self._write_json({"ok": False, "message": f"Unknown path: {path}"}, status=404)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/api/command":
            self._write_json({"ok": False, "message": f"Unknown path: {path}"}, status=404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        payload = json.loads(raw.decode("utf-8")) if raw else {}
        command = str(payload.get("command", ""))
        result = ENGINE.execute(command)
        self._write_json(result.to_dict())

    def log_message(self, format: str, *args) -> None:
        return

def run_server(host: str, port: int) -> None:
    print(describe_foundation())
    print(f"Serving authoritative Phase E slice on http://{host}:{port}")
    with ThreadingHTTPServer((host, port), ShellRPGHandler) as httpd:
        httpd.serve_forever()
