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
cd apps/item-demos

# Install dependencies (if needed)
bun install

# Start dev server
bun run dev
# Opens http://localhost:5301

# Build for production
bun run build

# Preview production build
bun run preview
```

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
│   │   ├── demo1/
│   │   │   ├── +page.ts           # Load demo1 data
│   │   │   └── +page.svelte       # Demo1 UI
│   │   ├── demo2/                 # Passage demo
│   │   └── demo3/                 # Math demo
│   ├── lib/
│   │   └── content/               # Demo content data
│   │       ├── demo1-multiple-choice.ts
│   │       ├── demo2-passage.ts
│   │       └── demo3-math.ts
│   ├── app.html                   # HTML template
│   └── app.css                    # Tailwind + DaisyUI styles
├── package.json
├── svelte.config.js
├── vite.config.ts
└── tailwind.config.ts
```

### Content Files

Each demo has a TypeScript file defining the PIE item configuration:
- `demo1-multiple-choice.ts` - Solar system MCQ
- `demo2-passage.ts` - Water cycle passage
- `demo3-math.ts` - Quadratic equation problem

### Customizing Demos

To modify content, edit the files in `src/lib/content/`. Each file exports an `ItemEntity` object with:
- Item metadata (id, name)
- Config with elements registry, models, and markup
- Model configurations specific to each element type

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

### Adding New Demos

1. Create a new route in `src/routes/demo4/`
2. Create content file in `src/lib/content/demo4-*.ts`
3. Create `+page.ts` to load the content
4. Create `+page.svelte` with the UI
5. Add link to landing page (`src/routes/+page.svelte`)

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
