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

## Running the Demos

```bash
# From monorepo root
cd apps/section-demos

# Install dependencies (if needed)
bun install

# Start dev server
bun run dev
# Opens http://localhost:5300

# Build for production
bun run build

# Preview production build
bun run preview
```

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
│   │   ├── demo1/
│   │   │   ├── +page.ts           # Load demo1 data
│   │   │   └── +page.svelte       # Demo1 UI
│   │   ├── demo2/                 # Question + passage demo
│   │   └── demo3/                 # Three questions demo
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

### Customizing Demos
To modify content, edit the files in `src/lib/content/`. Each file exports an `AssessmentSection` object with:
- Section metadata (identifier, title)
- `keepTogether: true` for page mode
- Rubric blocks (passages, instructions)
- Item references (questions with PIE element configs)

### Configuring Player Runtime
The `/demo/[id]` route renders `pie-section-player-splitpane`. To switch strategies, use query params:

- `?player=iife` (default)
- `?player=esm`
- `?player=fixed`

Use `?mode=candidate` or `?mode=scorer` to switch environment role/mode.

**Supported CDNs:**
- **jsDelivr:** `https://cdn.jsdelivr.net/npm` (recommended, used in demos)
- **esm.sh:** `https://esm.sh` (may have package resolution issues)

### Adding New Demos
1. Create content file in `src/lib/content/demoX-*.ts`
2. Register the demo in `src/lib/content/sections.ts`
3. Confirm it appears on the landing page (`src/routes/+page.svelte`)

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
