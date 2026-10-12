# PIE Item Player Demos

Demonstrations of `<pie-item-player>` rendering individual PIE items. The
catalog at `/` lists the demos registered in `src/lib/content/`, one module
each, covering the pie-elements-ng item types.

## Running the Demos

The canonical demo command list lives in
[`../../docs/setup/demo_system.md`](../../docs/setup/demo_system.md). For this
app:

```bash
bun run dev:item -- --rebuild
bun run dev:item
```

For section-player, toolkit, toolbar, and tool package iteration, run the build
watcher in a second terminal:

```bash
bun run build:watch:section-tools
```

For item-player or shared runtime changes, rebuild the changed package before
refreshing so the demo does not load stale `dist` output.

The item demos run on `http://localhost:5301` by default.

Use root scripts rather than running `bun run dev` directly inside
`apps/item-demos`; root scripts apply shared monorepo startup behavior.

## Technical Details

### Technology Stack

- **Framework:** SvelteKit with `@sveltejs/adapter-node`
- **Styling:** Tailwind CSS v4 + DaisyUI v5
- **Player:** PIE Item Player, `iife` strategy by default
- **Elements:** Loaded from the PIE bundle host (`https://proxy.pie-api.com/bundles/`)

### Element Loading

The demos default to `strategy="iife"`, which loads each element's complete
bundle from the PIE bundle host and works with `@latest` element versions.
The delivery and author views switch to `esm`, and the delivery view can then
register the installed ESM builds before the player mounts (`preloaded`).

### Element Version Overrides

Delivery and author views include an element version toolbar.

- Overrides are stored in URL params as `pie-overrides[pie-element/<name>]=<version>`
- Base catalog defaults still come from each demo's `config.elements` map
- `GET /api/packages` powers combobox version suggestions via npm registry lookup

The server npm helper is imported from `@pie-players/demo-ui/server/npm-registry`
and must remain server-only (route/load modules only, never Svelte/browser code).

## For Developers

### Content Files

Each item demo is a TypeScript module `{id}.ts` that default-exports a `DemoInfo` object (see `types.ts`). `index.ts` imports each module explicitly and builds the sorted catalog from its `publicDemos` list.

### Customizing Demos

Edit or add `src/lib/content/{id}.ts` modules. Each default-exports a `DemoInfo` value (`types.ts`): catalog fields (`id`, `name`, `description`, `sourcePackage`, …) and `item` (`Partial<ItemEntity>` with `config`). **Do not** put `initialSession` in demo files: the app starts from an empty session container unless you add an entry for that demo id in `src/lib/demo-session-seeds.ts` (only when iife delivery requires a non-empty seed).

### Item Player Configuration (IIFE Strategy)

The item player accepts these key props:

```svelte
<pie-item-player
  config={JSON.stringify(itemConfig)}
  session={JSON.stringify({ id: 'session-id', data: [] })}
  env={JSON.stringify({ mode: 'gather', role: 'student' })}
  strategy="iife"
></pie-item-player>
```

**Props:**
- `config` - Item configuration (elements, models, markup)
- `session` - Session data for tracking student responses
- `env` - Environment settings (mode: gather/view/evaluate, role: student/instructor)
- `strategy` - Loading strategy (`iife`, `esm`, `preloaded`)
- `loaderOptions.bundleHost` - PIE bundle host URL (for `iife`)

**Modes:**
- `gather` - Student taking assessment (can interact)
- `view` - View-only mode (no interaction)
- `evaluate` - Show correct answers and feedback

**Route query normalization:**
- `?mode=evaluate&role=student` is safety-coerced to `mode=gather`
- `?mode=evaluate&role=instructor` stays in scorer/evaluate behavior

### Adding New Demos

1. Add `src/lib/content/{unique-id}.ts` default-exporting `DemoInfo`, then register it in `index.ts` (import + add to the `publicDemos` array).
2. Open the catalog at `/` and follow the new card to `/demo/{unique-id}/delivery`.
3. If delivery fails with an empty session, add `{unique-id}` to `src/lib/demo-session-seeds.ts` instead of embedding session data in the demo module.

## License

MIT
