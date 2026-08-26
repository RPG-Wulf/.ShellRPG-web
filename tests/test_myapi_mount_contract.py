from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from shellrpg_www.gateway import build_proxy_target


IDLEQUEST_EXACT_ROUTES = {
    "/api/health",
    "/api/state",
    "/api/world",
    "/api/command",
}


def test_mount_descriptor_is_root_relative_www_fallback() -> None:
    mount = json.loads((ROOT / "config" / "myapi-mount.json").read_text(encoding="utf-8"))
    assert mount["version"] == 1
    assert mount["project_id"] == "shellrpg-www"
    assert mount["repository"] == "RPG-Wulf/.ShellRPG-web"
    assert mount["public_prefix"] == "/idle-quest/"
    assert mount["internal_base_path"] == "/"
    assert mount["strip_prefix_at_ingress"] is True
    assert mount["route_ownership"]["mode"] == "fallback_except"
    assert set(mount["route_ownership"]["excluded_routes"]) == IDLEQUEST_EXACT_ROUTES


def test_www_gateway_already_consumes_root_relative_paths() -> None:
    assert build_proxy_target("http://127.0.0.1:8765", "/api/matrix/health") == (
        "http://127.0.0.1:8765/api/matrix/health"
    )
