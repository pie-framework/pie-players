# PIE Item Player Demos

Educational demonstrations of the unified PIE item player showcasing individual PIE items with real K-12 content.

## Demos

### Demo 1: Multiple Choice Question ⭐☆☆

**Difficulty:** Beginner
**Estimated Time:** ~5 minutes
**Topic:** Solar System Science (8th grade)

The simplest implementation - a single multiple-choice question. Shows the minimal item player setup using the `iife` strategy.

**Learning Objectives:**
- Understand the simplest item player implementation
- See how a single PIE element renders with the item player `iife` strategy
- Learn about planetary science and our solar system

### Demo 2: Passage Item ⭐⭐☆

**Difficulty:** Intermediate
**Estimated Time:** ~8 minutes
**Topic:** Water Cycle and Earth Science (9th grade)

Demonstrates a passage item with formatted HTML content. Shows how complex text content renders within a PIE item with no interaction required.

**Learning Objectives:**
- Understand how passage items work as standalone PIE elements
- See complex HTML rendering within items
- Learn about the water cycle and Earth science

### Demo 3: Math Expression ⭐⭐⭐

**Difficulty:** Advanced
**Estimated Time:** ~12 minutes
**Topic:** Quadratic Functions (10th grade, Algebra II)

Advanced math problem with constructed response input fields. Shows how math rendering and student input work together.

**Learning Objectives:**
- Understand complex item types with math rendering
- See constructed response input fields in action
- Practice solving quadratic equations through factoring

## Running the Demos

```bash
# From monorepo root
bun install

# First run on a fresh checkout (build package dist outputs + start demos)
bun run dev:item -- --rebuild

# Normal daily start
bun run dev:item
# Opens http://localhost:5301

# Optional: watch section/item shared package builds while iterating on libraries
bun run build:watch:section-tools
```

Use root scripts rather than running `bun run dev` directly inside
`apps/item-demos`; root scripts apply shared monorepo startup behavior.

## Technical Details

### Technology Stack

- **Framework:** SvelteKit with static adapter
- **Styling:** Tailwind CSS v4 + DaisyUI v5
- **Player:** PIE Item Player (`strategy="iife"`)
- **Elements:** Loaded from PIE Bundle Service (`https://proxy.pie-api.com/bundles/`)

### Element Loading

The demos use `pie-item-player` with `strategy="iife"` to load element bundles dynamically from the PIE bundle service. This approach:
- Uses production-ready IIFE bundles
- Works with `@latest` element versions
- Loads complete element bundles with all dependencies
- More stable than ESM loading (no CDN resolution issues)
- Keeps runtime usage aligned with the unified player API

### Element Version Overrides

Delivery and author views include a PIEOneer-style element version toolbar.

- Overrides are stored in URL params as `pie-overrides[pie-element/<name>]=<version>`
- Base catalog defaults still come from each demo's `config.elements` map
- `GET /api/packages` powers combobox version suggestions via npm registry lookup

The server npm helper is imported from `@pie-players/pie-players-shared/server/npm-registry`
and must remain server-only (route/load modules only, never Svelte/browser code).

### Content Standards

All content is:
- Age-appropriate for 8-10th grade students
- Aligned with educational standards
- Written at appropriate Lexile levels (900L-950L)
- Factually accurate and educationally sound

### Key Features

- Progressive difficulty (beginner → intermediate → advanced)
- Real educational content (not lorem ipsum)
- Clean, professional UI design with DaisyUI components
- Responsive layout
- Technical details view for developers

## Educational Topics Covered

1. **Solar System Science** - Planetary characteristics and moons
2. **Earth Science** - Water cycle and atmospheric processes
3. **Algebra II** - Quadratic equations and factoring

## For Developers

### Project Structure

```
apps/item-demos/
├── src/
│   ├── routes/
│   │   ├── +page.svelte           # Landing page
│   │   ├── +layout.svelte         # Shared layout
│   │   └── demo/[[id]]/           # Parameterized demo route
│   │       ├── +page.ts           # Load demo data by id
│   │       ├── +page.svelte       # Demo UI
│   │       ├── delivery/          # Delivery sub-route
│   │       ├── author/            # Author sub-route
│   │       └── source/            # Source sub-route
│   ├── lib/
│   │   ├── demo-session-seeds.ts  # Optional: map demo id → initial session if empty `data` is not enough
│   │   └── content/               # Demo content data
│   │       ├── *.ts               # One module per item demo (`export default` DemoInfo), plus:
│   │       ├── types.ts           # Shared `DemoInfo` type
│   │       └── index.ts           # Registry (explicit imports + sorted `importedDemos` list)
│   ├── app.html                   # HTML template
│   └── app.css                    # Tailwind + DaisyUI styles
├── package.json
├── svelte.config.js
├── vite.config.ts
└── tailwind.config.ts
```

### Content Files

Each item demo is a TypeScript module `{id}.ts` that default-exports a `DemoInfo` object (see `types.ts`). `index.ts` imports each module explicitly and builds the sorted catalog from that list.

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
- `loaderOptions.bundleHost` - PIE bundle service URL (for `iife`)

**Modes:**
- `gather` - Student taking assessment (can interact)
- `view` - View-only mode (no interaction)
- `evaluate` - Show correct answers and feedback
- `browse` - Legacy compatibility input that is normalized to `view` in item-demos routes

**Route query compatibility:**
- `?mode=browse&role=student` normalizes to the same runtime behavior as `mode=view`
- `?mode=evaluate&role=student` is safety-coerced to `mode=gather`
- `?mode=evaluate&role=instructor` stays in scorer/evaluate behavior

### Adding New Demos

1. Add `src/lib/content/{unique-id}.ts` default-exporting `DemoInfo`, then register it in `index.ts` (import + add to the `importedDemos` array).
2. Open the catalog at `/` and follow the new card to `/demo/{unique-id}/delivery`.
3. If delivery fails with an empty session, add `{unique-id}` to `src/lib/demo-session-seeds.ts` instead of embedding session data in the demo module.

## Architecture Notes

### Why `iife` Strategy?

- ESM versions of PIE elements aren't published yet
- IIFE bundles are production-tested and stable
- Works with standard `@latest` element versions from npm
- No CDN resolution issues
- Runtime remains on a single player tag while preserving IIFE stability

### Why SvelteKit?

- Matches the `apps/section-demos` architecture
- Static site generation for easy deployment
- File-based routing for clear demo organization
- Built-in TypeScript support

## License

MIT
