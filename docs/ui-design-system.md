# ShellRPG-www Design System

## Design-Intent
- dark fantasy
- bedrueckend
- hochwertig
- ruhig
- lesbar
- taktisch

## Farbpalette
- `obsidian-950`: `#09070b`
- `obsidian-900`: `#120f15`
- `slate-850`: `#1a1720`
- `stone-700`: `#302a2a`
- `bone-100`: `#e8ddc6`
- `bone-300`: `#c5b79a`
- `ember-400`: `#b87a4a`
- `gold-400`: `#b89b62`
- `mist-400`: `#8da2a4`
- `blood-500`: `#8b3d36`

## Typografie
- Headlines: lokale Serif-Hierarchie
  - `"Palatino Linotype", "Book Antiqua", Georgia, serif`
- UI-/Fliesstext: ruhige Sans-Hierarchie
  - `"Trebuchet MS", "Segoe UI", Tahoma, sans-serif`
- Uppercase Labels sparsam und nur fuer Meta-/HUD-Elemente

## Spacing-System
- `4px` hairline / micro
- `8px` compact
- `12px` tight
- `16px` base
- `24px` comfortable
- `32px` section
- `48px` stage

## Panels
- Mehrlagige Oberflaechen statt flacher Cards
- Hintergrund: dunkle mehrfache Gradients
- Rahmen: matte Metall-/Patina-Kante
- Innere Schatten fuer Tiefe
- Leichte Highlights in Gold/Ember statt Neon

## Tiles

### Tile-States
- `normal`
- `player`
- `encounter`
- `discovered`
- `hidden`
- `danger`
- `weather-affected`
- `day`
- `night`
- `active-target`

### Tile-Regeln
- Weather immer textlich im Feld
- Center-Fokus birdseye / umliegende Tiles topdown
- Hidden Tiles zeigen Orientierung, aber keine uebertriebene Information

## Interaktionsstates
- Hover: heller Rand, leichte Hebung
- Focus-visible: goldene doppelte Kontur
- Active: dunkler Druck
- Disabled: entsaettigt, geringerer Kontrast, kein Glow

## Partikelrichtlinie
- Keine Konfetti- oder Sci-Fi-Partikel
- Sehr langsame Drift
- Niedrige Opazitaet
- Leichte vertikale Schwerkraft
- Sanfte Repulse-Reaktion auf Pointer
- Reduced motion: drastische Reduktion oder statischer Fallback

## Partikel-Presets
- `crypt_dust`
  - kalte Gruft, trockener Staub, schwer und langsam
- `graveyard_mist_dust`
  - etwas mehr Nebelpartikel, diffuse Verdriftung
- `candlelit_interior_dust`
  - waermere Akzente, weniger Partikel, stillere Luft

## Asset-Stilregeln
- photorealistisch
- topdown oder birdseye klar trennen
- keine ueberzeichnete Fantasy-Kitsch-Optik
- keine direkte ARPG-IP-Naehe in Formen, Frames, Icons

