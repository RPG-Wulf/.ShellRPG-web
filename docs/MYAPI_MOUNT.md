# myAPI mount contract

`ShellRPG-www` remains internally root-relative. The shared ingress owns the
public `/idle-quest/` prefix and removes that prefix exactly once before a
request reaches this gateway.

Examples:

- `/idle-quest/` -> `/`
- `/idle-quest/public/index.html` -> `/public/index.html`
- `/idle-quest/api/matrix/health` -> `/api/matrix/health`

The same public prefix is also used by the embedded IdleQuest viewport API.
Those currently proven exact routes are owned by `RPG-Wulf/.idleQuest` and
must never fall through to this gateway:

- `/api/health`
- `/api/state`
- `/api/world`
- `/api/command`

The machine-readable contract is `config/myapi-mount.json`. Any new route that
would overlap with another `/idle-quest/` owner must first be made explicit in
both project descriptors and the shared `.myAPI` registry. Silent ownership by
proxy-order alone is not an accepted deployment state.
