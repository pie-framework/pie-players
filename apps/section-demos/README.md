# PIE Section Player Demos

Demonstrations of the PIE Section Player rendering QTI 3.0 assessment sections.
The catalog at `/` links every demo registered in `src/lib/content/sections.ts`
to its route under `src/routes/(demos)/`; the section content lives in
`src/lib/content/`. The `invalid-tools-config` demo exercises framework-owned
error handling: console diagnostics, the fallback UI and the `framework-error`
event (`runtime.onFrameworkError`).

## Running the Demos

The canonical demo command list lives in
[`../../docs/setup/demo_system.md`](../../docs/setup/demo_system.md). For this
app:

```bash
bun run dev:section -- --rebuild
bun run dev:section
```

For tool/package iteration, run the build watcher in a second terminal:

```bash
bun run build:watch:section-tools
```

The section demos run on `http://localhost:5300` by default.

Use root scripts rather than running `bun run dev` directly inside
`apps/section-demos`; root scripts apply the shared `.env` loading and
consistent monorepo startup behavior.

## Technical Details

### Technology Stack
- **Framework:** SvelteKit with `@sveltejs/adapter-node`
- **Styling:** Tailwind CSS v4 + DaisyUI v5
- **Player:** PIE Section Player (QTI 3.0)
- **Elements:** PITS bundles under `iife`, jsDelivr (`https://cdn.jsdelivr.net/npm`) under `esm`, the installed pie-elements-ng packages under `preloaded`

### Element Loading
`?player=esm` loads each element's browser build from jsDelivr. npm `latest` of `@pie-element/*` is the legacy line, which ships no browser ESM, so under esm the demos rewrite content to the pie-elements-ng versions [`demo-ui`](../demo-ui/package.json) installs. demo-ui depends on each package at the `next` dist-tag, where pie-elements-ng publishes; `bun.lock` pins the versions, and `bun update` in `apps/demo-ui` moves them together to the newest release. `bun run dev:section:cdn` loads them from a local pie-elements-ng build instead; see [demo workspace resolution](../../docs/development/demo-workspace-resolution.md).

`?player=preloaded` is the ESM builds as a host bundles them: before the player mounts, the page imports each element's `./browser/delivery` and `./browser/controller` from those installed packages and registers them through `registerPreloadedElements`, with jsDelivr as MathJax's [asset root](../../docs/item-player/loading-strategies.md#mathjax-assets), and the players load no element code. The players align each authored version to the installed one. The `preloaded-npm-elements` demo does the same with static imports of its own dependencies, as a host's page is written.

## For Developers

### Customizing Demos
To modify content, edit the files in `src/lib/content/`. Each file exports an `AssessmentSection` object with:
- Section metadata (identifier, title)
- `keepTogether: true` for page mode
- Rubric blocks (passages, instructions)
- Item references (questions with PIE element configs)

### Configuring Player Runtime
The per-demo routes (`/single-question`, `/session-hydrate-db`, etc.) render the section player host. To switch strategies, use query params:

- `?player=iife` (default)
- `?player=esm`
- `?player=preloaded`

Use `?mode=candidate` or `?mode=scorer` to switch environment role/mode. The host translates these to item-compatible env values (`{ mode, role }`) and sets them as `runtime.env` on the layout element.

**Supported CDNs:**
- **jsDelivr:** `https://cdn.jsdelivr.net/npm` (recommended, used in demos)
- **esm.sh:** `https://esm.sh`

The ESM player defaults to jsDelivr and URL-based module resolution (`moduleResolution: "url"`). Override `loaderOptions.esmCdnUrl` to use a different CDN, or set `moduleResolution: "import-map"` when import-map behavior is needed.

### Item-level observability in demos/hosts

To configure item-level resource observability for section-player hosts, pass `loaderConfig` through
`runtime.player` as a JS property object:

```ts
host.runtime = {
  playerType: "esm",
  player: {
    loaderConfig: {
      trackPageActions: true,
      instrumentationProvider: customProvider,
    },
  },
};
```

Use `loaderOptions` only for module/bundle loading behavior. Use `loaderConfig` for resource monitor observability/retry behavior.

### SC TTS Proxy Demo Config

TTS-focused demos can opt into an SC-style custom transport through the local
proxy route. The two SSML-focused routes (`tts-ssml` and `tts-generated-ssml`)
use the SSML-capable AWS Polly transport at `/api/tts` so authored and generated
SSML are actually voiced.

- Client endpoint: `POST /api/tts/sc`
- Required server env vars (no defaults):
  - `TTS_SCHOOLCITY_URL`
  - `TTS_SCHOOLCITY_API_KEY`
  - `TTS_SCHOOLCITY_ISS`
- Optional:
  - `TTS_SCHOOLCITY_ASSET_ORIGINS` — comma-separated exact-origin allow-list
    for synthesized audio / speech-mark asset fetches. When unset, the provider
    defaults to allowing `TTS_SCHOOLCITY_URL`'s origin plus any host on the
    same registrable domain (so a service at `tts.example.com`
    automatically permits `tts-cdn.example.com` without further
    config). Set this env var to switch to a strict exact-origin allow-list
    (recommended for production for audit and typo resistance).

This keeps upstream auth/signing material server-side.

Positioning notes:

- SchoolCity is used here as an example of a host-owned TTS API.
- This is a demo-host integration pattern (custom provider + proxy route), not a toolkit default.
- The custom provider appears in the TTS settings panel as the `demo-custom-provider` tab,
  showing how to plug in backend-specific preview/apply behavior without changing toolkit defaults.

### Adding New Demos
1. Create content file in `src/lib/content/demoX-*.ts`
2. Register the demo in `src/lib/content/sections.ts`
3. Add its route at `src/routes/(demos)/<demo-id>/`: a `+page.ts` that returns `loadDemoRouteDataById("<demo-id>", url)` and a `+page.svelte` host
4. Confirm it appears on the landing page (`src/routes/+page.svelte`), which links each registered demo to `/<demo-id>`

### Session Hydration Demo Notes
- Route id: `session-hydrate-db`
- Backend storage is server-side SQLite (no manual setup required)
- Demo startup bootstraps seeded records for two sections in the DB
- Hydration is enabled from startup so state handoff is visible immediately
- **Load from DB** remains available as a manual re-hydrate action
- **Reset DB** clears backend records for the active attempt scope
- The **DB panel** uses Server-Sent Events (SSE) for live backend updates
- DB controls live in the **Session DB (Server)** panel (`Load from DB`, `Reset DB`)
- Use the DB panel to inspect scoped raw table rows and reconstructed snapshots for the active section/attempt

## License

MIT
