# knghtmgr web extraction

Source: `n-e-o-w-u-l-f/knghtmgr` at `044baeca25877a6e00bdda6df0553f05d4210dd3`.

The complete legacy WebAssembly crate is preserved byte-for-byte under
`legacy-source/crates/web`. It remains documentation evidence and is not built
or loaded by ShellRPG-web.

## Authoritative mapping

| Legacy WebGame behavior | ShellRPG-web destination |
| --- | --- |
| Constructor-owned local `GameState` | Server login plus account/session state |
| Local `tick()` | Server ticks delivered through snapshot/SSE |
| Local `command(cmd)` | Same-origin `POST /api/command` gateway path |
| Local pending-prompt answer | Server reaction/control contract |
| Serialized local events | Public result payload and live-event stream |
| Local state in browser memory | Server savepoints and account persistence |

This is an intentional refactor boundary: the browser may render and request actions,
but it must not become a second authority. The existing status panel, journal, market,
inventory, and map features already consume the server contract.

The gateway also passes the migrated authenticated `/api/status/text` endpoint
without inventing a separate web-side formatter.

## Verification

```powershell
python -m pytest
python -m compileall -q src tests
npx fallow audit --base origin/main --format json --quiet --explain
```
Compare the preserved crate:

```powershell
git diff --no-index -- C:\Users\megal\Projekte\n-e-o-w-u-l-f\knghtmgr\crates\web docs\migrations\knghtmgr\legacy-source\crates\web
```

An empty diff proves byte-for-byte source preservation. Fallow applies only to the
active JavaScript/CSS product surface, not the inert Rust reference capsule.
