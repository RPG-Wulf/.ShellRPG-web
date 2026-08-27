from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
import tomllib


ENDPOINT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG_PATH = ENDPOINT_ROOT / "config" / "shellrpg-www.toml"


def _tuple(value) -> tuple[str, ...]:
    if value is None:
        return ()
    if isinstance(value, (list, tuple)):
        return tuple(str(v) for v in value)
    return (str(value),)


def _resolve_config_path(path: str | None = None) -> Path:
    raw = path or os.getenv("SHELLRPG_WWW_CONFIG", str(DEFAULT_CONFIG_PATH))
    candidate = Path(raw)
    if not candidate.is_absolute():
        candidate = (ENDPOINT_ROOT / candidate).resolve()
    return candidate


def _resolve_path(base_dir: Path, value: str | None) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    candidate = Path(raw)
    if not candidate.is_absolute():
        candidate = (base_dir / candidate).resolve()
    return str(candidate)


@dataclass(frozen=True)
class WWWConfig:
    host: str = "127.0.0.1"
    port: int = 8080
    backend_base_url: str = "http://127.0.0.1:8765"
    request_timeout_seconds: float = 10.0
    session_cookie_name: str = "shellrpg_session"
    wiki_base_url: str = "https://wiki.shellrpg.tld"
    asset_proxy_route: str = "/asset"
    asset_primary_base_url: str = "https://cdn.jsdelivr.net/gh/RPG-Wulf/ShellRPG-cdn@main/assets/www"
    asset_fallback_base_urls: tuple[str, ...] = ("https://cdn-shellrpg.dns.army/assets/www",)
    asset_origin_candidates_path: str = "./var/asset-origins.toml"
    asset_request_timeout_seconds: float = 1.2


def load_www_config(path: str | None = None) -> WWWConfig:
    candidate = _resolve_config_path(path)
    data = {}
    if candidate.exists():
        with candidate.open("rb") as fh:
            data = tomllib.load(fh)
    config_dir = candidate.parent
    www = data.get("www", {}) if isinstance(data, dict) else {}
    backend = data.get("backend", {}) if isinstance(data, dict) else {}
    session = data.get("session", {}) if isinstance(data, dict) else {}
    integration = data.get("integration", {}) if isinstance(data, dict) else {}
    assets = data.get("assets", {}) if isinstance(data, dict) else {}
    return WWWConfig(
        host=str(www.get("host", "127.0.0.1")),
        port=int(www.get("port", 8080)),
        backend_base_url=str(backend.get("base_url", os.getenv("SHELLRPG_SERVER_URL", "http://127.0.0.1:8765"))),
        request_timeout_seconds=float(backend.get("request_timeout_seconds", 10.0)),
        session_cookie_name=str(session.get("cookie_name", "shellrpg_session")),
        wiki_base_url=str(integration.get("wiki_base_url", "https://wiki.shellrpg.tld")),
        asset_proxy_route=str(assets.get("asset_proxy_route", "/asset")),
        asset_primary_base_url=str(assets.get("asset_primary_base_url", "https://cdn.jsdelivr.net/gh/RPG-Wulf/ShellRPG-cdn@main/assets/www")),
        asset_fallback_base_urls=_tuple(assets.get("asset_fallback_base_urls", ["https://cdn-shellrpg.dns.army/assets/www"])),
        asset_origin_candidates_path=_resolve_path(config_dir, assets.get("asset_origin_candidates_path", "./var/asset-origins.toml")),
        asset_request_timeout_seconds=float(assets.get("asset_request_timeout_seconds", 1.2)),
    )
