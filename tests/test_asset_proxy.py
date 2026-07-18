from pathlib import Path

from shellrpg_www.assets import (
    build_remote_asset_url,
    candidate_remote_bases,
    normalize_asset_path,
    resolve_local_asset,
)
from shellrpg_www.config import WWWConfig, load_www_config
from shellrpg_www.dynv6 import load_dynv6_config


def test_normalize_asset_path_rejects_traversal() -> None:
    assert normalize_asset_path("/asset/public/media/png/icon.png") == "public/media/png/icon.png"
    assert normalize_asset_path("/asset/../../private.txt") is None
    assert normalize_asset_path("/asset/src/app.js") is None


def test_candidate_remote_bases_include_local_extra_nodes(tmp_path: Path) -> None:
    extra = tmp_path / "asset-origins.toml"
    extra.write_text("[origins]\nadditional_base_urls = ['https://cdn-node-a.example/assets/www']\n", encoding="utf-8")
    config = WWWConfig(
        asset_primary_base_url="https://cdn.jsdelivr.net/gh/RPG-Wulf/ShellRPG-cdn@main/assets/www",
        asset_fallback_base_urls=("https://cdn-shellrpg.dns.army/assets/www",),
        asset_origin_candidates_path=str(extra),
    )
    assert candidate_remote_bases(config) == (
        "https://cdn.jsdelivr.net/gh/RPG-Wulf/ShellRPG-cdn@main/assets/www",
        "https://cdn-shellrpg.dns.army/assets/www",
        "https://cdn-node-a.example/assets/www",
    )


def test_resolve_local_asset_uses_workspace_fallbacks(tmp_path: Path) -> None:
    cdn_root = tmp_path / "ShellRPG-cdn" / "assets" / "www" / "public" / "media" / "png"
    cdn_root.mkdir(parents=True)
    asset = cdn_root / "map.png"
    asset.write_bytes(b"png")
    www_root = tmp_path / "ShellRPG-www"
    www_root.mkdir()
    resolved = resolve_local_asset(www_root, "public/media/png/map.png")
    assert resolved == asset.resolve()
    assert build_remote_asset_url("https://cdn-shellrpg.dns.army/assets/www", "public/media/png/map.png") == (
        "https://cdn-shellrpg.dns.army/assets/www/public/media/png/map.png"
    )


def test_dynv6_secret_loader_reads_local_ignored_file(tmp_path: Path) -> None:
    secret = tmp_path / "dynv6.toml"
    secret.write_text(
        "[dynv6]\n"
        "enabled = true\n"
        "zone = 'www-shellrpg.dns.army'\n"
        "token = 'redacted-token'\n",
        encoding="utf-8",
    )
    config = load_dynv6_config(str(secret))
    assert config is not None
    assert config.zone == "www-shellrpg.dns.army"


def test_load_www_config_resolves_paths_relative_to_config_file(tmp_path: Path) -> None:
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    config_path = config_dir / "shellrpg-www.toml"
    config_path.write_text(
        "[assets]\n"
        "asset_origin_candidates_path = './var/asset-origins.toml'\n",
        encoding="utf-8",
    )
    config = load_www_config(str(config_path))
    assert config.asset_origin_candidates_path == str((config_dir / "var" / "asset-origins.toml").resolve())
