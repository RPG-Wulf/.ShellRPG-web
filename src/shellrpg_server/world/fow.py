from dataclasses import dataclass
from enum import Enum

class VisibilityState(str, Enum):
    VISIBLE = "visible"
    FRESH = "fresh"
    STALE = "stale"
    RUMOURED = "rumoured"
    UNKNOWN = "unknown"

@dataclass(frozen=True)
class TileKnowledge:
    tile_id: str
    visibility: VisibilityState
    last_confirmed_tick: int | None = None
