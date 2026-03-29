from __future__ import annotations

from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
from pathlib import Path, PurePosixPath
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from shellrpg_www.assets import load_asset_payload
from shellrpg_www.config import WWWConfig
from shellrpg_www.version import HTTP_SERVER_VERSION, RELEASE_VERSION, SERVICE_NAME


SAFE_FRONTEND_SUFFIXES = {
    ".css",
    ".gif",
    ".html",
    ".ico",
    ".jpeg",
    ".jpg",
    ".js",
    ".json",
    ".png",
    ".svg",
    ".webp",
}

CONTENT_TYPE_OVERRIDES = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
}


def artifact_root() -> Path:
    return Path(__file__).resolve().parents[2]


def build_proxy_target(base_url: str, request_path: str) -> str:
    return base_url.rstrip("/") + "/" + request_path.lstrip("/")


def build_session_cookie(cookie_name: str, token: str) -> str:
    cookie = SimpleCookie()
    cookie[cookie_name] = token
    morsel = cookie[cookie_name]
    morsel["path"] = "/"
    morsel["httponly"] = True
    morsel["samesite"] = "Lax"
    return morsel.OutputString()


def session_token_from_cookie(cookie_header: str, cookie_name: str) -> str | None:
    if not cookie_header:
        return None
    cookie = SimpleCookie()
    cookie.load(cookie_header)
    morsel = cookie.get(cookie_name)
    return morsel.value if morsel else None


def resolve_frontend_asset(root: Path, request_path: str) -> Path | None:
    path = urlsplit(request_path).path
    if path in {"", "/", "/index.html", "/public", "/public/", "/public/index.html"}:
        return (root / "public" / "index.html").resolve()
    mappings = {
        "/public/": root / "public",
        "/src/": root / "src",
    }
    for prefix, base_dir in mappings.items():
        if not path.startswith(prefix):
            continue
        relative = path[len(prefix):]
        if not relative:
            return None
        pure_path = PurePosixPath(relative)
        if pure_path.is_absolute() or ".." in pure_path.parts:
            return None
        target = (base_dir / Path(*pure_path.parts)).resolve()
        try:
            target.relative_to(base_dir.resolve())
        except ValueError:
            return None
        if not target.is_file():
            return None
        if target.suffix.lower() not in SAFE_FRONTEND_SUFFIXES:
            return None
        return target
    return None


def guess_content_type(path: Path) -> str:
    override = CONTENT_TYPE_OVERRIDES.get(path.suffix.lower())
    if override:
        return override
    guessed, _ = mimetypes.guess_type(str(path))
    return guessed or "application/octet-stream"


def make_handler(config: WWWConfig, root: Path) -> type[BaseHTTPRequestHandler]:
    class ShellRPGWWWHandler(BaseHTTPRequestHandler):
        server_version = HTTP_SERVER_VERSION

        def _write_bytes(
            self,
            body: bytes,
            content_type: str,
            status: int = 200,
            extra_headers: dict[str, str] | None = None,
        ) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            if extra_headers:
                for key, value in extra_headers.items():
                    self.send_header(key, value)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def _write_json(
            self,
            payload: dict,
            status: int = 200,
            extra_headers: dict[str, str] | None = None,
        ) -> None:
            headers = {"Cache-Control": "no-store"}
            if extra_headers:
                headers.update(extra_headers)
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self._write_bytes(body, "application/json; charset=utf-8", status=status, extra_headers=headers)

        def _read_body(self) -> bytes:
            length = int(self.headers.get("Content-Length", "0"))
            return self.rfile.read(length) if length else b""

        # Erkennt denselben Live-Event-Stream wie der Browser-Client und leitet ihn ungepuffert weiter.
        def _is_event_stream_request(self) -> bool:
            return urlsplit(self.path).path == "/api/events" or "text/event-stream" in (self.headers.get("Accept", "") or "")

        def _serve_frontend(self) -> None:
            asset = resolve_frontend_asset(root, self.path)
            if asset is None:
                self._write_json({"ok": False, "message": f"Unknown path: {urlsplit(self.path).path}"}, status=404)
                return
            self._write_bytes(asset.read_bytes(), guess_content_type(asset), extra_headers={"Cache-Control": "no-store"})

        def _serve_cdn_asset(self) -> bool:
            asset = load_asset_payload(config, root, self.path)
            if asset is None:
                return False
            self._write_bytes(asset.body, asset.content_type, extra_headers={"Cache-Control": "public, max-age=60"})
            return True

        def _proxy_request(self) -> None:
            body = self._read_body() if self.command in {"POST", "PUT", "PATCH"} else b""
            headers: dict[str, str] = {}
            if accept := self.headers.get("Accept"):
                headers["Accept"] = accept
            if content_type := self.headers.get("Content-Type"):
                headers["Content-Type"] = content_type
            if forwarded_for := self.client_address[0]:
                headers["X-Forwarded-For"] = forwarded_for
            if forwarded_host := self.headers.get("Host"):
                headers["X-Forwarded-Host"] = forwarded_host
            headers["X-Forwarded-Proto"] = "http"
            session_token = self.headers.get("X-Session-Token") or session_token_from_cookie(
                self.headers.get("Cookie", ""),
                config.session_cookie_name,
            )
            if session_token:
                headers["X-Session-Token"] = session_token
            request = Request(
                build_proxy_target(config.backend_base_url, self.path),
                data=body or None,
                headers=headers,
                method=self.command,
            )
            if self._is_event_stream_request():
                self._proxy_event_stream(request)
                return
            try:
                with urlopen(request, timeout=config.request_timeout_seconds) as response:
                    status = response.status
                    raw_body = response.read()
                    response_headers = response.headers
            except HTTPError as exc:
                status = exc.code
                raw_body = exc.read()
                response_headers = exc.headers
            except URLError as exc:
                self._write_json(
                    {
                        "ok": False,
                        "message": f"ShellRPG-server unter {config.backend_base_url} nicht erreichbar.",
                        "detail": str(exc.reason),
                    },
                    status=502,
                )
                return

            content_type = response_headers.get("Content-Type", "application/json; charset=utf-8")
            extra_headers = {"Cache-Control": "no-store"}
            if raw_body and "application/json" in content_type:
                try:
                    payload = json.loads(raw_body.decode("utf-8"))
                except json.JSONDecodeError:
                    payload = None
                if isinstance(payload, dict) and payload.get("session_token"):
                    extra_headers["Set-Cookie"] = build_session_cookie(
                        config.session_cookie_name,
                        str(payload["session_token"]),
                    )
                    raw_body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                    content_type = "application/json; charset=utf-8"
            self._write_bytes(raw_body, content_type, status=status, extra_headers=extra_headers)

        # Leitet SSE-Bytes direkt weiter, damit der WWW-Gateway Live-Updates same-origin an den Browser reicht.
        def _proxy_event_stream(self, request: Request) -> None:
            try:
                upstream = urlopen(request, timeout=config.request_timeout_seconds)
            except HTTPError as exc:
                raw_body = exc.read()
                self._write_bytes(
                    raw_body,
                    exc.headers.get("Content-Type", "application/json; charset=utf-8"),
                    status=exc.code,
                    extra_headers={"Cache-Control": "no-store"},
                )
                return
            except URLError as exc:
                self._write_json(
                    {
                        "ok": False,
                        "message": f"ShellRPG-server unter {config.backend_base_url} nicht erreichbar.",
                        "detail": str(exc.reason),
                    },
                    status=502,
                )
                return

            with upstream:
                content_type = upstream.headers.get("Content-Type", "text/event-stream; charset=utf-8")
                if "text/event-stream" not in content_type:
                    raw_body = upstream.read()
                    self._write_bytes(raw_body, content_type, status=upstream.status, extra_headers={"Cache-Control": "no-store"})
                    return
                self.send_response(upstream.status)
                self.send_header("Content-Type", content_type)
                self.send_header("Cache-Control", "no-store")
                self.send_header("Connection", "keep-alive")
                self.send_header("X-Accel-Buffering", "no")
                self.end_headers()
                try:
                    while True:
                        chunk = upstream.read(1024)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError, OSError):
                    return

        def _handle_health(self) -> None:
            self._write_json(
                {
                    "ok": True,
                    "service": SERVICE_NAME,
                    "version": RELEASE_VERSION,
                    "backend_base_url": config.backend_base_url,
                }
            )

        def _dispatch_readonly(self) -> None:
            path = urlsplit(self.path).path
            if path == "/health":
                self._handle_health()
                return
            if path.startswith(config.asset_proxy_route.rstrip("/") + "/"):
                if self._serve_cdn_asset():
                    return
                self._write_json({"ok": False, "message": f"Unknown asset path: {path}"}, status=404)
                return
            if path.startswith("/api/"):
                self._proxy_request()
                return
            self._serve_frontend()

        def do_GET(self) -> None:
            self._dispatch_readonly()

        def do_HEAD(self) -> None:
            self._dispatch_readonly()

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self.send_header("Allow", "GET, HEAD, POST, OPTIONS")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_POST(self) -> None:
            path = urlsplit(self.path).path
            if not path.startswith("/api/"):
                self._write_json({"ok": False, "message": f"Unknown path: {path}"}, status=404)
                return
            self._proxy_request()

        def log_message(self, format: str, *args) -> None:
            return

    return ShellRPGWWWHandler


def run_gateway(config: WWWConfig) -> None:
    root = artifact_root()
    print(f"{SERVICE_NAME} {RELEASE_VERSION} auf http://{config.host}:{config.port}")
    print(f"Proxy-Ziel: {config.backend_base_url}")
    handler = make_handler(config, root)
    with ThreadingHTTPServer((config.host, config.port), handler) as httpd:
        httpd.serve_forever()
