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

## Maintenance Note

- For relevant content, contract, feature, or editorial changes touching this
  endpoint, update `README.md`, `README.en.md`, and `VERSION` together.

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
- each character conflict now also exposes an expandable drilldown with real
  field comparisons for preferred state, opposing state, and merged result,
  plus short compare/import hints per conflict
- larger inventory/knowledge merges now also surface delta badges and
  server-prepared short diffs against the winning side, so important
  changes stay readable at a glance
- for very large merges the drilldown now also consumes server-weighted
  `priority_preview` entries and visually separates `plus` from `upgrade`
  hints; that prioritization now also includes domain weighting for more
  important POIs, higher-value resources, and more critical progress flags
- those prioritized entries now also carry a short `reason`, so the
  drilldown can show not only what floats to the top, but also why
- the same contract now also carries a stable `reason_code`; WWW uses it
  for compact categories such as `critical`, `rare`, or `strategy` without
  guessing from free-form text
- the same panel now also renders hotspots for notable characters,
  categories, and peers, carries stable `conflict_id`/`field_conflict_id`
  anchors, shows compact conflict history via `seen_count`/`still_open`,
  and exposes severity/category filters plus sort modes such as `critical
  first`, `newest first`, and `most merges first`
- when short diffs are truncated, the drilldown now also renders
  truncation-aware rollups such as hidden reason-code and severity counts so
  very large merge cases remain readable
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
- the same city panel now also renders `development stage:` and
  `protection/occupation status:` as direct lines instead of hiding those
  hints only inside generic list blocks
- that same city panel now also reflects dynamic server-side protectorate
  levies, occupation pressure, and autonomy recovery without inventing its
  own browser-side war or occupation logic
- the same city panel now also renders `city field limits:` from the
  server-side development stage profile; early civilization stages may
  therefore redact diagnosis, hint, or diplomacy fields instead of assuming
  they always exist in the browser
- the same NPC interaction panel now also exposes a redacted `dialogue
  limit:` and consumes stage-dependent service, quest-step, and faction
  interpretation reductions directly from the server contract
- those same city and NPC views now also render `city carrier:`,
  `material basis:`, and `armory basis:` directly from the server contract
- `Neutral Communes` can therefore now appear in the browser as explicit
  multiethnic city carriers without the WWW layer inventing its own
  governance or faction logic
- NPC craftables now follow the same server-side material/recipe basis
  instead of relying only on placeholder preview lists
- the same NPC panel now also renders server-driven `economy profile:`,
  `trade focus:`, `service focus:`, and `craft focus:` lines plus
  `role craftables:` for dynamic trader/mechanic profiles
- `npc buy ...` and `npc service ...` in the browser are therefore no
  longer limited to legacy-only NPC roles, but also consume profession-
  driven trader/workshop paths derived from the same carrier/material basis
- the same WWW NPC panel now also reads `offer rotation:` and `market
  dynamics:` plus visible per-item surcharges or discounts from the server
  contract, so role holders, city stock, and faction specialties no longer
  appear as a static goods list
- those same city and NPC panels now also read `regional scarcity:`,
  `build profile:`, and `special resources:` directly from the server
  contract, so regional trade scarcity and faction build profiles do not
  need to be reconstructed in the browser
- those same city and NPC panels now also read `regional yield:` and
  `shard pressure:` directly from the server contract, so specialty finds
  and first controlled shard stock do not need to be guessed in the browser
- those same city and NPC panels now also read `demand:`, `storage
  pressure:`, and `caravan flow:` directly from the server contract, so
  city storage, throughput, and long-range need do not need to be rebuilt
  in the browser
- the same WWW city panel now also reads `construction capacity:` plus a
  dedicated `construction sites` block from the server contract, so
  parallel build orders and their tick progress stay visible
- the market panel stays tied to that same server contract: price reasons
  may now combine weather pressure with regional scarcity, while specialty
  wares such as `Infernit`, `Magnetite Lens`, or `Bog Amber Charm` fall
  into the same visible market logic
- those same market and NPC views may now also surface public `trade flow`
  and `caravan throughput` price reasons whenever city storage or imported
  wares visibly shift that same server market
- the same market and NPC views may now also surface extra shard wares such
  as `Ruby`, `Obsidian`, `Emerald`, `Opal`, or `Zircon Shards` from that
  same server-driven regional and carrier logic

## 4. Feedback & Contribution

Feedback should mention browser, screen size, and the affected view.
Contribution should prioritize accessibility, readability, gateway stability, and public-scope discipline.
Do not embed sensitive server logic or private operational details into web assets or publicly served routes.

🏛️🌿☠️══════════════════════════════════════════════════════════════☠️🌿🏛️
