from dataclasses import dataclass
from enum import Enum

class RiddleStatus(str, Enum):
    STAGE = "stage"
    REVIEW = "review"
    LIVE = "live"
    REJECTED = "rejected"
    ARCHIVED = "archived"

@dataclass(frozen=True)
class RiddleRecord:
    riddle_id: str
    topic: str
    question_text: str
    choice_a: str
    choice_b: str
    choice_c: str
    choice_d: str
    correct_choice: str
    language_key: str
    status: RiddleStatus = RiddleStatus.STAGE
