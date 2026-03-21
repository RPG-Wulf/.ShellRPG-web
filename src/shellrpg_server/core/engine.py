
from __future__ import annotations

import math
import random
from collections import deque
from dataclasses import dataclass
from time import monotonic
from typing import Iterable

from shellrpg_server.ai.cube_proxy import call_cube_agent
from shellrpg_server.contracts.public_api import (
    PublicBuffEntry,
    PublicCharacterStatus,
    PublicCityEntry,
    PublicCombatEntry,
    PublicCommandResult,
    PublicEquipmentEntry,
    PublicInventoryEntry,
    PublicMarketEntry,
    PublicQuestEntry,
    PublicTileKnowledge,
)
from shellrpg_server.core.models import (
    ActionState,
    BuffState,
    CityBuildingState,
    CityState,
    CombatState,
    EnemyState,
    EquipmentState,
    GeneralState,
    PlayerState,
)
from shellrpg_server.game_data import (
    BIOME_TERRAIN,
    BIOME_WEIGHTS,
    BUILDINGS,
    DIR_VECTORS,
    DIRECTION_ALIASES,
    ELEMENT_MATRIX,
    GEM_COMBINATIONS_BASE,
    ITEMS,
    MERCHANT_STOCK,
    MONSTER_CLASSES,
    MONEY_GOLD_FACTOR,
    QUALITY_ORDER,
    RACE_SOUL_DAMAGE,
    RECIPES,
    RESOURCE_BY_BIOME,
    ROUTES,
    SPECIAL_DAMAGE_HINTS,
    SPECIAL_TILES,
    STARTING_COMMANDS,
    TRAVEL_ENCOUNTERS,
    UNITS,
    WORLD,
)

PROGRESS_INTERVAL = 1.0
REACTION_WINDOW_SECONDS = 8
MAP_RADIUS = 4

MSG = {
    "de": {
        "commands_loaded": "Sichtbare Befehle geladen.",
        "unknown_command": "Unbekannter Befehl: {command}",
        "empty_command": "Kein Befehl übergeben.",
        "status_refreshed": "Status aktualisiert.",
        "lang_set": "Sprache auf Deutsch gestellt.",
        "lang_set_en": "Language switched to English.",
        "look": "{desc}",
        "inspect": "{tile}: {terrain} in {biome}. Nachbarn: {neighbors}. {tension}",
        "walk_usage": "Nutze: walk north|south|west|east|x,y oder walk route <ziel>",
        "route_unknown": "Unbekannte Route: {route}",
        "no_path": "Dort führt von hier kein gangbarer Pfad hin.",
        "walk_success": "Reise abgeschlossen: {tile} erreicht.",
        "inventory_refreshed": "Inventar aktualisiert.",
        "equipment_refreshed": "Ausrüstung aktualisiert.",
        "market_refreshed": "Händlerliste geladen.",
        "journal_refreshed": "Journal aktualisiert.",
        "map_refreshed": "Kartensicht aktualisiert.",
        "buffs_refreshed": "Buffs aktualisiert.",
        "quests_refreshed": "Questlog aktualisiert.",
        "hunt_dispatched": "Dein Ritter wurde ausgeschickt zur Jagd ... {tile} [{coords}] {spinner}",
        "hunt_travel": "Dein Ritter jagt ... {tile} [{coords}] {spinner}",
        "hunt_found": "Dein Ritter jagt gerade {monster} {prep} {tile} [{coords}]",
        "hunt_success": "Dein Ritter jagte {monster} und bekam {drop} ... {tile} [{coords}]",
        "gather_dispatched": "Dein Ritter wurde ausgeschickt um Rohstoffe zu sammeln ... {tile} [{coords}] {spinner}",
        "gather_travel": "Dein Ritter sammelt {resource} ... {tile} [{coords}] {spinner}",
        "gather_success": "Dein Ritter sammelte {resource} und fand {drop} ... {tile} [{coords}]",
        "explore_dispatched": "Dein Ritter bricht auf, um verdeckte Regionen zu erkunden ... {tile} [{coords}] {spinner}",
        "explore_progress": "Dein Ritter erkundet ... {tile} [{coords}] {spinner}",
        "explore_success": "Dein Ritter deckte {tile} [{coords}] auf und vermerkte neue Punkte von Interesse.",
        "equipped": "{item} ausgerüstet.",
        "equip_missing": "Dieser Gegenstand ist nicht im Inventar.",
        "equip_fail": "Dieser Gegenstand kann nicht ausgerüstet werden.",
        "used": "{item} verwendet.",
        "not_usable": "Dieser Gegenstand kann nicht direkt verwendet werden.",
        "book_missing": "Dieses Buch liegt nicht im Inventar.",
        "book_none": "Kein Buch ist geöffnet.",
        "read_page": "{title}\n{page}",
        "combat_begin": "Reaktionsfenster geöffnet: {enemy} stellt sich {prep} {tile}.",
        "combat_only": "Das geht nur im Kampf.",
        "auto_guard": "Keine Eingabe rechtzeitig. Dein Ritter geht automatisch in Deckung.",
        "auto_battle_set": "Auto-Battle {state} ({mode}).",
        "combat_win": "Sieg über {enemy}. {drop}",
        "combat_loss": "Du brichst verletzt aus dem Kampf und wirst nach Graufurt zurückgedrängt.",
        "soultrap_applied": "Seelenfalle trifft {enemy} für 3 Runden.",
        "soulstone_charged": "Seelenfalle lädt {stone} nach dem Tod des Ziels auf.",
        "crafted": "{recipe} hergestellt.",
        "crafted_fail": "Für {recipe} fehlen Materialien.",
        "socketed": "{gem} in {slot} gesockelt.",
        "enchanted": "{slot} verzaubert: {affix}.",
        "soulforged": "Seelenstein schmiedet {slot}: {affix}.",
        "merchant_list": "Händlerliste geladen.",
        "bought": "{item} gekauft für {price}.",
        "sold": "{item} verkauft für {price}.",
        "cube_enter": "Der schwarze Kubus richtet seine Kanten auf dich. Ab jetzt gilt jede Zeile als Frage an ihn, bis du /leave schreibst.",
        "cube_leave": "Du trittst aus dem Schatten des Kubus zurück.",
        "cube_far": "Der Kubus ist nicht in Reichweite.",
        "city_founded": "Stadt {name} gegründet. Gouverneur {governor} steht nun in deinem Dienst.",
        "city_exists": "Du verwaltest bereits {name}.",
        "governor_set": "Gouverneur {name} eingesetzt.",
        "general_set": "Generalsslot {slot} mit {name} besetzt.",
        "building_built": "{building} errichtet auf Tile [{coords}].",
        "building_fail": "Baukosten oder Forschungskosten fehlen für {building}.",
        "militia_recruited": "{amount} {unit} rekrutiert.",
        "militia_status": "Milizstand aktualisiert.",
        "faction_tension": "Fraktionsspannung: {text}",
        "encounter_log": "Reise-Encounter: {name} — {desc}",
    },
    "en": {
        "commands_loaded": "Visible commands loaded.",
        "unknown_command": "Unknown command: {command}",
        "empty_command": "No command provided.",
        "status_refreshed": "Status refreshed.",
        "lang_set": "Sprache auf Deutsch gestellt.",
        "lang_set_en": "Language switched to English.",
        "look": "{desc}",
        "inspect": "{tile}: {terrain} in {biome}. Neighbours: {neighbors}. {tension}",
        "walk_usage": "Use: walk north|south|west|east|x,y or walk route <target>",
        "route_unknown": "Unknown route: {route}",
        "no_path": "No viable path leads there from here.",
        "walk_success": "Travel complete: reached {tile}.",
        "inventory_refreshed": "Inventory refreshed.",
        "equipment_refreshed": "Equipment refreshed.",
        "market_refreshed": "Merchant list refreshed.",
        "journal_refreshed": "Journal refreshed.",
        "map_refreshed": "Map refreshed.",
        "buffs_refreshed": "Buffs refreshed.",
        "quests_refreshed": "Quest log refreshed.",
        "hunt_dispatched": "Your Knight went out for hunting ... {tile} [{coords}] {spinner}",
        "hunt_travel": "Your Knight is hunting ... {tile} [{coords}] {spinner}",
        "hunt_found": "Your Knight is hunting {monster} {prep} {tile} [{coords}]",
        "hunt_success": "Your Knight hunted {monster} and got {drop} ... {tile} [{coords}]",
        "gather_dispatched": "Your Knight went out for gathering Resources... {tile} [{coords}] {spinner}",
        "gather_travel": "Your Knight is gathering {resource} ... {tile} [{coords}] {spinner}",
        "gather_success": "Your Knight gathered {resource} and found {drop} ... {tile} [{coords}]",
        "explore_dispatched": "Your Knight marches out to uncover hidden regions ... {tile} [{coords}] {spinner}",
        "explore_progress": "Your Knight is exploring ... {tile} [{coords}] {spinner}",
        "explore_success": "Your Knight uncovered {tile} [{coords}] and marked new points of interest.",
        "equipped": "Equipped {item}.",
        "equip_missing": "That item is not in the inventory.",
        "equip_fail": "That item cannot be equipped.",
        "used": "Used {item}.",
        "not_usable": "That item cannot be used directly.",
        "book_missing": "That book is not in the inventory.",
        "book_none": "No book is open.",
        "read_page": "{title}\n{page}",
        "combat_begin": "Reaction window open: {enemy} stands {prep} {tile}.",
        "combat_only": "That only works in combat.",
        "auto_guard": "No command arrived in time. Your Knight automatically braces.",
        "auto_battle_set": "Auto battle {state} ({mode}).",
        "combat_win": "Victory over {enemy}. {drop}",
        "combat_loss": "You break from the fight, wounded, and are pushed back to Graufurt.",
        "soultrap_applied": "Soul trap hits {enemy} for 3 rounds.",
        "soulstone_charged": "Soul trap charges {stone} after the target dies.",
        "crafted": "Crafted {recipe}.",
        "crafted_fail": "Missing materials for {recipe}.",
        "socketed": "Socketed {gem} into {slot}.",
        "enchanted": "Enchanted {slot}: {affix}.",
        "soulforged": "Soul forged {slot}: {affix}.",
        "merchant_list": "Merchant list refreshed.",
        "bought": "Bought {item} for {price}.",
        "sold": "Sold {item} for {price}.",
        "cube_enter": "The black cube turns its edges toward you. Every line now counts as a question to it until you type /leave.",
        "cube_leave": "You step back from the cube's shadow.",
        "cube_far": "The cube is not within reach.",
        "city_founded": "Founded city {name}. Governor {governor} now serves you.",
        "city_exists": "You already govern {name}.",
        "governor_set": "Appointed governor {name}.",
        "general_set": "Filled general slot {slot} with {name}.",
        "building_built": "Constructed {building} on tile [{coords}].",
        "building_fail": "Missing build or research costs for {building}.",
        "militia_recruited": "Recruited {amount} {unit}.",
        "militia_status": "Militia status refreshed.",
        "faction_tension": "Faction tension: {text}",
        "encounter_log": "Travel encounter: {name} — {desc}",
    },
}

def canon_item_name(raw: str) -> str:
    return raw.strip().lower().replace("-", " ").replace("_", " ")

@dataclass
class GameEngine:
    player: PlayerState

    @classmethod
    def create_demo(cls) -> "GameEngine":
        player = PlayerState()
        player.inventory = {
            "iron_sword": 1, "chain_hauberk": 1, "pilgrim_charm": 1, "buckler": 1,
            "healing_draught": 2, "lucky_tonic": 1, "war_oil": 1, "quickstep_tonic": 1, "ward_salt": 1,
            "chronicle_graufurt": 1, "strength_manual": 1, "fireball_scroll": 1, "lightning_orb_scroll": 1,
            "lightning_strike_scroll": 1, "fire_wall_scroll": 1, "fire_beam_scroll": 1,
            "silver_coin": 137, "gold_coin": 2, "diamond_shard": 1, "onyx_shard": 1, "sapphire_shard": 1,
            "ruby_shard": 1, "smaragd_shard": 1, "calcedon_shard": 1, "bergkristall_shard": 1, "zirkon_shard": 1,
            "bernstein_shard": 1, "opal_shard": 1, "obsidian_shard": 1, "iron_ore": 10, "wood_bundle": 10, "leather_strip": 4,
            "steel_ingot": 4, "soulstone_lesser": 1,
        }
        player.equipment = EquipmentState(weapon="iron_sword", armor="chain_hauberk", accessory="pilgrim_charm", offhand="buckler")
        player.journal = [
            "Graufurt hält die Straße offen, Valmora den Wald, und Aschenwall fordert härtere Zölle.",
            "Gerüchte sprechen von einem schwebenden schwarzen Kubus jenseits der bekannten Pfade.",
        ]
        engine = cls(player=player)
        engine._bootstrap_world()
        return engine

    def _bootstrap_world(self) -> None:
        for coord in [(self.player.x, self.player.y), (2049, 2048), (2048, 2049), (2051, 2048), (2052, 2049)]:
            self.player.discovered_tiles.add(coord)
            self._refresh_tile_knowledge(coord)

    def _msg(self, key: str, **kwargs: object) -> str:
        template = MSG[self.player.language].get(key, key)
        return template.format(**kwargs)

    def _lang(self, de: str, en: str) -> str:
        return de if self.player.language == "de" else en

    def _spinner(self) -> str:
        frames = ["● ○ ○ ○ ○", "● ● ○ ○ ○", "● ● ● ○ ○", "● ● ● ● ○", "● ● ● ● ●"]
        return frames[self.player.tick_value % len(frames)]

    def _coord_label(self, coord: tuple[int, int]) -> str:
        return f"{coord[0]},{coord[1]}"

    def _current_coord(self) -> tuple[int, int]:
        return (self.player.x, self.player.y)

    def _in_bounds(self, coord: tuple[int, int]) -> bool:
        x, y = coord
        return 0 <= x < WORLD["width"] and 0 <= y < WORLD["height"]

    def _hash(self, x: int, y: int) -> int:
        return ((x * 73856093) ^ (y * 19349663) ^ 0x9E3779B9) & 0xFFFFFFFF

    def _tile_seed(self, coord: tuple[int, int]) -> dict:
        if coord in SPECIAL_TILES:
            raw = SPECIAL_TILES[coord]
            return {
                "x": coord[0], "y": coord[1], "label": {"de": raw["de"], "en": raw["en"]}, "biome": raw["biome"],
                "terrain": raw["terrain"], "description": {"de": f"{raw['de']} liegt {raw['terrain'].lower()} im Biom {raw['biome']}.", "en": f"{raw['en']} rests as a {raw['terrain'].lower()} in {raw['biome']}."},
                "city": raw.get("city"), "resources": raw.get("resources", ()), "poi": raw.get("poi", ()),
                "faction_tension": None, "media_base": raw["media_base"], "building": "",
            }
        x, y = coord
        h = self._hash(x // WORLD["chunk_size"], y // WORLD["chunk_size"])
        total = sum(weight for _, weight in BIOME_WEIGHTS)
        roll = h % total
        acc = 0
        biome = BIOME_WEIGHTS[0][0]
        for name, weight in BIOME_WEIGHTS:
            acc += weight
            if roll < acc:
                biome = name
                break
        terrain = BIOME_TERRAIN[biome]
        media_base = "tile_" + biome.lower().replace(" ", "-").replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
        desc = self._lang(f"Ein {terrain.lower()} im Biom {biome}.", f"A {terrain.lower()} in the {biome} biome.")
        return {
            "x": x, "y": y, "label": {"de": f"{biome} [{x},{y}]", "en": f"{biome} [{x},{y}]"}, "biome": biome,
            "terrain": terrain, "description": {"de": desc if self.player.language=="de" else f"Ein {terrain.lower()} im Biom {biome}.", "en": desc if self.player.language=="en" else f"A {terrain.lower()} in the {biome} biome."},
            "city": None, "resources": RESOURCE_BY_BIOME.get(biome, ()), "poi": (), "faction_tension": None, "media_base": media_base, "building": "",
        }

    def _neighbors(self, coord: tuple[int, int]) -> dict[str, tuple[int, int]]:
        out = {}
        for key, (dx, dy) in DIR_VECTORS.items():
            nxt = (coord[0] + dx, coord[1] + dy)
            if self._in_bounds(nxt):
                out[key] = nxt
        return out

    def _route_to(self, target: tuple[int, int]) -> list[tuple[int, int]]:
        x, y = self._current_coord()
        tx, ty = target
        path = []
        while x != tx:
            x += 1 if tx > x else -1
            path.append((x, y))
        while y != ty:
            y += 1 if ty > y else -1
            path.append((x, y))
        return path

    def _tile_preposition(self, coord: tuple[int, int]) -> str:
        biome = self._tile_seed(coord)["biome"]
        if self.player.language == "de":
            return "im" if biome in {"Nebelmoor", "Schwarzwurzelwald", "Jade-Dschungel", "Mondsumpf", "Düsterforst"} else "auf"
        return "in" if biome in {"Nebelmoor", "Schwarzwurzelwald", "Jade-Dschungel", "Mondsumpf", "Düsterforst"} else "on"

    def _refresh_tile_knowledge(self, coord: tuple[int, int]) -> None:
        tile = self._tile_seed(coord)
        self.player.discovered_tiles.add(coord)
        for resource in tile.get("resources", ()):
            self.player.known_resource_tiles.setdefault(resource, set()).add(coord)
        for poi in tile.get("poi", ()):
            self.player.points_of_interest.add(poi)

    def _building_at(self, coord: tuple[int, int]) -> str:
        if not self.player.city:
            return ""
        for b in self.player.city.buildings:
            if (b.x, b.y) == coord:
                return BUILDINGS[b.building_id].name[self.player.language]
        return ""

    def _current_tile(self) -> dict:
        tile = self._tile_seed(self._current_coord()).copy()
        tile["building"] = self._building_at(self._current_coord())
        return tile

    def _current_tension(self) -> str:
        tile = self._current_tile()
        city = tile.get("city")
        extra = []
        if city == "Graufurt":
            extra.append(self._lang("Graufurt misstraut Valmoras Holz- und Aschenwalls Erzforderungen.", "Graufurt distrusts Valmora's timber and Ashenwall's ore demands."))
        if city == "Valmora-Hain":
            extra.append(self._lang("Valmora duldet Handel, aber keinen Kahlschlag für Kriegspläne.", "Valmora allows trade, but not clear-cutting for war plans."))
        if city == "Aschenwall":
            extra.append(self._lang("Aschenwall zieht Milizen und Vorräte enger zusammen.", "Ashenwall draws militia and supply lines tighter."))
        if self.player.city:
            extra.append(self._lang(f"Deine Stadt {self.player.city.city_name} meldet {self.player.city.taxes_silver}s Steuern im Speicher.", f"Your city {self.player.city.city_name} reports {self.player.city.taxes_silver}s taxes in reserve."))
        return " ".join(extra)

    def _resource_display(self, resource: str) -> str:
        mapping = {"wood":"Holz","iron":"Eisen","gems":"Edelsteine","gold":"Gold"}
        return mapping.get(resource, resource) if self.player.language == "de" else resource

    def _display_item(self, item_id: str) -> str:
        if item_id in ITEMS:
            return ITEMS[item_id].name[self.player.language]
        return item_id.replace("_"," ")

    def _normalize_command(self, command: str) -> str:
        command = command.strip()
        command = command.replace("_", " ")
        return command

    def public_status(self) -> PublicCharacterStatus:
        tile = self._current_tile()
        reaction_seconds = 0
        choices = []
        if self.player.combat_state and self.player.combat_state.awaiting_player:
            reaction_seconds = max(0, int(self.player.combat_state.deadline_monotonic - monotonic()))
            choices = ["attack", "guard", "dodge", "cast soul trap", "auto battle on"]
        return PublicCharacterStatus(
            character_name=self.player.character_name,
            class_name=self.player.class_name,
            race_name=self.player.race_name,
            level=self.player.level,
            hp_current=self.player.hp_current,
            hp_max=self.player.hp_max,
            mana_current=self.player.mana_current,
            mana_max=self.player.mana_max,
            location_label=tile["label"][self.player.language],
            coords_label=self._coord_label(self._current_coord()),
            active_action=self.player.active_action,
            tick_value=self.player.tick_value,
            silver=self.player.silver,
            gold=self.player.gold,
            hunger=self.player.hunger,
            overlay_message=self.player.overlay_message_de if self.player.language == "de" else self.player.overlay_message_en,
            media_file=f"public/media/png/{self.player.current_media_file}.png",
            media_terminal_file=f"media/gifs/{self.player.current_media_file}.gif",
            language=self.player.language,
            reaction_seconds_left=reaction_seconds,
            combat_choices=choices,
            faction_tension=self._current_tension(),
            dialogue_mode=self.player.dialogue_mode,
            dialogue_target=self.player.dialogue_target or "",
            auto_battle_enabled=self.player.auto_battle_enabled,
            auto_battle_mode=self.player.auto_battle_mode,
        )

    def visible_map(self) -> list[PublicTileKnowledge]:
        cx, cy = self._current_coord()
        tiles = []
        for y in range(cy - MAP_RADIUS, cy + MAP_RADIUS + 1):
            for x in range(cx - MAP_RADIUS, cx + MAP_RADIUS + 1):
                coord = (x, y)
                if not self._in_bounds(coord):
                    continue
                if coord == (cx, cy):
                    state = "visible"
                elif coord in self._neighbors((cx, cy)).values():
                    state = "fresh" if coord in self.player.discovered_tiles else "rumoured"
                elif coord in self.player.discovered_tiles:
                    state = "stale"
                else:
                    state = "unknown"
                if state == "unknown":
                    tiles.append(PublicTileKnowledge(tile_id=f"{x}:{y}", label=self._lang("Unkartiert","Uncharted"), coords_label="?,?", visibility_state="unknown"))
                    continue
                seed = self._tile_seed(coord)
                tiles.append(PublicTileKnowledge(
                    tile_id=f"{x}:{y}",
                    label=seed["label"][self.player.language],
                    coords_label=self._coord_label(coord),
                    visibility_state=state,
                    biome=seed["biome"],
                    terrain=seed["terrain"],
                    is_current=coord==(cx,cy),
                    poi_known=list(seed.get("poi",())),
                    known_resources=list(seed.get("resources",())),
                    building=self._building_at(coord),
                    sprite=f"public/media/png/{seed['media_base']}.png",
                ))
        return tiles

    def visible_inventory(self) -> list[PublicInventoryEntry]:
        entries=[]
        for item_id, qty in sorted(self.player.inventory.items()):
            if qty <= 0: continue
            item = ITEMS.get(item_id)
            if not item: continue
            affixes = self.player.weapon_affixes if self.player.equipment.weapon == item_id else self.player.armor_affixes if self.player.equipment.armor == item_id else self.player.accessory_affixes if self.player.equipment.accessory == item_id else []
            entries.append(PublicInventoryEntry(item_id=item_id, item_name=item.name[self.player.language], quantity=qty, category=item.category, quality=item.quality, slot=item.slot, description=item.description.get(self.player.language, item.name[self.player.language]), affixes=affixes, sprite=f"public/media/png/{item.icon}.png"))
        return entries

    def visible_equipment(self) -> list[PublicEquipmentEntry]:
        entries=[]
        for slot in ["weapon","armor","accessory","offhand","ammo"]:
            item_id = getattr(self.player.equipment, slot)
            if not item_id: continue
            item = ITEMS.get(item_id)
            if not item: continue
            affixes = self.player.weapon_affixes if slot=="weapon" else self.player.armor_affixes if slot in {"armor","offhand"} else self.player.accessory_affixes
            entries.append(PublicEquipmentEntry(slot=slot, item_name=item.name[self.player.language], quality=item.quality, affixes=list(affixes), sprite=f"public/media/png/{item.icon}.png"))
        return entries

    def visible_market(self) -> list[PublicMarketEntry]:
        tile = self._current_tile()
        city = tile.get("city") or "Graufurt"
        stock = MERCHANT_STOCK.get(city, MERCHANT_STOCK["Graufurt"])
        entries=[]
        trend = self._lang("stabil","stable")
        for item_id in stock:
            item = ITEMS[item_id]
            entries.append(PublicMarketEntry(item_name=item.name[self.player.language], category=item.category, price_display=self._format_money(item.price_silver), trend=trend, item_id=item_id, sprite=f"public/media/png/{item.icon}.png"))
        return entries

    def visible_buffs(self) -> list[PublicBuffEntry]:
        out=[]
        for buff in self.player.buffs:
            out.append(PublicBuffEntry(buff_name=buff.buff_type.replace("_"," "), value=buff.value, remaining_ticks=max(0,buff.expires_at_tick-self.player.tick_value), source=buff.source, sprite="public/media/png/icon_buff.png"))
        return out

    def visible_city(self) -> PublicCityEntry | None:
        if not self.player.city:
            return None
        city = self.player.city
        building_lines = []
        for b in city.buildings:
            bd = BUILDINGS[b.building_id]
            building_lines.append(f"{bd.name[self.player.language]} [{b.x},{b.y}] L{b.level}")
        militia_lines = []
        for unit_id, qty in city.militia.items():
            if qty:
                militia_lines.append(f"{UNITS[unit_id].name[self.player.language]} x{qty}")
        general_lines = [f"{g.slot}. {g.name} ({g.doctrine})" for g in city.generals]
        return PublicCityEntry(city_name=city.city_name, governor_name=city.governor_name, taxes_silver=city.taxes_silver, population=city.population, research_points=city.research_points, building_lines=building_lines, militia_lines=militia_lines, general_lines=general_lines)

    def visible_combat(self) -> list[PublicCombatEntry]:
        if not self.player.combat_state:
            return []
        out=[]
        for enemy in self.player.combat_state.enemies:
            out.append(PublicCombatEntry(enemy_name=enemy.name_de if self.player.language == "de" else enemy.name_en, hp_current=enemy.hp_current, hp_max=enemy.hp_max, faction=enemy.faction, damage_type=enemy.damage_type, sprite=f"public/media/png/{enemy.media_file}.png"))
        return out

    def snapshot(self, message: str, ok: bool = True, stream_chunks: list[str] | None = None) -> PublicCommandResult:
        return PublicCommandResult(
            ok=ok,
            message=message,
            status=self.public_status(),
            map_tiles=self.visible_map(),
            inventory=self.visible_inventory(),
            equipment=self.visible_equipment(),
            market=self.visible_market(),
            journal=list(self.player.journal),
            commands=list(STARTING_COMMANDS),
            quests=[],
            buffs=self.visible_buffs(),
            stream_chunks=stream_chunks or [],
            combat=self.visible_combat(),
            city=self.visible_city(),
        )

    def state_snapshot(self) -> PublicCommandResult:
        self.sync()
        return self.snapshot(self._msg("status_refreshed"))

    def execute(self, command: str) -> PublicCommandResult:
        self.sync()
        command = self._normalize_command(command or "")
        if self.player.dialogue_mode and command and command not in {"/leave", "cube leave"}:
            return self._cube_say(command)
        if not command:
            return self.snapshot(self._msg("empty_command"), ok=False)
        parts = command.split()
        verb = parts[0].lower()
        args = parts[1:]
        two = " ".join(parts[:2]).lower() if len(parts)>=2 else verb

        if two == "show commands" or verb in {"help","showcommands"}:
            return self.snapshot(self._msg("commands_loaded"))
        if verb == "lang":
            return self._set_language(args)
        if verb == "look":
            return self.snapshot(self._msg("look", desc=self._current_tile()["description"][self.player.language]))
        if verb == "inspect":
            return self.snapshot(self._inspect())
        if verb == "map":
            return self.snapshot(self._msg("map_refreshed"))
        if verb == "inventory":
            return self.snapshot(self._msg("inventory_refreshed"))
        if verb == "equipment":
            return self.snapshot(self._msg("equipment_refreshed"))
        if verb == "market" or (verb == "merchant" and (not args or args[0]=="list")):
            return self.snapshot(self._msg("merchant_list"))
        if verb == "journal":
            return self.snapshot(self._msg("journal_refreshed"))
        if verb == "buffs":
            return self.snapshot(self._msg("buffs_refreshed"))
        if verb in {"walk","gather","hunt","explore","equip","use","read","book","attack","guard","dodge","cast","craft","socket","enchant","buy","sell","cube","city","militia","auto","soul"}:
            pass
        else:
            return self.snapshot(self._msg("unknown_command", command=command), ok=False)

        if verb == "walk":
            return self._walk(args)
        if verb == "gather":
            return self._gather(args)
        if verb == "hunt":
            return self._hunt(args)
        if verb == "explore":
            return self._explore()
        if verb == "equip":
            return self._equip(args)
        if verb == "use":
            return self._use(args)
        if verb == "read":
            return self._read_book(args)
        if verb == "book":
            return self._flip_book(args)
        if verb in {"attack","guard","dodge"}:
            return self._combat_command(verb)
        if verb == "cast":
            return self._cast(args)
        if two == "auto battle":
            return self._auto_battle(parts[2:])
        if verb == "auto":
            return self._auto_battle(args[1:] if args and args[0].lower()=="battle" else args)
        if two == "soul forge":
            return self._soulforge(parts[2:])
        if verb == "soulforge":
            return self._soulforge(args)
        if verb == "soul" and args and args[0].lower()=="forge":
            return self._soulforge(args[1:])
        if verb == "craft":
            return self._craft(parts[1:])
        if verb == "socket":
            return self._socket(parts[1:])
        if verb == "enchant":
            return self._enchant(parts[1:])
        if verb == "buy":
            return self._buy(args)
        if verb == "sell":
            return self._sell(args)
        if verb == "cube":
            return self._cube_command(args)
        if verb == "city":
            return self._city_command(args)
        if verb == "militia":
            return self._militia_command(args)
        return self.snapshot(self._msg("unknown_command", command=command), ok=False)

    def sync(self, now: float | None = None) -> None:
        current = now or monotonic()
        self._sync_buffs()
        self._sync_city_economy()
        if self.player.combat_state and self.player.combat_state.awaiting_player:
            if self.player.auto_battle_enabled and current >= self.player.combat_state.deadline_monotonic - 0.5:
                self._resolve_player_combat_action(self._pick_auto_battle_action(), auto=True)
            elif current >= self.player.combat_state.deadline_monotonic:
                self._resolve_player_combat_action("guard", auto=True)
        if self.player.action_state and current - self.player.action_state.last_progress_at >= PROGRESS_INTERVAL:
            self._progress_action(current)

    def _sync_buffs(self) -> None:
        self.player.buffs = [buff for buff in self.player.buffs if buff.expires_at_tick > self.player.tick_value]

    def _sync_city_economy(self) -> None:
        city = self.player.city
        if not city:
            return
        # taxes and research trickle every 5 ticks
        if self.player.tick_value % 5 == 0:
            tax_gain = max(1, city.population // 60)
            research_gain = 1 + len(city.buildings)//3
            for b in city.buildings:
                bd = BUILDINGS[b.building_id]
                tax_gain += bd.outputs.get("taxes",0)
                research_gain += bd.outputs.get("research",0)
                for res, amt in bd.outputs.items():
                    if res in {"wood_bundle","iron_ore","mithril_ore","steel_ingot"}:
                        self.player.inventory[res] = self.player.inventory.get(res,0)+amt
            city.taxes_silver += tax_gain
            city.research_points += research_gain
            self.player.silver += tax_gain

    def _advance_tick(self, action: str) -> None:
        self.player.active_action = action
        self.player.tick_value += 1
        if self.player.tick_value % 6 == 0:
            self.player.hunger = self._lang("spürbar","noticeable")

    def _set_overlay(self, de_text: str, en_text: str, media_file: str | None = None) -> None:
        self.player.overlay_message_de = de_text
        self.player.overlay_message_en = en_text
        if media_file:
            self.player.current_media_file = media_file

    def _set_language(self, args: list[str]) -> PublicCommandResult:
        if not args or args[0].lower() not in {"de", "en"}:
            return self.snapshot("Nutze: lang de|en" if self.player.language == "de" else "Use: lang de|en", ok=False)
        self.player.language = args[0].lower()
        self.player.hunger = self._lang("gering","low")
        return self.snapshot(self._msg("lang_set") if self.player.language == "de" else self._msg("lang_set_en"))

    def _inspect(self) -> str:
        tile = self._current_tile()
        neighbors = ", ".join(self._tile_seed(n)["label"][self.player.language] for n in self._neighbors(self._current_coord()).values()) or self._lang("keine","none")
        tension = self._msg("faction_tension", text=self._current_tension()) if self._current_tension() else ""
        return self._msg("inspect", tile=tile["label"][self.player.language], terrain=tile["terrain"], biome=tile["biome"], neighbors=neighbors, tension=tension)

    def _parse_coord(self, raw: str) -> tuple[int, int] | None:
        if "," not in raw:
            return None
        left, right = raw.split(",", 1)
        try:
            return (int(left.strip()), int(right.strip()))
        except ValueError:
            return None

    def _walk(self, args: list[str]) -> PublicCommandResult:
        if not args:
            return self.snapshot(self._msg("walk_usage"), ok=False)
        target = None
        if args[0].lower() == "route":
            key = " ".join(args[1:]).lower()
            if key not in ROUTES:
                return self.snapshot(self._msg("route_unknown", route=key or "?"), ok=False)
            target = ROUTES[key]
        else:
            coord = self._parse_coord(args[0])
            if coord:
                target = coord
            else:
                direction = DIRECTION_ALIASES.get(args[0].lower())
                if direction:
                    dx, dy = DIR_VECTORS[direction]
                    target = (self.player.x + dx, self.player.y + dy)
        if not target or not self._in_bounds(target):
            return self.snapshot(self._msg("no_path"), ok=False)
        route = self._route_to(target)
        for step in route:
            self.player.x, self.player.y = step
            self._refresh_tile_knowledge(step)
            self._advance_tick("walk")
            self._maybe_log_travel_encounter(step)
        tile = self._current_tile()
        self._set_overlay(self._msg("walk_success", tile=tile["label"][self.player.language]), MSG["en"]["walk_success"].format(tile=tile["label"]["en"]), tile["media_base"])
        return self.snapshot(self._msg("walk_success", tile=tile["label"][self.player.language]))

    def _nearest_tile_by_predicate(self, predicate) -> tuple[int, int] | None:
        start = self._current_coord()
        q = deque([start])
        seen = {start}
        while q and len(seen) < 1500:
            current = q.popleft()
            if predicate(current):
                return current
            for nxt in self._neighbors(current).values():
                if nxt not in seen:
                    seen.add(nxt)
                    q.append(nxt)
        return None

    def _select_resource_target(self, resource_type: str) -> tuple[int, int] | None:
        known = self.player.known_resource_tiles.get(resource_type)
        if known:
            return min(known, key=lambda c: abs(c[0]-self.player.x)+abs(c[1]-self.player.y))
        return self._nearest_tile_by_predicate(lambda c: resource_type in self._tile_seed(c).get("resources",()))

    def _gather(self, args: list[str]) -> PublicCommandResult:
        if not args:
            return self.snapshot(self._lang("Nutze: gather iron|wood|gems|gold|x,y","Use: gather iron|wood|gems|gold|x,y"), ok=False)
        coord = self._parse_coord(args[0])
        resource_type = None if coord else args[0].lower()
        target = coord or self._select_resource_target(resource_type)
        if not target:
            return self.snapshot(self._msg("no_path"), ok=False)
        route = self._route_to(target)
        self.player.action_state = ActionState(kind="gather", started_at=monotonic(), last_progress_at=monotonic(), status_key="gather", route=route, target_coords=target, resource_type=resource_type)
        self.player.active_action = "gather"
        tile = self._current_tile()
        self._set_overlay(self._msg("gather_dispatched", tile=tile["label"][self.player.language], coords=self._coord_label(self._current_coord()), spinner=self._spinner()), MSG["en"]["gather_dispatched"].format(tile=tile["label"]["en"], coords=self._coord_label(self._current_coord()), spinner=self._spinner()), "action_gather")
        return self.snapshot(self.player.overlay_message_de if self.player.language=="de" else self.player.overlay_message_en)

    def _hunt(self, args: list[str]) -> PublicCommandResult:
        target = None
        if args:
            coord = self._parse_coord(args[0])
            if coord:
                target = coord
            else:
                direction = DIRECTION_ALIASES.get(args[0].lower())
                if direction:
                    dx, dy = DIR_VECTORS[direction]
                    target = (self.player.x + dx, self.player.y + dy)
        if target is None:
            target = self._nearest_tile_by_predicate(lambda c: bool(self._encounterable_monsters(c)))
        if not target:
            return self.snapshot(self._msg("no_path"), ok=False)
        route = self._route_to(target)
        self.player.action_state = ActionState(kind="hunt", started_at=monotonic(), last_progress_at=monotonic(), status_key="hunt", route=route, target_coords=target)
        self.player.active_action = "hunt"
        tile = self._current_tile()
        self._set_overlay(self._msg("hunt_dispatched", tile=tile["label"][self.player.language], coords=self._coord_label(self._current_coord()), spinner=self._spinner()), MSG["en"]["hunt_dispatched"].format(tile=tile["label"]["en"], coords=self._coord_label(self._current_coord()), spinner=self._spinner()), "action_hunt")
        return self.snapshot(self.player.overlay_message_de if self.player.language=="de" else self.player.overlay_message_en)

    def _explore(self) -> PublicCommandResult:
        target = self._nearest_tile_by_predicate(lambda c: c not in self.player.discovered_tiles)
        if not target:
            return self.snapshot(self._lang("Keine verdeckten Regionen in Reichweite.","No hidden regions nearby."))
        route = self._route_to(target)
        self.player.action_state = ActionState(kind="explore", started_at=monotonic(), last_progress_at=monotonic(), status_key="explore", route=route, target_coords=target)
        self.player.active_action = "explore"
        tile = self._current_tile()
        self._set_overlay(self._msg("explore_dispatched", tile=tile["label"][self.player.language], coords=self._coord_label(self._current_coord()), spinner=self._spinner()), MSG["en"]["explore_dispatched"].format(tile=tile["label"]["en"], coords=self._coord_label(self._current_coord()), spinner=self._spinner()), "action_explore")
        return self.snapshot(self.player.overlay_message_de if self.player.language=="de" else self.player.overlay_message_en)

    def _progress_action(self, now: float) -> None:
        state = self.player.action_state
        if not state:
            return
        if state.route:
            self.player.x, self.player.y = state.route.pop(0)
            self._refresh_tile_knowledge(self._current_coord())
            self._advance_tick(state.kind)
            tile = self._current_tile()
            if state.kind == "gather":
                display = self._resource_display(state.resource_type or (tile.get("resources") or ("wood",))[0])
                self._set_overlay(self._msg("gather_travel", resource=display, tile=tile["label"][self.player.language], coords=self._coord_label(self._current_coord()), spinner=self._spinner()), MSG["en"]["gather_travel"].format(resource=state.resource_type or "resource", tile=tile["label"]["en"], coords=self._coord_label(self._current_coord()), spinner=self._spinner()), "action_gather")
            elif state.kind == "hunt":
                self._set_overlay(self._msg("hunt_travel", tile=tile["label"][self.player.language], coords=self._coord_label(self._current_coord()), spinner=self._spinner()), MSG["en"]["hunt_travel"].format(tile=tile["label"]["en"], coords=self._coord_label(self._current_coord()), spinner=self._spinner()), "action_hunt")
            else:
                self._set_overlay(self._msg("explore_progress", tile=tile["label"][self.player.language], coords=self._coord_label(self._current_coord()), spinner=self._spinner()), MSG["en"]["explore_progress"].format(tile=tile["label"]["en"], coords=self._coord_label(self._current_coord()), spinner=self._spinner()), "action_explore")
            state.last_progress_at = now
            self._maybe_log_travel_encounter(self._current_coord())
            return

        tile = self._current_tile()
        if state.kind == "gather":
            res = state.resource_type or (tile.get("resources") or ("wood",))[0]
            drop = {"wood":"wood_bundle","iron":"iron_ore","gems":"opal_shard","gold":"gold_coin"}.get(res,"wood_bundle")
            self.player.inventory[drop] = self.player.inventory.get(drop,0)+1
            self._set_overlay(self._msg("gather_success", resource=self._resource_display(res), drop=self._display_item(drop), tile=tile["label"][self.player.language], coords=self._coord_label(self._current_coord())), MSG["en"]["gather_success"].format(resource=res, drop=self._display_item(drop), tile=tile["label"]["en"], coords=self._coord_label(self._current_coord())), "action_gather")
            self.player.journal.append(self.player.overlay_message_de if self.player.language=="de" else self.player.overlay_message_en)
        elif state.kind == "explore":
            self._set_overlay(self._msg("explore_success", tile=tile["label"][self.player.language], coords=self._coord_label(self._current_coord())), MSG["en"]["explore_success"].format(tile=tile["label"]["en"], coords=self._coord_label(self._current_coord())), tile["media_base"])
            self.player.journal.append(self.player.overlay_message_de if self.player.language=="de" else self.player.overlay_message_en)
        elif state.kind == "hunt":
            monster_id = self._pick_monster_for_tile(self._current_coord())
            if monster_id:
                monster = MONSTER_CLASSES[monster_id]
                self._set_overlay(self._msg("hunt_found", monster=monster.name[self.player.language], prep=self._tile_preposition(self._current_coord()), tile=tile["label"][self.player.language], coords=self._coord_label(self._current_coord())), MSG["en"]["hunt_found"].format(monster=monster.name["en"], prep=self._tile_preposition(self._current_coord()), tile=tile["label"]["en"], coords=self._coord_label(self._current_coord())), monster.media_file)
                self._start_combat(monster_id, "hunt")
            else:
                # loop seamlessly
                state.route = self._route_to(self._nearest_tile_by_predicate(lambda c: bool(self._encounterable_monsters(c))) or self._current_coord())
                state.last_progress_at = now
                return
        self.player.action_state = None
        self.player.active_action = "idle"

    def _maybe_log_travel_encounter(self, coord: tuple[int,int]) -> None:
        tile = self._tile_seed(coord)
        roll = self._hash(coord[0], coord[1] + self.player.tick_value) % 11
        if roll != 0:
            return
        matches = [enc for enc in TRAVEL_ENCOUNTERS if tile["biome"] in enc.biomes]
        if not matches:
            return
        enc = matches[self._hash(coord[0],coord[1]) % len(matches)]
        text = self._msg("encounter_log", name=enc.name[self.player.language], desc=enc.description[self.player.language])
        self.player.journal.append(text)
        self._set_overlay(text, text, enc.media_file)

    def _encounterable_monsters(self, coord: tuple[int,int]) -> list[str]:
        biome = self._tile_seed(coord)["biome"]
        return [mid for mid, mon in MONSTER_CLASSES.items() if biome in mon.biome_tags]

    def _pick_monster_for_tile(self, coord: tuple[int,int]) -> str | None:
        mons = self._encounterable_monsters(coord)
        if not mons:
            return None
        return mons[self._hash(coord[0], coord[1] + self.player.tick_value) % len(mons)]

    def _make_enemy(self, enemy_id: str, index: int) -> EnemyState:
        mon = MONSTER_CLASSES[enemy_id]
        return EnemyState(enemy_id=f"{enemy_id}_{index}", name_de=mon.name["de"], name_en=mon.name["en"], race=mon.race, faction=mon.faction, level=mon.level, hp_current=mon.max_hp, hp_max=mon.max_hp, armor=mon.armor, wisdom=mon.wisdom, intelligence=mon.intelligence, dexterity=mon.dexterity, accuracy=mon.accuracy, defense=mon.defense, block=mon.block, dodge=mon.dodge, attack_kind=mon.attack_kind, damage_type=mon.damage_type, power=mon.power, media_file=mon.media_file, resistance_profile=mon.resistances.copy())

    def _start_combat(self, enemy_id: str, source: str) -> None:
        mon = MONSTER_CLASSES[enemy_id]
        size = mon.group_min + (self._hash(self.player.x, self.player.y) % (mon.group_max - mon.group_min + 1))
        enemies = [self._make_enemy(enemy_id, i) for i in range(size)]
        self.player.combat_state = CombatState(source=source, enemies=enemies, round_number=1, awaiting_player=True, deadline_monotonic=monotonic()+REACTION_WINDOW_SECONDS, message_de="", message_en="", auto_battle=self.player.auto_battle_enabled, auto_mode=self.player.auto_battle_mode, player_slot_advantage=(self.player.x+self.player.y)%3)
        tile = self._current_tile()
        msg_de = self._msg("combat_begin", enemy=mon.name["de"], prep=self._tile_preposition(self._current_coord()), tile=tile["label"]["de"])
        self.player.combat_state.message_de = msg_de
        self.player.combat_state.message_en = MSG["en"]["combat_begin"].format(enemy=mon.name["en"], prep=self._tile_preposition(self._current_coord()), tile=tile["label"]["en"])
        self.player.active_action = "combat"
        self.player.current_media_file = mon.media_file

    def _weapon_state(self) -> tuple[str,int,str]:
        item_id = self.player.equipment.weapon or "iron_sword"
        item = ITEMS.get(item_id, ITEMS["iron_sword"])
        base = item.damage
        dtype = item.damage_type or "melee"
        for aff in self.player.weapon_affixes:
            if aff.startswith("socket:"):
                _, gem, dtyp, bonus = aff.split(":")
                base += int(bonus)
                dtype = dtyp
            elif aff.startswith("enchant:"):
                _, tag, bonus = aff.split(":")
                base += int(bonus)
            elif aff.startswith("soulforge:"):
                _, dtyp, bonus = aff.split(":")
                dtype = dtyp
                base += int(bonus)
            elif aff.startswith("crit:"):
                pass
        for buff in self.player.buffs:
            if buff.buff_type == "damage_bonus":
                base += buff.value
        return item_id, base, dtype

    def _magic_damage(self, damage_type: str, base: int, enemy: EnemyState) -> int:
        level_mod = 1 + (self.player.level - enemy.level) * 0.04
        stat_mod = 1 + max(0, self.player.intelligence - enemy.wisdom) * 0.025
        matrix = ELEMENT_MATRIX.get((damage_type, enemy.damage_type), 1.0)
        resist_pct = enemy.resistance_profile.get(damage_type, 0)
        resist = max(0.15, 1 - (resist_pct + self.player.base_resistance + enemy.wisdom) / 220)
        return max(1, int(base * level_mod * stat_mod * matrix * resist))

    def _physical_damage(self, enemy: EnemyState) -> int:
        _, base, dtype = self._weapon_state()
        quality_step = 0
        weapon_item = ITEMS.get(self.player.equipment.weapon or "", ITEMS["iron_sword"])
        if weapon_item.quality in QUALITY_ORDER:
            quality_step = QUALITY_ORDER.index(weapon_item.quality)
        level_mod = 1 + (self.player.level - enemy.level) * 0.05
        accuracy_mod = 1 + max(0, self.player.accuracy - enemy.defense) * 0.02
        dex_mod = 1 + max(0, self.player.dexterity - enemy.dodge) * 0.015
        position_mod = 1.0 + (self.player.combat_state.player_slot_advantage if self.player.combat_state else 0) * 0.05
        armor_reduction = max(0.2, 1 - ((enemy.armor + enemy.block) / 140))
        crit_bonus = 1.0 + (0.5 if "crit:50" in self.player.weapon_affixes else 0)
        class_bonus = SPECIAL_DAMAGE_HINTS.get(self.player.class_name, {}).get(enemy.race, 1.0)
        raw = (base + self.player.strength + quality_step) * level_mod * accuracy_mod * dex_mod * position_mod * armor_reduction * crit_bonus * class_bonus
        if dtype not in {"physical","melee","distance"}:
            return self._magic_damage(dtype, int(raw), enemy)
        return max(1, int(raw))

    def _enemy_damage(self, enemy: EnemyState) -> int:
        positional = 1.0 - ((self.player.combat_state.player_slot_advantage if self.player.combat_state else 0) * 0.03)
        if enemy.attack_kind == "magic":
            matrix = ELEMENT_MATRIX.get((enemy.damage_type, enemy.damage_type),1.0)
            resist = max(0.2, 1 - (self.player.wisdom + self.player.base_resistance) / 180)
            return max(1, int((enemy.power + enemy.intelligence/2) * matrix * resist * positional))
        dodge_guard = sum(buff.value for buff in self.player.buffs if buff.buff_type in {"guard_window","dodge_window"})
        armor = self.player.block + self.player.defense + dodge_guard
        return max(1, int((enemy.power + enemy.accuracy - self.player.defense) * max(0.25, 1 - armor/180) * positional))

    def _pick_auto_battle_action(self) -> str:
        mode = self.player.auto_battle_mode
        combat = self.player.combat_state
        if not combat or not combat.enemies:
            return "guard"
        enemy = combat.enemies[0]
        if self.player.hp_current < self.player.hp_max * 0.35 and mode != "aggressive":
            return "guard"
        if self.player.mana_current >= 8 and enemy.race in {"Untoter","Dämon"} and mode != "defensive":
            return "cast soul trap" if combat.soultrap_rounds == 0 else "attack"
        if mode == "aggressive":
            return "attack"
        if mode == "defensive":
            return "dodge" if self.player.hp_current < self.player.hp_max * 0.7 else "guard"
        return "attack" if enemy.hp_current < enemy.hp_max * 0.6 else "guard"

    def _resolve_player_combat_action(self, action: str, auto: bool=False) -> None:
        combat = self.player.combat_state
        if not combat or not combat.enemies:
            return
        enemy = combat.enemies[0]
        log = combat.last_action_log
        if action == "attack":
            damage = self._physical_damage(enemy)
            enemy.hp_current -= damage
            log.append(f"attack:{damage}")
        elif action == "dodge":
            self.player.buffs.append(BuffState("dodge_window", 20, self.player.tick_value + 1, "combat"))
            log.append("dodge")
        elif action == "guard":
            self.player.buffs.append(BuffState("guard_window", 25, self.player.tick_value + 1, "combat"))
            log.append(self._msg("auto_guard") if auto else "guard")
        elif action == "cast soul trap":
            combat.soultrap_rounds = 3
            combat.soultrap_target_id = enemy.enemy_id
            self.player.mana_current = max(0, self.player.mana_current - 8)
            log.append(self._msg("soultrap_applied", enemy=enemy.name_de if self.player.language=="de" else enemy.name_en))
        else:
            log.append("guard")
        combat.awaiting_player = False
        self._advance_tick("combat")
        self._resolve_enemy_turn()
        if self.player.combat_state and self.player.combat_state.enemies:
            self.player.combat_state.round_number += 1
            self.player.combat_state.awaiting_player = True
            self.player.combat_state.deadline_monotonic = monotonic() + REACTION_WINDOW_SECONDS

    def _resolve_enemy_turn(self) -> None:
        combat = self.player.combat_state
        if not combat:
            return
        defeated = [e for e in combat.enemies if e.hp_current <= 0]
        for enemy in defeated:
            self._handle_enemy_defeat(enemy)
        combat.enemies = [e for e in combat.enemies if e.hp_current > 0]
        if not combat.enemies:
            self.player.combat_state = None
            self.player.active_action = "idle"
            return
        total = sum(self._enemy_damage(enemy) for enemy in combat.enemies)
        self.player.hp_current -= total
        if self.player.hp_current <= 0:
            self.player.hp_current = max(18, self.player.hp_max // 2)
            self.player.x, self.player.y = ROUTES["graufurt"]
            self.player.combat_state = None
            self.player.active_action = "idle"
            self.player.journal.append(self._msg("combat_loss"))
            self._set_overlay(self._msg("combat_loss"), MSG["en"]["combat_loss"], "tile_graufurt-eastgate")

    def _make_soulstone(self, enemy: EnemyState) -> str:
        if enemy.level >= 8: size="grand"
        elif enemy.level >= 6: size="greater"
        elif enemy.level >= 5: size="common"
        elif enemy.level >= 4: size="lesser"
        else: size="petty"
        return f"soulstone_{size}"

    def _handle_enemy_defeat(self, enemy: EnemyState) -> None:
        base_id = enemy.enemy_id.rsplit("_",1)[0]
        mon = MONSTER_CLASSES[base_id]
        loot_texts = []
        for drop_id, low, high in mon.loot_table:
            qty = low + (self._hash(self.player.tick_value, enemy.level) % (high - low + 1))
            self.player.inventory[drop_id] = self.player.inventory.get(drop_id,0)+qty
            loot_texts.append(f"{self._display_item(drop_id)} x{qty}")
        if self.player.combat_state and self.player.combat_state.soultrap_target_id == enemy.enemy_id and self.player.combat_state.soultrap_rounds > 0:
            stone = self._make_soulstone(enemy)
            self.player.inventory[stone] = self.player.inventory.get(stone,0)+1
            self.player.journal.append(self._msg("soulstone_charged", stone=self._display_item(stone)))
        msg = self._msg("combat_win", enemy=enemy.name_de if self.player.language=="de" else enemy.name_en, drop=", ".join(loot_texts))
        self.player.journal.append(msg)
        if self.player.action_state and self.player.action_state.kind == "hunt":
            tile = self._current_tile()
            self._set_overlay(self._msg("hunt_success", monster=enemy.name_de if self.player.language=="de" else enemy.name_en, drop=", ".join(loot_texts), tile=tile["label"][self.player.language], coords=self._coord_label(self._current_coord())), MSG["en"]["hunt_success"].format(monster=enemy.name_en, drop=", ".join(loot_texts), tile=tile["label"]["en"], coords=self._coord_label(self._current_coord())), enemy.media_file)

    def _combat_command(self, action: str) -> PublicCommandResult:
        if not self.player.combat_state:
            return self.snapshot(self._msg("combat_only"), ok=False)
        self._resolve_player_combat_action(action)
        return self.snapshot(action)

    def _cast(self, args: list[str]) -> PublicCommandResult:
        if not args:
            return self.snapshot(self._msg("combat_only"), ok=False)
        spell = " ".join(args).lower()
        if spell == "soul trap":
            return self._combat_command("cast soul trap")
        if not self.player.combat_state or not self.player.combat_state.enemies:
            return self.snapshot(self._msg("combat_only"), ok=False)
        enemy = self.player.combat_state.enemies[0]
        damage_map = {"fireball":("fire",16), "lightning orb":("lightning",15), "lightning strike":("storm",18), "fire wall":("fire",14), "fire beam":("fire",20)}
        if spell not in damage_map:
            return self.snapshot(self._lang("Unbekannter Zauber.","Unknown spell."), ok=False)
        dtype, base = damage_map[spell]
        damage = self._magic_damage(dtype, base, enemy)
        enemy.hp_current -= damage
        self.player.mana_current = max(0, self.player.mana_current - 10)
        return self.snapshot(f"{spell}: {damage}")

    def _auto_battle(self, args: list[str]) -> PublicCommandResult:
        state = "on"
        mode = self.player.auto_battle_mode
        if args:
            if args[0].lower() in {"on","off"}:
                self.player.auto_battle_enabled = args[0].lower() == "on"
                state = args[0].lower()
                if len(args) > 1 and args[1].lower() in {"balanced","aggressive","defensive"}:
                    self.player.auto_battle_mode = args[1].lower()
            elif args[0].lower() in {"balanced","aggressive","defensive"}:
                self.player.auto_battle_enabled = True
                self.player.auto_battle_mode = args[0].lower()
                state = "on"
            mode = self.player.auto_battle_mode
        else:
            self.player.auto_battle_enabled = not self.player.auto_battle_enabled
            state = "on" if self.player.auto_battle_enabled else "off"
        return self.snapshot(self._msg("auto_battle_set", state=state, mode=mode))

    def _equip(self, args: list[str]) -> PublicCommandResult:
        if not args:
            return self.snapshot(self._lang("Nutze: equip <item>","Use: equip <item>"), ok=False)
        item_id = self._resolve_item_id(" ".join(args))
        if not item_id or self.player.inventory.get(item_id,0) <= 0:
            return self.snapshot(self._msg("equip_missing"), ok=False)
        item = ITEMS[item_id]
        if not item.slot:
            return self.snapshot(self._msg("equip_fail"), ok=False)
        setattr(self.player.equipment, item.slot, item_id)
        return self.snapshot(self._msg("equipped", item=item.name[self.player.language]))

    def _use(self, args: list[str]) -> PublicCommandResult:
        if not args:
            return self.snapshot(self._lang("Nutze: use <item>","Use: use <item>"), ok=False)
        item_id = self._resolve_item_id(" ".join(args))
        if not item_id or self.player.inventory.get(item_id,0) <= 0:
            return self.snapshot(self._msg("equip_missing"), ok=False)
        item = ITEMS[item_id]
        if item.category not in {"consumable","book","scroll"}:
            return self.snapshot(self._msg("not_usable"), ok=False)
        if item.category == "book":
            self.player.open_book = OpenBookState(item_id=item_id)
            return self._show_current_book_page()
        if item.category == "scroll":
            self.player.inventory[item_id] -= 1
            spell = item_id.replace("_scroll","").replace("_"," ")
            return self._cast(spell.split())
        for buff in item.buffs:
            if buff["type"] == "heal":
                self.player.hp_current = min(self.player.hp_max, self.player.hp_current + int(buff["value"]))
            else:
                self.player.buffs.append(BuffState(str(buff["type"]), int(buff["value"]), self.player.tick_value + int(buff["duration"]), item_id))
        self.player.inventory[item_id] -= 1
        return self.snapshot(self._msg("used", item=item.name[self.player.language]))

    def _read_book(self, args: list[str]) -> PublicCommandResult:
        item_id = self._resolve_item_id(" ".join(args))
        if not item_id or item_id not in ITEMS or not ITEMS[item_id].pages:
            return self.snapshot(self._msg("book_missing"), ok=False)
        self.player.open_book = OpenBookState(item_id=item_id, page_index=0)
        return self._show_current_book_page()

    def _flip_book(self, args: list[str]) -> PublicCommandResult:
        if not self.player.open_book:
            return self.snapshot(self._msg("book_none"), ok=False)
        item = ITEMS[self.player.open_book.item_id]
        if not args:
            return self.snapshot(self._lang("Nutze: book next|prev","Use: book next|prev"), ok=False)
        if args[0] == "next":
            self.player.open_book.page_index = min(len(item.pages)-1, self.player.open_book.page_index + 1)
        else:
            self.player.open_book.page_index = max(0, self.player.open_book.page_index - 1)
        return self._show_current_book_page()

    def _show_current_book_page(self) -> PublicCommandResult:
        item = ITEMS[self.player.open_book.item_id]
        page = item.pages[self.player.open_book.page_index][self.player.language]
        return self.snapshot(self._msg("read_page", title=item.name[self.player.language], page=page))

    def _resolve_item_id(self, text: str) -> str | None:
        canon = canon_item_name(text)
        for item_id, item in ITEMS.items():
            if canon == canon_item_name(item_id) or canon == canon_item_name(item.name["de"]) or canon == canon_item_name(item.name["en"]):
                return item_id
        return None

    def _parse_flag_args(self, args: list[str]) -> dict[str,str]:
        out = {}
        key = None
        current=[]
        for token in args:
            if token.startswith("--"):
                if key:
                    out[key] = " ".join(current).strip()
                key = token[2:]
                current = []
            else:
                current.append(token)
        if key:
            out[key] = " ".join(current).strip()
        return out

    def _craft(self, args: list[str]) -> PublicCommandResult:
        flags = self._parse_flag_args(args)
        if flags:
            item = flags.get("item","")
            material = flags.get("material","")
            recipe_name = f"{material} {item}".strip()
        else:
            recipe_name = " ".join(args).strip()
        if recipe_name not in RECIPES:
            return self.snapshot(self._lang("Unbekanntes Rezept.","Unknown recipe."), ok=False)
        recipe = RECIPES[recipe_name]
        for mat, qty in recipe["materials"].items():
            if self.player.inventory.get(mat,0) < qty:
                return self.snapshot(self._msg("crafted_fail", recipe=recipe_name), ok=False)
        for mat, qty in recipe["materials"].items():
            self.player.inventory[mat] -= qty
        self.player.inventory[recipe["result"]] = self.player.inventory.get(recipe["result"],0)+1
        return self.snapshot(self._msg("crafted", recipe=recipe_name))

    def _socket(self, args: list[str]) -> PublicCommandResult:
        flags = self._parse_flag_args(args)
        slot = flags.get("slot", args[0] if args else "weapon").replace("accessoire","accessory")
        gem_text = flags.get("gem", " ".join(args[2:]) if len(args) > 2 else "")
        gem_item = self._resolve_item_id(gem_text)
        if not gem_item or self.player.inventory.get(gem_item,0) <= 0:
            return self.snapshot(self._lang("Kein passender Edelstein vorhanden.","No matching gem available."), ok=False)
        dtype = GEM_COMBINATIONS_BASE.get(gem_item.replace("_shard",""))
        bonus = 6 + max(0, QUALITY_ORDER.index(ITEMS[gem_item].quality) if ITEMS[gem_item].quality in QUALITY_ORDER else 0)
        target_list = self.player.weapon_affixes if slot=="weapon" else self.player.armor_affixes if slot in {"armor","offhand"} else self.player.accessory_affixes
        target_list.append(f"socket:{gem_item}:{dtype}:{bonus}")
        self.player.inventory[gem_item] -= 1
        return self.snapshot(self._msg("socketed", gem=self._display_item(gem_item), slot=slot))

    def _enchant(self, args: list[str]) -> PublicCommandResult:
        flags = self._parse_flag_args(args)
        slot = flags.get("slot", args[0] if args else "weapon")
        bonus = 4 + self.player.enchanting_skill // 4
        affix = f"enchant:arcane:{bonus}"
        target_list = self.player.weapon_affixes if slot=="weapon" else self.player.armor_affixes if slot in {"armor","offhand"} else self.player.accessory_affixes
        target_list.append(affix)
        # 50% crit buff on weapons at high skill
        if slot=="weapon" and self.player.enchanting_skill >= 12:
            target_list.append("crit:50")
        return self.snapshot(self._msg("enchanted", slot=slot, affix=affix))

    def _soulforge(self, args: list[str]) -> PublicCommandResult:
        flags = self._parse_flag_args(args)
        slot = flags.get("slot", args[0] if args else "weapon")
        stone_text = flags.get("stone", " ".join(args[2:]) if len(args)>2 else "soulstone lesser")
        stone = self._resolve_item_id(stone_text) or stone_text.replace(" ","_")
        if self.player.inventory.get(stone,0) <= 0:
            return self.snapshot(self._lang("Kein passender Seelenstein vorhanden.","No matching soulstone available."), ok=False)
        dtype = "soul" if stone.endswith("petty") else "holy" if stone.endswith("grand") else "shadow"
        bonus = 8 if stone.endswith("petty") else 14 if stone.endswith("common") else 18
        target_list = self.player.weapon_affixes if slot=="weapon" else self.player.armor_affixes if slot in {"armor","offhand"} else self.player.accessory_affixes
        target_list.append(f"soulforge:{dtype}:{bonus}")
        self.player.inventory[stone] -= 1
        return self.snapshot(self._msg("soulforged", slot=slot, affix=f"{dtype}+{bonus}"))

    def _buy(self, args: list[str]) -> PublicCommandResult:
        item_id = self._resolve_item_id(" ".join(args))
        if not item_id:
            return self.snapshot(self._lang("Unbekannter Kaufgegenstand.","Unknown item."), ok=False)
        item = ITEMS[item_id]
        if self.player.silver + self.player.gold*MONEY_GOLD_FACTOR < item.price_silver:
            return self.snapshot(self._lang("Nicht genug Geld.","Not enough money."), ok=False)
        self.player.silver += self.player.gold*MONEY_GOLD_FACTOR - item.price_silver
        self.player.gold, self.player.silver = divmod(self.player.silver, MONEY_GOLD_FACTOR)
        self.player.inventory[item_id] = self.player.inventory.get(item_id,0)+1
        return self.snapshot(self._msg("bought", item=item.name[self.player.language], price=self._format_money(item.price_silver)))

    def _sell(self, args: list[str]) -> PublicCommandResult:
        item_id = self._resolve_item_id(" ".join(args))
        if not item_id or self.player.inventory.get(item_id,0) <= 0:
            return self.snapshot(self._lang("Diesen Gegenstand besitzt du nicht.","You do not own that item."), ok=False)
        item = ITEMS[item_id]
        self.player.inventory[item_id] -= 1
        self.player.silver += max(1, item.price_silver // 2)
        self.player.gold += self.player.silver // MONEY_GOLD_FACTOR
        self.player.silver %= MONEY_GOLD_FACTOR
        return self.snapshot(self._msg("sold", item=item.name[self.player.language], price=self._format_money(max(1, item.price_silver//2))))

    def _cube_command(self, args: list[str]) -> PublicCommandResult:
        if self._current_coord() != ROUTES["cube"]:
            return self.snapshot(self._msg("cube_far"), ok=False)
        if not args:
            return self.snapshot(self._lang("Nutze: cube enter|leave|say <frage>","Use: cube enter|leave|say <question>"), ok=False)
        sub = args[0].lower()
        if sub == "enter":
            self.player.dialogue_mode = True
            self.player.dialogue_target = "schwarzer Kubus" if self.player.language == "de" else "black cube"
            return self.snapshot(self._msg("cube_enter"))
        if sub == "leave":
            self.player.dialogue_mode = False
            self.player.dialogue_target = None
            return self.snapshot(self._msg("cube_leave"))
        if sub == "say":
            return self._cube_say(" ".join(args[1:]))
        return self.snapshot(self._lang("Der Kubus wartet nur auf Worte.","The cube only waits for words."), ok=False)

    def _cube_say(self, question: str) -> PublicCommandResult:
        chunks = call_cube_agent(question, self.player.language)
        answer = " ".join(chunks)
        self.player.cube_history.append({"q": question, "a": answer})
        self.player.journal.append(f"Kubus: {answer}")
        self._set_overlay(answer, answer, "tile_black-cube")
        return self.snapshot(answer, stream_chunks=chunks)

    def _city_command(self, args: list[str]) -> PublicCommandResult:
        if not args:
            return self.snapshot(self._lang("Nutze: city found|status|appoint|build ...","Use: city found|status|appoint|build ..."), ok=False)
        sub = args[0].lower()
        if sub == "found":
            name = " ".join(args[1:]).strip() or self._lang("Neue Stadt","New City")
            if self.player.city:
                return self.snapshot(self._msg("city_exists", name=self.player.city.city_name), ok=False)
            governor = f"Gouverneur von {name}" if self.player.language == "de" else f"Governor of {name}"
            self.player.city = CityState(city_name=name, founded_x=self.player.x, founded_y=self.player.y, governor_name=governor, generals=[GeneralState(slot=i+1,name=f"Leerer Slot {i+1}" if self.player.language=="de" else f"Empty Slot {i+1}") for i in range(5)])
            self.player.points_of_interest.add(name.lower().replace(" ","-"))
            return self.snapshot(self._msg("city_founded", name=name, governor=governor))
        if not self.player.city:
            return self.snapshot(self._lang("Du besitzt noch keine Stadt.","You do not own a city yet."), ok=False)
        if sub == "status":
            return self.snapshot(self._lang("Stadtstatus aktualisiert.","City status refreshed."))
        if sub == "appoint":
            if len(args) < 3:
                return self.snapshot(self._lang("Nutze: city appoint governor <name> oder city appoint general <slot> <name>","Use: city appoint governor <name> or city appoint general <slot> <name>"), ok=False)
            role = args[1].lower()
            if role == "governor":
                name = " ".join(args[2:])
                self.player.city.governor_name = name
                return self.snapshot(self._msg("governor_set", name=name))
            if role == "general":
                slot = int(args[2])
                name = " ".join(args[3:]) or f"General {slot}"
                if 1 <= slot <= 5:
                    self.player.city.generals[slot-1] = GeneralState(slot=slot, name=name, doctrine="balanced")
                    return self.snapshot(self._msg("general_set", slot=slot, name=name))
            return self.snapshot(self._lang("Ungültige Ernennung.","Invalid appointment."), ok=False)
        if sub == "build":
            building_key = " ".join(args[1:]).strip().lower().replace(" ", "-")
            if building_key not in BUILDINGS:
                return self.snapshot(self._lang("Unbekanntes Gebäude.","Unknown building."), ok=False)
            bd = BUILDINGS[building_key]
            city = self.player.city
            for cost_name, qty in bd.build_cost.items():
                if cost_name == "silver_coin":
                    if self.player.silver + self.player.gold*MONEY_GOLD_FACTOR < qty:
                        return self.snapshot(self._msg("building_fail", building=bd.name[self.player.language]), ok=False)
                else:
                    if self.player.inventory.get(cost_name,0) < qty:
                        return self.snapshot(self._msg("building_fail", building=bd.name[self.player.language]), ok=False)
            if city.research_points < sum(v for k,v in bd.research_cost.items() if k=="silver_coin")//10:
                # simple soft gate
                if city.research_points < 1 and building_key in {"mithril-shaft","faction-fortress","steelworks"}:
                    return self.snapshot(self._msg("building_fail", building=bd.name[self.player.language]), ok=False)
            for cost_name, qty in bd.build_cost.items():
                if cost_name == "silver_coin":
                    total = self.player.silver + self.player.gold*MONEY_GOLD_FACTOR - qty
                    self.player.gold, self.player.silver = divmod(total, MONEY_GOLD_FACTOR)
                else:
                    self.player.inventory[cost_name] -= qty
            city.buildings.append(CityBuildingState(building_id=building_key, x=self.player.x, y=self.player.y))
            return self.snapshot(self._msg("building_built", building=bd.name[self.player.language], coords=self._coord_label(self._current_coord())))
        return self.snapshot(self._lang("Unbekannter Stadtbefehl.","Unknown city command."), ok=False)

    def _militia_command(self, args: list[str]) -> PublicCommandResult:
        city = self.player.city
        if not city:
            return self.snapshot(self._lang("Du besitzt noch keine Stadt.","You do not own a city yet."), ok=False)
        if not args or args[0].lower() == "status":
            return self.snapshot(self._msg("militia_status"))
        if args[0].lower() == "recruit":
            unit_key = args[1].lower().replace(" ","-")
            if unit_key not in UNITS:
                return self.snapshot(self._lang("Unbekannte Einheit.","Unknown unit."), ok=False)
            amount = int(args[2]) if len(args) > 2 and args[2].isdigit() else 1
            cost = UNITS[unit_key].upkeep_silver * amount * 3
            if self.player.silver + self.player.gold*MONEY_GOLD_FACTOR < cost:
                return self.snapshot(self._lang("Nicht genug Silber für Rekrutierung.","Not enough silver to recruit."), ok=False)
            total = self.player.silver + self.player.gold*MONEY_GOLD_FACTOR - cost
            self.player.gold, self.player.silver = divmod(total, MONEY_GOLD_FACTOR)
            city.militia[unit_key] = city.militia.get(unit_key,0)+amount
            return self.snapshot(self._msg("militia_recruited", amount=amount, unit=UNITS[unit_key].name[self.player.language]))
        return self.snapshot(self._lang("Unbekannter Milizbefehl.","Unknown militia command."), ok=False)

    def _format_money(self, silver_value: int) -> str:
        gold, silver = divmod(max(0,silver_value), MONEY_GOLD_FACTOR)
        if self.player.language == "de":
            if gold:
                return f"{gold} Gold, {silver} Silber"
            return f"{silver} Silber"
        if gold:
            return f"{gold} gold, {silver} silver"
        return f"{silver} silver"
