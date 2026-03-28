from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
import tomllib


@dataclass(frozen=True)
class WWWConfig:
    host: str = "127.0.0.1"
    port: int = 8080
    backend_base_url: str = "http://127.0.0.1:8765"
    request_timeout_seconds: float = 10.0
    session_cookie_name: str = "shellrpg_session"


def load_www_config(path: str | None = None) -> WWWConfig:
    candidate = Path(path or os.getenv("SHELLRPG_WWW_CONFIG", "config/shellrpg-www.toml"))
    data = {}
    if candidate.exists():
        with candidate.open("rb") as fh:
            data = tomllib.load(fh)
    www = data.get("www", {}) if isinstance(data, dict) else {}
    backend = data.get("backend", {}) if isinstance(data, dict) else {}
    session = data.get("session", {}) if isinstance(data, dict) else {}
    return WWWConfig(
        host=str(www.get("host", "127.0.0.1")),
        port=int(www.get("port", 8080)),
        backend_base_url=str(backend.get("base_url", os.getenv("SHELLRPG_SERVER_URL", "http://127.0.0.1:8765"))),
        request_timeout_seconds=float(backend.get("request_timeout_seconds", 10.0)),
        session_cookie_name=str(session.get("cookie_name", "shellrpg_session")),
    )
