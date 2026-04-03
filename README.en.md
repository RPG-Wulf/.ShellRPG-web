[Deutsch](README.md) | English

🏛️☠️🌿                                                                 🌿☠️🏛️
╔══════════════════════════════════════════════════════════════════════════════╗
║  _/\______________________________________________________________/\\_     ║
║  \_/\\                                                            /\_/     ║
║  /_/\\   U N R O L L E D   S C R O L L                            /\_\     ║
║  \_\/____________________________________________________________\/_/     ║
╚══════════════════════════════════════════════════════════════════════════════╝
# ShellRPG-www · v0.7.6

## 1. Description

**Artifact role:** Public web gateway and browser client for map, movement, character views, inventory, city panels, and system navigation.

**Purpose:** This artifact is the public entry layer for `www.shellrpg.tld`. It serves HTML/CSS/JS, keeps the browser on a same-origin surface, and forwards only a narrow internal API to the private `ShellRPG-server`.

**Connected artifacts:**
- `ShellRPG-server` remains the private authoritative core and exposes only the internal game API.
- `ShellRPG-client` is the shell-first sibling client.
- `ShellRPG-wiki` provides redacted documentation, lore, and usage help.

**Governance:** `CLIENT-PUBLIC`

## 2. Dependencies

- Python 3.11+
- browser with modern JavaScript support
- running `ShellRPG-server` for live data
- local or deployed WWW configuration in `config/shellrpg-www.toml`
- dynv6 secrets must stay in ignored local `secrets/` or `var/` files

## 3. Installation

```bash
python -m pip install -e .
shellrpg-www --config config/shellrpg-www.toml
```

Or use the lightweight wrapper:

```bash
./shell.sh
```

Then open in your browser:
```text
http://127.0.0.1:8080/
```

The browser only talks to `ShellRPG-www`.
`ShellRPG-www` proxies `/api/*` internally to the private `ShellRPG-server`, by default at `http://127.0.0.1:8765`.
It also serves `/asset/*` same-origin, preferring the GitHub-backed
`ShellRPG-cdn` path and then dynv6 and local workspace fallbacks.
Relative config, secret, and asset-origin paths are resolved against the WWW
endpoint or the loaded config file.
- the browser now also consumes the explicit matrix diagnostics contract
  `GET /api/matrix/health` to render a same-origin `Server Matrix` panel for
  WWW/gateway diagnostics
- that panel now also renders condensed per-character merge conflicts,
  including merge groups such as knowledge, progress, and inventory
- each character conflict now also exposes an expandable drilldown with field
  lists and short compare/import hints per conflict
- if an older server does not know that endpoint yet, or temporarily fails to
  deliver it, `ShellRPG-www` falls back to a readable notice and keeps the
  rest of the UI working

`ShellRPG-www` remains a Python gateway, not a TYPO3/TypoScript CMS endpoint.
If a future CMS is ever needed, it should be planned separately; only then
would a dedicated `tx_shellrpg_*` plugin line make sense.

Current canon preparation:
- redacted WWW views must be ready to distinguish monster, hive, wildlife,
  nature, and demons more clearly
- inventory and status views are being prepared for six ring slots per
  character
- map tooltips can now surface a redacted tile `Milieu` from the server map
  payload; the WWW layer intentionally avoids introducing its own parallel
  wording for the same public-safe hint
- the same public contract now also carries a redacted
  `urban_suspicion_line`; map tooltips, focus areas, and city views may show
  that urban hint without inventing separate browser-side suspicion logic
- the same public contract now also carries a redacted
  `urban_diagnosis_line` from the persisted urban suspicion pool; WWW
  tooltips, focus areas, and city views remain tied to the same server-side
  subject refs, hint refs, and relation ids

## 4. Feedback & Contribution

Feedback should mention browser, screen size, and the affected view.
Contribution should prioritize accessibility, readability, gateway stability, and public-scope discipline.
Do not embed sensitive server logic or private operational details into web assets or publicly served routes.

🏛️🌿☠️══════════════════════════════════════════════════════════════☠️🌿🏛️
