from dataclasses import dataclass
from enum import Enum

class TickDomain(str, Enum):
    WORLD = "world"
    COMBAT = "combat"
    MARKET = "market"
    REVIEW = "review"

@dataclass(frozen=True)
class TickStamp:
    value: int
    domain: TickDomain = TickDomain.WORLD
