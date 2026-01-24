# pie-fixed-player

A PIE player custom element designed for static builds with pre-bundled element combinations.

## Concept

Unlike `pie-inline-player` which dynamically fetches PIE element bundles at runtime, `pie-fixed-player` is designed to work with element bundles that are included at build time. This results in potentially a huge load performance difference over the dynamic way of loading, but comes at the price of less flexibility. And the more question types (PIE elements) you want to support, the larger this bundle gets. Also, average load times should drastically improve with the ESM player that we are working towards adopting. Nevertheless, if load times are important for your case, this package is worth considering.

This approach is optimized for:

- Clients with a fixed set of question types (PIE elements)
- Environments where JS bundle size is acceptable for faster runtime performance
- Use cases where element versions can be frozen at build time

## Architecture

### Package Distribution

Packages are published with hash-based versioning:

```text
@pie-framework/pie-fixed-player-static@1.0.1-a3f8b2c.1
```

Where:

- `1.0.0` = loader implementation version
- `a3f8b2c` = SHA-256 hash of element combination (deterministic)
- `.1` = iteration number for bug fixes

### What's Included

Each package contains:

1. **Compiled custom element** (`pie-fixed-player`)
2. **Pre-fetched IIFE bundle** from PITS with all elements
3. **Manifest** in package.json listing included elements
4. **Loader logic** optimized for pre-loaded elements

### Key Differences from pie-inline-player

| Feature             | pie-inline-player         | pie-fixed-player            |
| ------------------- | ------------------------- | --------------------------- |
| Bundle loading      | Dynamic (runtime)         | Static (build time)         |
| API endpoint        | `/api/item/{id}/packaged` | `/api/item/{id}/data-only`  |
| Response size       | Large (includes bundles)  | Small (data only)           |
| Element flexibility | Any elements              | Fixed at build time         |
| Performance         | Slower first load         | Faster (pre-loaded)         |

## Usage

### Installation

```bash
npm install @pie-framework/pie-fixed-player-static@1.0.1-a3f8b2c.1
```

### In HTML

```html
<script type="module">
  import '@pie-framework/pie-fixed-player-static';
</script>

<pie-fixed-player 
  item-id="item-123"
  token="your-jwt-token"
  api-base-url="https://api.example.com"
  env='{"mode": "gather", "role": "student"}'>
</pie-fixed-player>
```

### Attributes

Same as `pie-inline-player`:

- `item-id` - Item identifier
- `api-base-url` - Base URL for API calls
- `token` - JWT authentication token
- `env` - Environment config (mode, role)
- `session` - Session data array
- `add-correct-response` - Show correct answers
- `external-style-urls` - Additional CSS URLs
- `custom-classname` - Custom CSS class
- `container-class` - Container CSS class
- `passage-container-class` - Passage container CSS class
- `track-page-actions` - Enable New Relic tracking
- `nr-user-id` - New Relic user ID
- `nr-app-version` - New Relic app version
- `nr-page-view-name` - New Relic page view name

### Events

- `load-complete` - Fired when item loads successfully
- `session-changed` - Fired when user interacts with questions
- `player-error` - Fired on errors

## API Endpoint Required

Requires a new data-only endpoint:

```http
GET /api/item/{id}/data-only?mode=gather&role=student&addCorrectResponse=false
Authorization: Bearer {token}

Response:
{
  "item": { /* item config and data, no bundles */ },
  "passage": { /* passage config and data, no bundles */ }
}
```

## Build Process

Packages are generated via the CLI build utilities in `tools/cli` (see `tools/cli/src/utils/pie-packages/fixed-static.ts` and the command `pie-packages:fixed-player-build-package`):

1. Define element combination
2. Fetch IIFE bundle from PITS
3. Compile Svelte components
4. Generate package with hash-based version
5. Publish to npm registry

## Finding the Right Package

To find which package version includes your needed elements, query the registry:

```bash
npm view @pie-framework/pie-fixed-player-static versions
```

Or check the manifest in package.json `pie.elements` field.

## Managing element configurations (add / change / delete)

In `pie-fixed-player`, the “element configuration” is the **build-time element combination**: the list of `@pie-element/*@version` entries that will be bundled into the generated `@pie-framework/pie-fixed-player-static` package. It is **not** something you change at runtime via `<pie-fixed-player ...>` attributes.

### Where element configurations live

You provide the element combination to the builder in one of two ways:

- **Inline** (good for quick experiments):

```bash
bun run cli pie-packages:fixed-player-build-package \
  --elements "@pie-element/multiple-choice@11.4.3,@pie-element/passage@5.3.2"
```

- **JSON file** (recommended; easy to review and edit):

```json
{
  "elements": [
    { "package": "@pie-element/multiple-choice", "version": "11.4.3" },
    { "package": "@pie-element/passage", "version": "5.3.2" }
  ]
}
```

Then build with:

```bash
bun run cli pie-packages:fixed-player-build-package --elements-file ./elements.json
```

### Add an element

1. Add a new entry to your `elements.json`:
   - `{ "package": "@pie-element/your-element", "version": "x.y.z" }`
2. Rebuild the static package.

This changes the **bundle hash**, so you’ll get a **new package version** (the `-<hash>.<iteration>` part will have a different hash).

### Change an element (version bump / pin)

1. Update the `"version"` for the element in `elements.json`.
2. Rebuild.

Any version change changes the **bundle hash**, producing a **new package version** for that combination.

### Delete an element

1. Remove the element entry from `elements.json`.
2. Rebuild.

This also changes the **bundle hash**, producing a **new package version** for the reduced combination.

### Verify what a built package contains

In the generated package’s `package.json`, look at:

- `pie.elements`: map of included element packages to versions
- `pie.bundleHash`: deterministic hash of the element combination
- `pie.iteration`: build number for the same element combination

### When to use iteration (same elements, new build)

If you need to publish a new build **without changing the element combination** (same hash) — e.g., you fixed the player implementation — increment the iteration:

```bash
bun run cli pie-packages:fixed-player-build-package \
  --elements-file ./elements.json \
  --publish \
  --iteration 2
```

If you publish without `--iteration`, the CLI will auto-pick the next available iteration for that same `(loaderVersion, hash)` combination.

## CI/CD publishing from in-repo configs

Element combinations can be stored in-repo and automatically published on merges to `main`.

- Configs: `configs/fixed-player-static/*.json`
- CI workflow: `.github/workflows/publish-fixed-player-static.yml`

See `docs/fixed-player-static/README.md` for the full system and rules.
