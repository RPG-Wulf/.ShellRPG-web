# ShellRPG-www UI Plan

## Zielbild
Ein map-first Dark-Fantasy-Interface, das den gemeinsamen serverautoritativen Zustand lesbar, atmosphaerisch und taktisch praesentiert.

## Informationsarchitektur

### 1. Topbar
- Produktidentitaet
- Live-/Session-/Rollenindikatoren
- Ort, Wetter, Zeit als schnelle Lageeinschaetzung

### 2. Command Dock
- Kommandofeld
- Quick Actions
- Sprache
- Save/Recover/Refresh

### 3. Hauptbuehne
- Center-Fokus mit Szene / Encounter / Overlay-Text
- 13x13 Tactical Map als primaerer Orientierungsraum

### 4. Linke Rail
- Status / Charakterkern
- Rollenmodell / Observer vs. Controller
- Roster / Charaktererstellung

### 5. Rechte Rail
- Charakter- und Inventarbereich
- Markt / Kampf / Journal / Command-Codex

### 6. Untere Sektion
- Stadt / Wetter / Recovery / NPCs / Brewing / Enchanting / Artifact Weave / Asset Browser

## Wireframe in Textform

```text
+----------------------------------------------------------------------------------+
| Topbar: Brand | Live | Rolle | Ort | Wetter | Zeit                              |
+----------------------------------------------------------------------------------+
| Command Dock: Input | Actions | Language | Save / Recover / Refresh             |
+---------------------------+--------------------------------+----------------------+
| Left Rail                 | Main Stage                     | Right Rail           |
| StatusOracle              | Scene Focus                    | CharacterLedger      |
| RosterPanel               | 13x13 TileGrid13x13            | InventoryVault       |
| Weather/Recovery Summary  | CenterFocusTile overlay        | Market / Combat      |
+---------------------------+--------------------------------+----------------------+
| Lower Grid: City | WeatherAtlas | Recovery | NPCs | Brew | Enchant | Weave       |
+----------------------------------------------------------------------------------+
```

## Komponenten- und State-Liste

### Kernzustand
- `latestSnapshot`
- `weatherMap`
- `weatherRegions`
- `characterRoster`
- `npcs`
- `npcMenu`
- `recoveryConflicts`
- `recoveryHistory`
- `brewingCatalog`
- `enchantingCatalog`
- `artifactWeave`
- `liveConnectionState`

### Abgeleitete UI-States
- `mapShellModel`
- `selectedTile`
- `particlePreset`
- `isObserver`
- `isWriteLocked`
- `isReducedMotion`

## Responsives Verhalten

### Desktop
- Drei-Spalten-Komposition
- Karte und Center-Fokus dominieren

### Tablet
- Rails stapeln unter oder neben der Buehne
- Command Dock bleibt frueh sichtbar

### Mobile
- Karte zuerst
- Rails werden zu gestapelten Sektionen
- Command Dock in eine vertikale Steuerleiste
- Panels scrollen, aber Kern-HUD bleibt lesbar

## Umsetzungsreihenfolge
1. Neues Shell-Layout in HTML
2. Design-Tokens und Panels in CSS
3. 13x13-Map-Shell
4. Atmosphaeren-Layer
5. Sekundaere Panels auf neue Designsprache bringen
6. Asset-Pipeline-Spezifikation und Prompts

