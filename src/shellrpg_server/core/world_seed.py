from __future__ import annotations

from dataclasses import dataclass

@dataclass(frozen=True)
class TileSeed:
    tile_id: str
    label: str
    biome: str
    terrain: str
    danger: str
    description: str
    city: str | None = None


WORLD_SEEDS: dict[str, TileSeed] = {
    "graufurt_gate": TileSeed(
        tile_id="graufurt_gate",
        label="Graufurt-Osttor",
        biome="Kornmark-Auen",
        terrain="Stadttor",
        danger="niedrig",
        description="Hinter dem Osttor mischen sich Händlerlärm, Pilgerstaub und der Geruch von nassem Flussleder.",
        city="Graufurt",
    ),
    "kornmark_road": TileSeed(
        tile_id="kornmark_road",
        label="Kornmark-Handelsweg",
        biome="Kornmark-Auen",
        terrain="Handelsstraße",
        danger="niedrig",
        description="Ein offener Weg zwischen Kornfeldern. Karawanenspuren und Wagenschlamm machen den Boden schwer.",
    ),
    "blackroot_edge": TileSeed(
        tile_id="blackroot_edge",
        label="Schwarzwurzelwaldrand",
        biome="Schwarzwurzelwald",
        terrain="Waldrand",
        danger="mittel",
        description="Die Bäume stehen dicht und still. Krähen beobachten die Straße, als warteten sie auf Verspätete.",
    ),
    "mistmarsh": TileSeed(
        tile_id="mistmarsh",
        label="Nebelmoor-Steg",
        biome="Nebelmoor",
        terrain="Moorpfad",
        danger="mittel",
        description="Der Steg knarrt über schwarzem Wasser. Jeder Schritt klingt, als hörte das Moor selbst zu.",
    ),
    "valmora_hain": TileSeed(
        tile_id="valmora_hain",
        label="Valmora-Hain",
        biome="Schwarzwurzelwald",
        terrain="Hainstadt",
        danger="niedrig",
        description="Zwischen Eisenrindenbäumen und leisen Brücken liegt eine waldelfische Grenzstadt mit ruhigem Markt.",
        city="Valmora-Hain",
    ),
    "ashen_watch": TileSeed(
        tile_id="ashen_watch",
        label="Aschenwall-Vorwerk",
        biome="Aschensteppe",
        terrain="Grenzfestung",
        danger="hoch",
        description="Jenseits verrußter Palisaden beginnt das Brandland. Wachfeuer und Warnhörner halten hier die Nacht wach.",
        city="Aschenwall",
    ),
}

ADJACENCY: dict[str, dict[str, str]] = {
    "graufurt_gate": {"east": "kornmark_road", "north": "blackroot_edge", "south": "mistmarsh", "west": "valmora_hain"},
    "kornmark_road": {"west": "graufurt_gate", "east": "ashen_watch"},
    "blackroot_edge": {"south": "graufurt_gate", "west": "valmora_hain"},
    "mistmarsh": {"north": "graufurt_gate"},
    "valmora_hain": {"east": "graufurt_gate", "north": "blackroot_edge"},
    "ashen_watch": {"west": "kornmark_road"},
}

ROUTES: dict[str, str] = {
    "graufurt": "graufurt_gate",
    "valmora-hain": "valmora_hain",
    "aschenwall": "ashen_watch",
}
