# ShellRPG-www UI Audit

## Aktueller Stack
- Python-Gateway unter `src/shellrpg_www` mit same-origin Proxy auf `ShellRPG-server`
- Statische HTML-Einstiegsseite unter `public/index.html`
- Vanilla-JavaScript unter `src/app.js`
- Custom CSS unter `src/styles/base.css`
- Keine aktive Laravel-, Blade-, Livewire-, React-, Vue-, Svelte- oder Vite-Struktur im Artefakt
- Bereits vorhandene PNG- und GIF-Assets unter `public/media`

## Recherchierte Referenzen
- Bootstrap 5.3 Layout-Dokumentation fuer Container, Grid, Flex und Spacing/Gaps:
  - https://getbootstrap.com/docs/5.3/layout/containers/
  - https://getbootstrap.com/docs/5.3/layout/grid/
  - https://getbootstrap.com/docs/5.3/utilities/flex/
  - https://getbootstrap.com/docs/5.3/utilities/spacing/
- Laravel Frontend-Optionen:
  - https://laravel.com/docs/12.x/frontend
  - https://laravel.com/docs/starter-kits
- tsParticles / particles.js.org:
  - https://particles.js.org/docs/
  - https://particles.js.org/docs/modules/tsParticles_Slim_Bundle.html
  - https://particles.js.org/docs/documents/tsParticles_Engine.Options_Interactivity.html

## Aktueller UI-Zustand
- Funktional stark, visuell aber eher ein generisches Admin-/Operations-Dashboard
- `src/app.js` rendert sehr viele Panels zentral und ist fuer visuelle Iteration zu monolithisch
- Die Karte ist aktuell kein 13x13 Tactical Board, sondern eine kompakte Kartenliste bzw. ein kleines Raster
- Das Layout priorisiert Panels gleichfoermig statt klarer Center-Komposition
- Partikel-/Atmosphaeren-Layer fehlen
- Die vorhandenen Public-Assets sind brauchbar, aber nicht in einer sauberen Zukunfts-Pipeline organisiert

## Schwaechen
- Fehlende starke Karten-Hierarchie
- Fehlende Dark-Fantasy-Materialitaet
- Schwache visuelle Trennung zwischen Fokus, Nebeninformation und Langzeitdaten
- Kein konsistentes Design-System fuer Farben, Typografie, Panels und States
- Bestehende Assets haben uneinheitliche Namensmuster und keine klare Manifest-Schicht

## Chancen
- Der Server liefert bereits genug Daten fuer eine deutlich staerkere WWW-Oberflaeche:
  - Live-SSE
  - Status/HUD
  - Tile-Wissen
  - Wetterkarte
  - Controller-/Observer-Rollen
  - Markt, Journal, Combat, NPCs
- `public/media` bietet bereits genug Material fuer eine erste hochwertige Atmosphaeren-Version
- Die Web-UI kann ohne Framework-Rewrite deutlich aufgewertet werden

## Wichtige technische Beobachtungen
- Der Browser-Client laeuft bereits same-origin ueber `ShellRPG-www`
- `ShellRPG-server` bleibt autoritativ
- Die echte Live-Sichtweite aus `visible_map()` ist derzeit 9x9
- Die Wetter-API kann aber mit groesserem Radius abgefragt werden und erlaubt damit eine 13x13-ready Darstellung

## Design-Prioritaeten
1. Map-first Layout mit dominantem Center-Fokus
2. Dunkle, lesbare Dark-Fantasy-Materialitaet statt generischem Dashboard-Look
3. Ruhige Atmosphaere mit subtiler Bewegung
4. Mobile und Tablet nicht nachtraeglich, sondern bewusst mitdenken
5. Bestehende Gateway-/State-Struktur erhalten

## Risiken
- Ein kompletter Framework-Wechsel wuerde die funktionierende Delivery unnoetig destabilisieren
- Ein hartes Bootstrap-Nachruesten ohne lokale Asset-Pipeline wuerde eine neue Delivery-Abhaengigkeit einfuehren
- Die 13x13-Darstellung darf nicht vortaeuschen, dass der Server bereits echte 13x13-Fog-of-War liefert

## Architekturentscheidung
Die erste saubere Version bleibt beim vorhandenen Stack:
- Python-Gateway bleibt
- Statische HTML-Seite bleibt
- Vanilla-JS bleibt
- Kein React/Vue/Svelte/Laravel-Rewrite
- Kein Vite in dieser ersten Iteration

Begruendung:
- minimal-invasiv
- wartbar
- kein neuer Toolchain- oder Deploy-Bruch
- bestehende Live- und Gateway-Logik bleibt erhalten

Bootstrap wurde bewusst nur als Layout-Referenz ausgewertet und nicht als neue Runtime-Abhaengigkeit eingefuehrt. Die Oberflaeche uebernimmt die zugrunde liegenden Prinzipien aus Container-, Grid-, Flex- und Gap-Layout, bleibt aber lokal und repo-konform mit eigenem CSS umgesetzt.

## Empfohlene Umsetzungsstrategie
1. Dokumentiertes UI-Fundament anlegen
2. `public/index.html` in ein map-first Layout ueberfuehren
3. `base.css` in ein echtes Dark-Fantasy-Design-System umbauen
4. Karte als 13x13-ready Shell mit dominantem Center-Fokus implementieren
5. Partikel-Layer mit tsParticles plus Fallback anbinden
6. Asset-Pipeline per Manifeste und Prompt-Spezifikation ordnen

## Komponentenliste
- `TopbarChrome`
- `CommandDock`
- `StatusOracle`
- `MapShell`
- `TileGrid13x13`
- `CenterFocusTile`
- `WeatherTextOverlay`
- `RosterPanel`
- `CharacterLedger`
- `InventoryVault`
- `MarketLedger`
- `CombatWatch`
- `WeatherAtlas`
- `CommandCodex`
- `AtmosphereParticles`

