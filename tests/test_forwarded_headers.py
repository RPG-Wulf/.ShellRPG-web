from shellrpg_www.gateway import build_session_cookie, forwarded_proto_from_headers


def test_forwarded_proto_accepts_https() -> None:
    assert forwarded_proto_from_headers({"X-Forwarded-Proto": "https"}) == "https"


def test_forwarded_proto_defaults_to_http() -> None:
    assert forwarded_proto_from_headers({"X-Forwarded-Proto": "other"}) == "http"
    assert forwarded_proto_from_headers({}) == "http"


def test_https_cookie_has_secure_flag() -> None:
    cookie = build_session_cookie("shellrpg_session", "test-token", secure=True)
    assert "Secure" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=Lax" in cookie
    assert "Domain=" not in cookie
