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

## 3. Installation

```bash
python -m pip install -e .
shellrpg-www --config config/shellrpg-www.toml
```

Then open in your browser:
```text
http://127.0.0.1:8080/
```

The browser only talks to `ShellRPG-www`.
`ShellRPG-www` proxies `/api/*` internally to the private `ShellRPG-server`, by default at `http://127.0.0.1:8765`.

## 4. Feedback & Contribution

Feedback should mention browser, screen size, and the affected view.
Contribution should prioritize accessibility, readability, gateway stability, and public-scope discipline.
Do not embed sensitive server logic or private operational details into web assets or publicly served routes.

🏛️🌿☠️══════════════════════════════════════════════════════════════☠️🌿🏛️
