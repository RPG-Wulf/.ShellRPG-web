# ShellRPG-www

**Governance:** CLIENT-PUBLIC  
**Sichtbarkeit:** veröffentlichbar  
**Baseline-Version:** `0.0.1a`

## Zweck

`ShellRPG-www` ist der vollwertige grafische Web-Client für denselben serverautoritiven Kern wie `ShellRPG-client`.

Dieser Foundations-Stand enthält:

- modulare Seiten- und Feature-Struktur
- Grundlayout für Dashboard, Karte, Inventar, Markt und Journal
- UX-Grundlinien
- i18n-Struktur
- harmlose Admin-Review-Stub-Oberflächen
- Packaging- und Dokumentationsbasis

## Foundations-Entscheidung

Dieser Stand verwendet absichtlich **vanilla HTML/CSS/ES modules** als leichtgewichtige Foundations-Basis.  
Damit bleibt Bauphase A:

- transparent
- sofort lesbar
- bundler-unabhängig
- leicht in späteres Framework-Migration-Design überführbar

Ein späterer Wechsel zu React/Vue/Svelte bleibt möglich, ohne Artefaktgrenzen neu zu ziehen.

## Struktur

- `public/index.html` – Einstiegsseite
- `src/app.js` – Modulstart
- `src/features/` – Karten-, Status-, Markt-, Inventar- und Review-Skelette
- `src/i18n/` – Sprachschlüssel
- `docs/` – UX-, Architektur- und Accessibility-Notizen

## Revisions- und Versionsregel

Reine Fixes erhöhen die Versionsnummer nicht.

## Nächste empfohlene Phase

- echte Session-Anbindung
- Kartenansicht mit FOW-Stufen
- Status- und Aktionspanels
- Marktübersicht
- Journal / Questpane
- Reviewliste für Rätsel im redigierten Public-Umfang

## Wichtige Dateien

- `shellrpg.manifest.toml`
- `public/index.html`
- `src/app.js`
- `src/features/map/mapView.js`
- `docs/www-ux-foundations.md`
