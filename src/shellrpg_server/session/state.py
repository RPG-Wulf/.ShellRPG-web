from dataclasses import dataclass
from enum import Enum

class SessionState(str, Enum):
    ONLINE = "online"
    RECONNECTING = "reconnecting"
    TRAVELLING = "travelling"
    IN_COMBAT = "in_combat"
    IN_EVENT = "in_event"
    INCAPACITATED = "incapacitated"

@dataclass
class CharacterActionState:
    action_name: str
    started_at_tick: int
    expected_end_tick: int
    interruptible: bool = True
