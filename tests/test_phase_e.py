from shellrpg_www.config import load_www_config
from shellrpg_www.gateway import artifact_root, resolve_frontend_asset


def test_default_config_points_to_private_local_server() -> None:
    config = load_www_config("config/definitely-missing.toml")
    assert config.backend_base_url == "http://127.0.0.1:8765"
    assert config.session_cookie_name == "shellrpg_session"


def test_frontend_root_resolves_public_index() -> None:
    root = artifact_root()
    assert resolve_frontend_asset(root, "/") == (root / "public" / "index.html").resolve()


def test_www_bundle_exposes_matrix_health_panel_contract() -> None:
    root = artifact_root()
    index_html = (root / "public" / "index.html").read_text(encoding="utf-8")
    app_js = (root / "src" / "app.js").read_text(encoding="utf-8")

    assert 'id="matrix-panel"' in index_html
    assert "/api/matrix/health" in app_js
    assert "function renderMatrixHealth" in app_js
    assert "character_conflicts" in app_js
    assert "Betroffene Charaktere" in app_js
    assert "function renderMatrixCharacterConflictCard" in app_js
    assert "Import-Hinweis" in app_js
