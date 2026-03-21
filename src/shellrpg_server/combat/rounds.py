from dataclasses import dataclass
from enum import Enum

class CombatPhase(str, Enum):
    REVEAL = "reveal"
    CHOICE_WINDOW = "choice_window"
    RESOLVE = "resolve"
    AFTERMATH = "aftermath"

@dataclass(frozen=True)
class CombatRoundState:
    encounter_id: str
    round_number: int
    phase: CombatPhase
