from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
import tomllib
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_SECRET_PATH = "secrets/dynv6.toml"
DEFAULT_UPDATE_ENDPOINT = "https://ipv4.dynv6.com/api/update"
ENDPOINT_ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class DynV6Config:
    zone: str
    token: str
    endpoint: str = DEFAULT_UPDATE_ENDPOINT
    ipv4: str = "auto"
    ipv6: str = ""
    timeout_seconds: float = 5.0


def resolve_secret_path(path: str | None = None) -> Path:
    raw = path or os.getenv("SHELLRPG_DYNV6_SECRET", DEFAULT_SECRET_PATH)
    candidate = Path(raw)
    if not candidate.is_absolute():
        candidate = (ENDPOINT_ROOT / candidate).resolve()
    return candidate


def load_dynv6_config(path: str | None = None) -> DynV6Config | None:
    candidate = resolve_secret_path(path)
    if not candidate.exists():
        return None
    with candidate.open("rb") as fh:
        data = tomllib.load(fh)
    section = data.get("dynv6", data if isinstance(data, dict) else {})
    if not isinstance(section, dict) or not bool(section.get("enabled", True)):
        return None
    zone = str(section.get("zone", "")).strip()
    token = str(section.get("token", "")).strip()
    if not zone or not token:
        return None
    return DynV6Config(
        zone=zone,
        token=token,
        endpoint=str(section.get("endpoint", DEFAULT_UPDATE_ENDPOINT)).strip() or DEFAULT_UPDATE_ENDPOINT,
        ipv4=str(section.get("ipv4", "auto")).strip(),
        ipv6=str(section.get("ipv6", "")).strip(),
        timeout_seconds=float(section.get("timeout_seconds", 5.0)),
    )


def update_dynv6(config: DynV6Config) -> str:
    params = {"zone": config.zone, "token": config.token}
    if config.ipv4:
        params["ipv4"] = config.ipv4
    if config.ipv6:
        params["ipv6"] = config.ipv6
    target = config.endpoint.rstrip("/") + "?" + urlencode(params)
    request = Request(target, headers={"User-Agent": "ShellRPG-www-dynv6/0.8.0"})
    with urlopen(request, timeout=config.timeout_seconds) as response:
        body = response.read().decode("utf-8", errors="replace").strip()
    return body or "ok"


def update_dynv6_from_local_secret(path: str | None = None) -> str | None:
    config = load_dynv6_config(path)
    if config is None:
        return None
    return update_dynv6(config)
