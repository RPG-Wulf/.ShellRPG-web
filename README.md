
# ShellRPG-server · v0.4.0

**Governance:** SERVER-PRIVAT  
**Visibility:** owner-only / proprietär  
**Phase:** E — Stadtgründung, Gouverneur, 5 Generäle, Miliz-/Garnisonslogik, überarbeitetes Kampf- und Auto-Battle-System

## Enthalten
- autoritativer lokaler Demo-Server auf `http://127.0.0.1:8765`
- 4096×4096-Chunk-Weltgrundlage
- Hybridkampf: Welt in Ticks, Kampf in Runden mit Reaktionsfenstern
- Auto-Battle (`auto battle on|off|balanced|aggressive|defensive`)
- Crafting / Socketing / Enchanting / Seelenstein-Schmiede
- Händlerbefehle
- Stadtgründung
- Gouverneur + 5 Generäle
- Milizrekrutierung
- Tile-Buildings mit Kosten, Outputs, Konflikthinweisen
- schwarzer Kubus mit serverseitigem Proxy und Offline-Fallback

## Start
```bash
python -m pip install -e .
python -m shellrpg_server
```

## Wichtige Testkommandos
```text
craft --item sword --material iron
equip iron sword
socket --slot weapon --gem ruby shard
enchant --slot weapon
auto battle on aggressive
city found Morgenwacht
city appoint governor Cassian
city appoint general 1 Varek
city build trade hall
militia recruit swordfighters 2
walk route cube
cube enter
```

## Revisionsregel
Reine Bug-/Build-Fixes erhöhen die Version nicht.  
Diese Revision enthält neue funktionale Systeme und ist daher als **0.4.0 / v0.4.0** markiert.

## Redaktionsgrenze
Diese README erklärt Betrieb und Oberfläche des Demo-Slices, aber keine sensiblen Sicherheits- oder Integritätsheuristiken.
