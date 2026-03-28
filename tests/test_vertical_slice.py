from shellrpg_www.gateway import (
    artifact_root,
    build_session_cookie,
    resolve_frontend_asset,
    session_token_from_cookie,
)


def test_session_cookie_roundtrip() -> None:
    cookie = build_session_cookie("shellrpg_session", "token-123")
    assert session_token_from_cookie(cookie, "shellrpg_session") == "token-123"


def test_python_sources_are_not_served_as_frontend_assets() -> None:
    root = artifact_root()
    assert resolve_frontend_asset(root, "/src/shellrpg_server/api/http.py") is None
    assert resolve_frontend_asset(root, "/src/app.js") == (root / "src" / "app.js").resolve()
