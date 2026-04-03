Deutsch | [English](README.en.md)

🏛️☠️🌿                                                                 🌿☠️🏛️
╔══════════════════════════════════════════════════════════════════════════════╗
║  _/\______________________________________________________________/\\_     ║
║  \_/\\                                                            /\_/     ║
║  /_/\\   A U F G E R O L L T E   S C H R I F T R O L L E         /\_\     ║
║  \_\/____________________________________________________________\/_/     ║
╚══════════════════════════════════════════════════════════════════════════════╝
# ShellRPG-www · v0.7.6

## 1. Beschreibung

**Artefaktrolle:** Öffentlicher Web-Gateway und Browser-Client für Karte, Bewegung, Charakterübersicht, Inventar, Stadt- und Systemansichten.

**Zweck:** Dieses Artefakt ist die öffentliche Eintrittsschicht für `www.shellrpg.tld`. Es liefert HTML/CSS/JS aus, hält die Browser-Kommunikation auf Same-Origin und reicht nur eine schmale interne API an den privaten `ShellRPG-server` weiter.

**Verknüpfte Artefakte:**
- `ShellRPG-server` bleibt der private autoritative Kern und liefert nur die interne Spiel-API.
- `ShellRPG-client` ist der shellnahe Schwester-Client.
- `ShellRPG-wiki` liefert redigierte Dokumentation, Lore und Bedienhilfen.

**Governance:** `CLIENT-PUBLIC`

## 2. Abhängigkeiten

- Python 3.11+
- Browser mit modernem JavaScript-Support
- laufender `ShellRPG-server` für echte Daten
- lokale oder deployte WWW-Konfiguration in `config/shellrpg-www.toml`
- dynv6-Secrets nur lokal in ignorierten `secrets/`- oder `var/`-Dateien

## 3. Installation

```bash
python -m pip install -e .
shellrpg-www --config config/shellrpg-www.toml
```

Oder als schlanker Wrapper:

```bash
./shell.sh
```

Dann im Browser öffnen:
```text
http://127.0.0.1:8080/
```

Der Browser spricht dabei nur mit `ShellRPG-www`.
`ShellRPG-www` proxyt `/api/*` intern an den privaten `ShellRPG-server`, standardmäßig nach `http://127.0.0.1:8765`.
Zusätzlich liefert `ShellRPG-www` jetzt `/asset/*` same-origin aus und
bevorzugt dabei den GitHub-backed `ShellRPG-cdn`-Pfad, danach dynv6- und
lokale Workspace-Fallbacks.
- relative Config-, Secret- und Asset-Origin-Pfade werden stabil relativ zum
  WWW-Endpunkt bzw. zur geladenen Config aufgeloest
- der Browser nutzt jetzt zusaetzlich den expliziten Matrix-/Diagnosevertrag
  `GET /api/matrix/health`, um einen same-origin `Servermatrix`-Panelpfad
  fuer WWW-/Gateway-Diagnostik aufzubauen
- dieser Panelpfad zeigt feldweise Character-Konflikte jetzt zusaetzlich
  verdichtet pro Figur an, inklusive Merge-Gruppen wie Wissensstand,
  Fortschritt und Inventar
- pro Character-Konflikt gibt es dort jetzt einen aufklappbaren Drilldown mit
  Feldlisten sowie kurzen Vergleichs- und Importhinweisen je Konflikt
- falls ein aelterer Server den Endpunkt noch nicht kennt oder temporaer
  nicht liefert, faellt `ShellRPG-www` ruhig auf einen lesbaren Hinweis
  zurueck und haelt die restliche UI weiter funktionsfaehig

`ShellRPG-www` bleibt bewusst ein Python-Gateway und kein TYPO3-/TypoScript-
CMS-Endpunkt. Falls spaeter ein CMS noetig wird, sollte es getrennt vom
Spiel-Gateway geplant werden; erst dann ist eine separate `tx_shellrpg_*`-
Plugin-Linie sinnvoll.

Aktuelle Kanonvorbereitung:
- redigierte WWW-Ansichten muessen Monster, Hive, Wildlife, Natur und
  Daemonen kuenftig klarer unterscheiden
- Inventar- und Statusansichten werden auf sechs Ringslots pro Charakter
  vorbereitet
- Kartentooltips koennen jetzt redigierte Tile-Welthinweise wie ein
  `Milieu` aus dem serverseitigen Kartenpayload anzeigen; die WWW-Schicht
  fuehrt dafuer bewusst keine eigene Parallelterminologie ein
- derselbe Public-Vertrag traegt jetzt auch eine redigierte
  `urban_suspicion_line`; Kartentooltips, Fokusbereich und Stadtansicht
  duerfen diesen Stadthinweis anzeigen, ohne eigene Verdachtsregeln im
  Browser zu erfinden
- derselbe Public-Vertrag traegt jetzt auch eine redigierte
  `urban_diagnosis_line` aus dem persistierten urbanen Verdachtspool; WWW-
  Tooltips, Fokusbereich und Stadtansicht bleiben dabei an denselben
  serverseitigen Subject-/Hint-/Relations-Refs gebunden

## 4. Feedback & Contribution

Feedback sollte Browser, Auflösung und betroffene Ansicht nennen.
Contribution soll auf Zugänglichkeit, Lesbarkeit, Gateway-Stabilität und Public-Scope achten.
Keine sensiblen Serverlogiken oder geheimen Betriebsdetails in Web-Assets oder öffentlich ausgelieferten Routen einbetten.

🏛️🌿☠️══════════════════════════════════════════════════════════════☠️🌿🏛️
