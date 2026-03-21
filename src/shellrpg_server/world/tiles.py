from dataclasses import dataclass, field
from typing import Mapping

@dataclass(frozen=True)
class TileProfile:
    tile_id: str
    biome_type: str
    terrain_type: str
    travel_difficulty: int
    visibility_profile: str
    hazard_profile: str
    cycle_modifiers: Mapping[str, str] = field(default_factory=dict)
