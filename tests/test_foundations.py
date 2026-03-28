from shellrpg_www.gateway import build_proxy_target
from shellrpg_www.version import RELEASE_VERSION, SERVICE_NAME


def test_www_release_version_matches_bundle() -> None:
    assert RELEASE_VERSION == "v0.7.6"
    assert SERVICE_NAME == "shellrpg-www"


def test_proxy_target_preserves_api_path_and_query() -> None:
    assert (
        build_proxy_target("http://127.0.0.1:8765", "/api/state?lang=de")
        == "http://127.0.0.1:8765/api/state?lang=de"
    )
