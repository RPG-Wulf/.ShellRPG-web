from shellrpg_www.config import WWWConfig
from shellrpg_www.gateway import build_health_payload, build_public_site_config, canonical_cdn_media_url


def test_public_site_config_exposes_only_public_integration_urls() -> None:
    config = WWWConfig(
        wiki_base_url="https://wiki.shellrpg.tld",
        asset_primary_base_url="https://cdn.example.test/assets/www",
    )
    assert build_public_site_config(config) == {
        "wiki_base_url": "https://wiki.shellrpg.tld",
        "cdn_image_base_url": "https://cdn.example.test/assets/www",
    }


def test_legacy_www_media_path_redirects_to_canonical_cdn_image() -> None:
    config = WWWConfig(asset_primary_base_url="https://cdn.example.test/assets/www")
    assert canonical_cdn_media_url(config, "/public/media/png/icon.png") == (
        "https://cdn.example.test/assets/www/public/media/png/icon.png"
    )
    assert canonical_cdn_media_url(config, "/public/media/app.js") is None
    assert canonical_cdn_media_url(config, "/src/app.js") is None


def test_health_payload_does_not_publish_private_backend_address() -> None:
    payload = build_health_payload(WWWConfig(backend_base_url="http://127.0.0.1:8765"))
    assert payload["ok"] is True
    assert "backend_base_url" not in payload
    assert "127.0.0.1" not in str(payload)
