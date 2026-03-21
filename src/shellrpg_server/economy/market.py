from __future__ import annotations

from dataclasses import dataclass

from shellrpg_server.contracts.public_api import PublicMarketEntry


@dataclass(frozen=True)
class CityMarketBaseline:
    city_name: str
    city_tier: int
    npc_merchants: int
    base_resource_bonus: int

    @classmethod
    def from_city_tier(cls, city_name: str, city_tier: int) -> "CityMarketBaseline":
        return cls(
            city_name=city_name,
            city_tier=city_tier,
            npc_merchants=city_tier,
            base_resource_bonus=city_tier * 4,
        )


CITY_TIERS = {
    "Graufurt": 3,
    "Valmora-Hain": 2,
    "Aschenwall": 2,
}


def market_for_city(city_name: str) -> list[PublicMarketEntry]:
    tier = CITY_TIERS.get(city_name, 2)
    baseline = CityMarketBaseline.from_city_tier(city_name, tier)
    if city_name == "Valmora-Hain":
        return [
            PublicMarketEntry("Eisenrindenbogen", 29, "stabil"),
            PublicMarketEntry("Weltsaft-Phiole", 17, "knapp"),
            PublicMarketEntry("Kräuterbündel", 4 + baseline.base_resource_bonus // 4, "günstig"),
        ]
    if city_name == "Aschenwall":
        return [
            PublicMarketEntry("Geweihtes Öl", 9, "steigend"),
            PublicMarketEntry("Ration", 6 + baseline.city_tier, "angespannt"),
            PublicMarketEntry("Aschesalz", 8, "knapp"),
        ]
    return [
        PublicMarketEntry("Ration", 4, "stabil"),
        PublicMarketEntry("Pilgerlaterne", 7, "stabil"),
        PublicMarketEntry("Bannkreide", 5 + baseline.city_tier, "leicht steigend"),
    ]
