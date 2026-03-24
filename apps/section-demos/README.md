# PIE Section Player Demos

Educational demonstrations of the PIE Section Player showcasing QTI 3.0 assessment sections with real K-12 content.

## Demos

### Demo 1: Single Question, No Passage ⭐☆☆
**Difficulty:** Beginner
**Estimated Time:** ~5 minutes
**Topic:** Climate Change Science (9th grade)

The simplest implementation - a single multiple-choice question with no supporting passage. Shows the minimal section player setup.

**Learning Objectives:**
- Understand the simplest section player implementation
- See how a single question renders in page mode
- Learn about greenhouse gases and climate change

### Demo 2: Single Question with Passage ⭐⭐☆
**Difficulty:** Intermediate
**Estimated Time:** ~8 minutes
**Topic:** Renaissance History (10th grade)

Demonstrates reading comprehension with a passage and a related question. Shows how passages and questions work together in page mode.

**Learning Objectives:**
- Understand how passages and questions work together
- See reading comprehension in page mode
- Learn about the Renaissance period and its cultural impact

### Demo 3: Three Questions with Passage ⭐⭐⭐
**Difficulty:** Advanced
**Estimated Time:** ~12 minutes
**Topic:** Photosynthesis and Ecosystems (8-9th grade)

Full reading comprehension assessment with three questions all referencing a single shared passage. Shows complex section structures in page mode.

**Learning Objectives:**
- Understand complex assessment structures with multiple questions
- See how multiple questions share a single passage in page mode
- Learn about photosynthesis and its role in ecosystems

### Demo: Session Hydration (Server DB)
**Difficulty:** Advanced
**Estimated Time:** ~10 minutes
**Topic:** Host-controlled resume simulation

Demonstrates a restart/resume workflow with external server-side persistence. The demo boots with an empty player session, seeds backend records for two section pages, and lets you explicitly hydrate from the database.

**Learning Objectives:**
- Understand load vs save boundaries between player memory and backend persistence
- Inspect normalized backend records (`attempt_sessions`, `section_sessions`, `item_sessions`)
- Verify section hydration/de-hydration behavior across page switches

## Running the Demos

```bash
# From monorepo root
bun install

# First run on a fresh checkout (build package dist outputs + start demos)
bun run dev:section -- --rebuild

# Normal daily start
bun run dev:section
# Opens http://localhost:5300

# Optional: watch section-related package builds while iterating on tools/packages
bun run build:watch:section-tools
```

Use root scripts rather than running `bun run dev` directly inside
`apps/section-demos`; root scripts apply the shared `.env` loading and
consistent monorepo startup behavior.

## Technical Details

### Technology Stack
- **Framework:** SvelteKit with static adapter
- **Styling:** Tailwind CSS v4 + DaisyUI v5
- **Player:** PIE Section Player (QTI 3.0)
- **Elements:** Loaded from jsDelivr CDN (`https://cdn.jsdelivr.net/npm`)

### Element Loading
The demos use the ESM-based PIE player that loads elements dynamically from jsDelivr CDN. This approach:
- Requires no local element bundles
- Works out of the box
- Uses the latest published element versions
- Supports version resolution via CDN

**Note:** For local development with unpublished elements, you would need to configure `bundleHost` to point to a local element server. This feature is planned for future implementation.

### Content Standards
All content is:
- Age-appropriate for 8-10th grade students
- Aligned with educational standards
- Written at appropriate Lexile levels (950L-1050L)
- Factually accurate and educationally sound

### Key Features
- Progressive difficulty (beginner → intermediate → advanced)
- Real educational content (not lorem ipsum)
- Clean, professional UI design with DaisyUI components
- Responsive layout
- Technical details view for developers

## Educational Topics Covered

1. **Climate Change Science** - Greenhouse gases and their effects
2. **Renaissance History** - Cultural transformation and the printing press
3. **Photosynthesis** - Plant biology and ecosystem dynamics

## For Developers

### Project Structure
```
apps/section-demos/
├── src/
│   ├── routes/
│   │   ├── +page.svelte           # Landing page
│   │   ├── +layout.svelte         # Shared layout
│   │   ├── (demos)/+layout.svelte # Shared demo route-group layout
│   │   ├── (demos)/_shared/       # Shared demo loaders/host wrappers
│   │   ├── (demos)/single-question/[[id]]/
│   │   ├── (demos)/question-passage/[[id]]/
│   │   ├── (demos)/three-questions/[[id]]/
│   │   ├── (demos)/tts-ssml/[[id]]/
│   │   ├── (demos)/session-persistence/[[id]]/
│   │   └── (demos)/session-hydrate-db/[[id]]/
│   │       ├── +page.ts           # Load fixed demo data with shared helper
│   │       └── +page.svelte       # Demo host
│   │   └── demo/[[id]]/           # Legacy host internals reused by new routes
│   ├── lib/
│   │   └── content/               # Demo content data
│   │       ├── demo1-single-question.ts
│   │       ├── demo2-question-passage.ts
│   │       └── demo3-three-questions.ts
│   ├── app.html                   # HTML template
│   └── app.css                    # Tailwind + DaisyUI styles
├── package.json
├── svelte.config.js
├── vite.config.ts
└── tailwind.config.ts
```

### Content Files
Each demo has a TypeScript file defining the QTI 3.0 assessment section:
- `demo1-single-question.ts` - Climate change MCQ
- `demo2-question-passage.ts` - Renaissance passage + question
- `demo3-three-questions.ts` - Photosynthesis passage + 3 questions
- `demo4-tts-ssml.ts` - TTS + SSML coverage with multi-level catalogs
- `sections.ts` - Includes multi-page `session-persistence` and `session-hydrate-db` demo wiring

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

Use `?mode=candidate` or `?mode=scorer` to switch environment role/mode. The host translates these to item-compatible env values (`{ mode, role }`) and passes `env` to `pie-section-player-splitpane`.

**Supported CDNs:**
- **jsDelivr:** `https://cdn.jsdelivr.net/npm` (recommended, used in demos)
- **esm.sh:** `https://esm.sh` (may have package resolution issues)

The ESM player defaults to jsDelivr and URL-based module resolution (`moduleResolution: "url"`). Override `loaderOptions.esmCdnUrl` to use a different CDN, or set `moduleResolution: "import-map"` when import-map behavior is needed.

### Item-level observability in demos/hosts

To configure item-level resource observability for section-player hosts, pass `loaderConfig` through
`runtime.player` (or top-level `player`) as a JS property object:

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

The `tts-ssml` route defaults to an SC-style custom transport through the local proxy route:

- Client endpoint: `POST /api/tts/sc`
- Required server env vars (no defaults):
  - `TTS_SCHOOLCITY_URL`
  - `TTS_SCHOOLCITY_API_KEY`
  - `TTS_SCHOOLCITY_ISS`

This keeps upstream auth/signing material server-side.

Positioning notes:

- SchoolCity is used here as an internal Renaissance-backed API example to demonstrate
  custom TTS integration boundaries.
- This is a demo-host integration pattern (custom provider + proxy route), not a toolkit default.
- The custom provider appears in the TTS settings panel as the `demo-custom-provider` tab,
  showing how to plug in backend-specific preview/apply behavior without changing toolkit defaults.

### Adding New Demos
1. Create content file in `src/lib/content/demoX-*.ts`
2. Register the demo in `src/lib/content/sections.ts`
3. Confirm it appears on the landing page (`src/routes/+page.svelte`)

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

## Architecture Notes

### Why SvelteKit?
- Matches the `pie-elements-ng/apps/element-demo` architecture
- Static site generation for easy deployment
- File-based routing for clear demo organization
- Built-in TypeScript support

### Why jsDelivr over esm.sh?
- Better package resolution for scoped packages
- More reliable for published npm packages
- Supports the `+esm` convention for ESM modules
- Lower latency for common packages

## License

MIT
