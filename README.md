# ShellRPG-www

**Governance:** `CLIENT-PUBLIC`  
**Release:** `v0.3.0`

## Rolle
Vollwertiger zweiter Public Client gegen denselben serverautoritiven Slice wie der Terminal-Client.

## Phase-D-Funktionen
- Status-Panel mit GIF-Verlinkung
- Kartenausschnitt mit Fog-of-War-Zuständen
- Inventar/Ausrüstung
- Händleransicht
- Journal, Quests und Buffs
- freie Command-Eingabe gegen denselben Server

## Lokaler Start
```bash
python -m http.server 8080
```
Dann im Browser öffnen:
```text
http://127.0.0.1:8080/public/index.html
```

## Hinweis
Der Kubus-Dialog läuft ebenfalls über den Server. Das WWW überträgt nur Befehle; der eigentliche OpenAI-Proxy bleibt privat.
