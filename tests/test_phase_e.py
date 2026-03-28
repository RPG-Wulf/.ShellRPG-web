from shellrpg_www.config import load_www_config
from shellrpg_www.gateway import artifact_root, resolve_frontend_asset


def test_default_config_points_to_private_local_server() -> None:
    config = load_www_config("config/definitely-missing.toml")
    assert config.backend_base_url == "http://127.0.0.1:8765"
    assert config.session_cookie_name == "shellrpg_session"


def test_frontend_root_resolves_public_index() -> None:
    root = artifact_root()
    assert resolve_frontend_asset(root, "/") == (root / "public" / "index.html").resolve()
