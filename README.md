# ShellRPG-www

**Governance:** CLIENT-PUBLIC  
**Visibility:** public  
**Version:** `v0.0.2`

Grafischer Public Client für **Bauphase B / Vertical Slice**.

## Enthalten

- echte Verbindung zum lokalen autoritativen Demo-Server
- Status-, Karten-, Inventar-, Markt- und Journal-Panels
- Befehlseingabe für `look`, `inspect`, `walk`, `gather`, `hunt`, `explore`
- redigierte Command-/Review-Spiegelung

## Start

1. Server starten:

```bash
python -m shellrpg_server
```

2. WWW statisch ausliefern:

```bash
python -m http.server 8080
```

3. Browser öffnen:

`http://127.0.0.1:8080/public/index.html`

## Hinweis

Dieser Slice ist bewusst buildarm gehalten: kein Node-Tooling, keine Bundlerpflicht, nur ein lokaler statischer Start für schnelle Revisionen.
