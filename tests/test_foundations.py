
from shellrpg_server.core.bootstrap import describe_foundation
from shellrpg_server.game_data import GEM_COMBINATIONS_BASE, WORLD

def test_foundation_description_contains_phase_e_version() -> None:
    assert "v0.4.0" in describe_foundation()

def test_gem_combinations_include_phase_d_and_e_entries() -> None:
    assert GEM_COMBINATIONS_BASE["bernstein"] == "storm"
    assert GEM_COMBINATIONS_BASE["opal"] == "illusion"
    assert GEM_COMBINATIONS_BASE["obsidian"] == "shadow"

def test_world_size_is_4096_chunked() -> None:
    assert WORLD["width"] == 4096
    assert WORLD["height"] == 4096
