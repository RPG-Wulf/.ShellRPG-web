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
    assert "Hotspots" in app_js
    assert "Filter & Sortierung" in app_js
    assert "Kritischste Charaktere" in app_js
    assert "Kritisch zuerst" in app_js
    assert "Neueste zuerst" in app_js
    assert "Meiste Merges zuerst" in app_js
    assert "nur Konflikte mit Feld-Merges" in app_js
    assert "function renderMatrixCharacterConflictCard" in app_js
    assert "function renderMatrixFieldComparisonCard" in app_js
    assert "field_comparisons" in app_js
    assert "delta_summary" in app_js
    assert "priority_preview" in app_js
    assert "field_conflict_id" in app_js
    assert "conflict_id" in app_js
    assert "seen_count" in app_js
    assert "max_severity" in app_js
    assert "function normalizeMatrixHotspots" in app_js
    assert "function renderMatrixHealthControls" in app_js
    assert "function renderMatrixHotspots" in app_js
    assert "function matrixConflictSeverityLabel" in app_js
    assert "function renderMatrixConflictPriorityPill" in app_js
    assert "function renderMatrixConflictPriorityEntry" in app_js
    assert "reason_code" in app_js
    assert "function matrixConflictPriorityCategoryLabel" in app_js
    assert "Priorisiert" in app_js
    assert "Grund:" in app_js
    assert "Kurz-Diff gegen" in app_js
    assert "Neu erhalten" in app_js
    assert "Plus " in app_js
    assert "Upgrade " in app_js
    assert "Gemergter Stand" in app_js
    assert "Import-Hinweis" in app_js
    assert "Entwicklungsstufe:" in app_js
    assert "city_carrier_line" in app_js
    assert "Stadtfeldgrenzen:" in app_js
    assert "regional_scarcity_line" in app_js
    assert "regional_yield_line" in app_js
    assert "splitter_pressure_line" in app_js
    assert "trade_demand_line" in app_js
    assert "city_storage_line" in app_js
    assert "caravan_flow_line" in app_js
    assert "build_profile_line" in app_js
    assert "construction_capacity_line" in app_js
    assert "Baustellen" in app_js
    assert "special_resource_line" in app_js
    assert "Materialbasis:" in app_js
    assert "Rüstkammer:" in app_js
    assert "Schutz-/Besatzungslage:" in app_js
    assert "Dialoggrenze:" in app_js
    assert "economy_profile_line" in app_js
    assert "trade_cycle_line" in app_js
    assert "trade_focus_line" in app_js
    assert "market_pressure_line" in app_js
    assert "service_focus_line" in app_js
    assert "craft_focus_line" in app_js
    assert "Rollen-Craftables:" in app_js
    assert "market_adjustment_pct" in app_js
