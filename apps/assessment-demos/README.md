# PIE Assessment Player Demos

Demonstrations for the PIE assessment player and toolkit host integration.

## Running the Demos

The canonical demo command list lives in
[`../../docs/setup/demo_system.md`](../../docs/setup/demo_system.md). For this
app:

```bash
bun run dev:assessment -- --rebuild
bun run dev:assessment
```

For section-player, toolkit, toolbar, and tool package iteration, run the build
watcher in a second terminal:

```bash
bun run build:watch:section-tools
```

For assessment-player or shared runtime changes, rebuild the changed package
before refreshing so the demo does not load stale `dist` output.

The assessment demos run on `http://localhost:5500` by default.

Use root scripts rather than running `bun run dev` directly inside
`apps/assessment-demos`; root scripts apply shared monorepo startup behavior.
