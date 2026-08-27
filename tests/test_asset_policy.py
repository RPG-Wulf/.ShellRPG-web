from shellrpg_www.assets import normalize_asset_path


def test_asset_proxy_accepts_only_image_resources() -> None:
    for path in ("icon.png", "scene.jpg", "scene.jpeg", "anim.gif", "tile.webp", "mark.svg", "favicon.ico"):
        assert normalize_asset_path("/asset/public/media/" + path) == "public/media/" + path
    for path in ("theme.css", "bundle.js", "manifest.json", "readme.txt"):
        assert normalize_asset_path("/asset/public/media/" + path) is None
