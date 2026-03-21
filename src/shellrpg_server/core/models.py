
from __future__ import annotations

from dataclasses import dataclass, field
from time import monotonic

@dataclass
class BuffState:
    buff_type: str
    value: int
    expires_at_tick: int
    source: str

@dataclass
class OpenBookState:
    item_id: str
    page_index: int = 0

@dataclass
class ActionState:
    kind: str
    started_at: float
    last_progress_at: float
    status_key: str
    route: list[tuple[int, int]] = field(default_factory=list)
    target_coords: tuple[int, int] | None = None
    resource_type: str | None = None
    search_counter: int = 0
    found_target: str | None = None
    result_item_id: str | None = None
    travel_vector: tuple[int, int] | None = None

@dataclass
class EnemyState:
    enemy_id: str
    name_de: str
    name_en: str
    race: str
    faction: str
    level: int
    hp_current: int
    hp_max: int
    armor: int
    wisdom: int
    intelligence: int
    dexterity: int
    accuracy: int
    defense: int
    block: int
    dodge: int
    attack_kind: str
    damage_type: str
    power: int
    media_file: str
    resistance_profile: dict[str, int] = field(default_factory=dict)

@dataclass
class CombatState:
    source: str
    enemies: list[EnemyState]
    round_number: int
    awaiting_player: bool
    deadline_monotonic: float
    message_de: str
    message_en: str
    soultrap_rounds: int = 0
    soultrap_target_id: str | None = None
    last_action_log: list[str] = field(default_factory=list)
    auto_battle: bool = False
    auto_mode: str = "balanced"
    player_slot_advantage: int = 0

@dataclass
class QuestProgress:
    quest_id: str
    chain_id: str
    order: int
    title_de: str
    title_en: str
    description_de: str
    description_en: str
    objective_type: str
    target: str
    amount: int
    progress: int = 0
    status: str = "active"
    reward_silver: int = 0

@dataclass
class EquipmentState:
    weapon: str | None = None
    armor: str | None = None
    accessory: str | None = None
    offhand: str | None = None
    ammo: str | None = None

@dataclass
class CityBuildingState:
    building_id: str
    x: int
    y: int
    level: int = 1

@dataclass
class GeneralState:
    slot: int
    name: str
    doctrine: str = "balanced"

@dataclass
class CityState:
    city_name: str
    founded_x: int
    founded_y: int
    governor_name: str
    taxes_silver: int = 0
    population: int = 120
    research_points: int = 0
    buildings: list[CityBuildingState] = field(default_factory=list)
    generals: list[GeneralState] = field(default_factory=list)
    militia: dict[str, int] = field(default_factory=dict)

@dataclass
class PlayerState:
    character_name: str = "Ander"
    class_name: str = "Ritter"
    race_name: str = "Mensch"
    language: str = "de"
    level: int = 5
    hp_current: int = 104
    hp_max: int = 104
    mana_current: int = 52
    mana_max: int = 52
    x: int = 2048
    y: int = 2048
    active_action: str = "idle"
    tick_value: int = 1
    silver: int = 137
    gold: int = 2
    hunger: str = "gering"
    strength: int = 16
    dexterity: int = 13
    accuracy: int = 12
    defense: int = 11
    block: int = 9
    dodge: int = 8
    intelligence: int = 11
    wisdom: int = 12
    speed: int = 10
    loot_luck: int = 0
    base_resistance: int = 6
    enchanting_skill: int = 12
    discovered_tiles: set[tuple[int, int]] = field(default_factory=set)
    known_resource_tiles: dict[str, set[tuple[int, int]]] = field(default_factory=lambda: {"wood": set(), "iron": set(), "gems": set(), "gold": set()})
    points_of_interest: set[str] = field(default_factory=set)
    inventory: dict[str, int] = field(default_factory=dict)
    journal: list[str] = field(default_factory=list)
    buffs: list[BuffState] = field(default_factory=list)
    action_state: ActionState | None = None
    combat_state: CombatState | None = None
    equipment: EquipmentState = field(default_factory=EquipmentState)
    overlay_message_de: str = "Bereit für den Grenzweg."
    overlay_message_en: str = "Ready for the border road."
    current_media_file: str = "tile_graufurt-eastgate"
    open_book: OpenBookState | None = None
    action_lock_until: float = 0.0
    progress_flags: dict[str, int] = field(default_factory=dict)
    weapon_affixes: list[str] = field(default_factory=list)
    armor_affixes: list[str] = field(default_factory=list)
    accessory_affixes: list[str] = field(default_factory=list)
    dialogue_mode: bool = False
    dialogue_target: str | None = None
    cube_history: list[dict[str, str]] = field(default_factory=list)
    auto_battle_enabled: bool = False
    auto_battle_mode: str = "balanced"
    city: CityState | None = None
    faction: str = "Menschen"

    def now_locked(self) -> bool:
        return monotonic() < self.action_lock_until
