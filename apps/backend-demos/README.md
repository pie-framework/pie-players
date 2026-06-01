# Backend Demos

Focused demos for host integrations that use `<pie-item-player>` with a backend
adapter.

## Delivery Demo

The root route renders one `<pie-item-player>` and wires `backend.delivery` to a
local, unauthenticated API that mirrors the subset of `pie-api-aws` used by
`pie-api-player`:

- `POST /api/player/load`
- `POST /api/player/save`
- `POST /api/player/model`
- `POST /api/player/score`

The demo intentionally omits PIE API production concerns such as auth,
sanctioned versions, override scopes, score caching, manual-score precedence,
and release flows. It uses a small SQLite datastore in the OS temp directory so
load, autosave, explicit save, and reload hydration are visible without external
services.

The important production idea is that the backend is not just storage. Raw item
config in the database can contain authoring data such as correct responses. In
student delivery, hosts should send controller-processed models to the browser
instead of that raw config. This demo therefore runs:

- controller `model()` in `POST /api/player/load` and `POST /api/player/model`,
  so student-facing models can be filtered before rendering.
- controller `outcome()` in `POST /api/player/score`, so scoring logic does not
  have to live in the student browser.

The save endpoint remains intentionally simple: it persists the current session
data and returns the saved session.

The canonical demo command list lives in
[`../../docs/setup/demo_system.md`](../../docs/setup/demo_system.md). Run this
demo from the monorepo root:

```bash
bun run dev:backend
```

The backend demo runs on `http://localhost:5600` by default.
