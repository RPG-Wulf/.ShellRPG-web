from shellrpg_www.config import WWWConfig
from shellrpg_www.gateway import build_public_site_config, canonical_cdn_media_url


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
