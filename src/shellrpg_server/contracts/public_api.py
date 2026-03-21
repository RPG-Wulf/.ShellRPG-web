
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal

VisibilityState = Literal["visible", "fresh", "stale", "rumoured", "unknown"]

@dataclass(frozen=True)
class PublicCharacterStatus:
    character_name: str
    class_name: str
    race_name: str
    level: int
    hp_current: int
    hp_max: int
    mana_current: int
    mana_max: int
    location_label: str
    coords_label: str
    active_action: str
    tick_value: int
    silver: int
    gold: int
    hunger: str
    overlay_message: str
    media_file: str
    media_terminal_file: str
    language: str
    reaction_seconds_left: int = 0
    combat_choices: list[str] = field(default_factory=list)
    faction_tension: str = ""
    dialogue_mode: bool = False
    dialogue_target: str = ""
    auto_battle_enabled: bool = False
    auto_battle_mode: str = "balanced"

@dataclass(frozen=True)
class PublicTileKnowledge:
    tile_id: str
    label: str
    coords_label: str
    visibility_state: VisibilityState
    biome: str = ""
    terrain: str = ""
    is_current: bool = False
    poi_known: list[str] = field(default_factory=list)
    known_resources: list[str] = field(default_factory=list)
    building: str = ""
    sprite: str = ""

@dataclass(frozen=True)
class PublicMarketEntry:
    item_name: str
    category: str
    price_display: str
    trend: str
    item_id: str = ""
    sprite: str = ""

@dataclass(frozen=True)
class PublicInventoryEntry:
    item_id: str
    item_name: str
    quantity: int
    category: str
    quality: str
    slot: str | None
    description: str
    affixes: list[str] = field(default_factory=list)
    sprite: str = ""

@dataclass(frozen=True)
class PublicEquipmentEntry:
    slot: str
    item_name: str
    quality: str
    affixes: list[str] = field(default_factory=list)
    sprite: str = ""

@dataclass(frozen=True)
class PublicQuestEntry:
    title: str
    description: str
    progress_text: str
    status: str

@dataclass(frozen=True)
class PublicBuffEntry:
    buff_name: str
    value: int
    remaining_ticks: int
    source: str
    sprite: str = ""

@dataclass(frozen=True)
class PublicCombatEntry:
    enemy_name: str
    hp_current: int
    hp_max: int
    faction: str
    damage_type: str
    sprite: str

@dataclass(frozen=True)
class PublicCityEntry:
    city_name: str
    governor_name: str
    taxes_silver: int
    population: int
    research_points: int
    building_lines: list[str] = field(default_factory=list)
    militia_lines: list[str] = field(default_factory=list)
    general_lines: list[str] = field(default_factory=list)

@dataclass(frozen=True)
class PublicCommandResult:
    ok: bool
    message: str
    status: PublicCharacterStatus
    map_tiles: list[PublicTileKnowledge] = field(default_factory=list)
    inventory: list[PublicInventoryEntry] = field(default_factory=list)
    equipment: list[PublicEquipmentEntry] = field(default_factory=list)
    market: list[PublicMarketEntry] = field(default_factory=list)
    journal: list[str] = field(default_factory=list)
    commands: list[str] = field(default_factory=list)
    quests: list[PublicQuestEntry] = field(default_factory=list)
    buffs: list[PublicBuffEntry] = field(default_factory=list)
    stream_chunks: list[str] = field(default_factory=list)
    combat: list[PublicCombatEntry] = field(default_factory=list)
    city: PublicCityEntry | None = None

    def to_dict(self) -> dict:
        return asdict(self)
