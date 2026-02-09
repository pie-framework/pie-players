# @pie-players/pie-section-player

A web component for rendering QTI 3.0 assessment sections with passages and items.

## Live Demos

🎯 **[View Interactive Demos](./demos/)** - Working examples with full code

- **[TTS Integration Demo](./demos/tts-integration-demo.html)** 🆕 - Assessment Toolkit TTS service integration
- **[Paired Passages Demo](./demos/paired-passages-urban-gardens.html)** - Complete QTI 3.0 paired passages with PIE elements
- **[Basic Demo](./demos/basic-demo.html)** - Simple introduction with one passage and three items
- **[Original Demo](./demo.html)** - Proof-of-concept from initial development

## Installation

```bash
npm install @pie-players/pie-section-player
# or
bun add @pie-players/pie-section-player
```

**Note:** The section player requires the following peer dependencies for tool integration:

- `@pie-players/pie-tool-answer-eliminator` - Answer eliminator tool for test-taking strategies
- `@pie-players/pie-tool-tts-inline` - Inline TTS tool for accessibility

These are automatically resolved when using the section player as a library dependency.

## Usage

### As Web Component (Vanilla JS/HTML)

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import '@pie-players/pie-section-player';
    import '@pie-players/pie-esm-player'; // Required for rendering passages/items
  </script>
</head>
<body>
  <pie-section-player id="player"></pie-section-player>

  <script type="module">
    const player = document.getElementById('player');

    // Set section data
    player.section = {
      identifier: 'section-1',
      keepTogether: true, // Page mode: all items visible
      rubricBlocks: [
        {
          view: 'candidate',
          use: 'passage',
          passage: {
            id: 'passage-1',
            name: 'Reading Passage',
            config: {
              markup: '<reading-passage id="p1"></reading-passage>',
              elements: {
                'reading-passage': '@pie-element/reading-passage@latest'
              },
              models: [{
                id: 'p1',
                element: 'reading-passage',
                content: '<p>Your passage content...</p>'
              }]
            }
          }
        }
      ],
      assessmentItemRefs: [
        {
          identifier: 'q1',
          item: {
            id: 'item-1',
            name: 'Question 1',
            config: {
              markup: '<multiple-choice id="mc1"></multiple-choice>',
              elements: {
                'multiple-choice': '@pie-element/multiple-choice@latest'
              },
              models: [{
                id: 'mc1',
                element: 'multiple-choice',
                prompt: 'What is 2 + 2?',
                choices: [/*...*/]
              }]
            }
          }
        }
      ]
    };

    // Set mode
    player.mode = 'gather'; // or 'view', 'evaluate', 'author'

    // Listen to events
    player.addEventListener('section-loaded', (e) => {
      console.log('Section loaded:', e.detail);
    });

    player.addEventListener('item-changed', (e) => {
      console.log('Item changed:', e.detail);
    });
  </script>
</body>
</html>
```

### As Svelte Component

```svelte
<script>
  import PieSectionPlayer from '@pie-players/pie-section-player';

  let section = {
    identifier: 'section-1',
    keepTogether: false, // Item mode: one at a time
    assessmentItemRefs: [/* items */]
  };
</script>

<PieSectionPlayer
  {section}
  mode="gather"
  view="candidate"
  bundleHost="https://cdn.pie.org"
/>
```

### In React

```jsx
import '@pie-players/pie-section-player';

function AssessmentSection({ section }) {
  const playerRef = useRef(null);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.section = section;
      playerRef.current.mode = 'gather';
    }
  }, [section]);

  return <pie-section-player ref={playerRef} />;
}
```

## Props/Attributes

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `section` | `QtiAssessmentSection` | `null` | Section data with passages and items |
| `mode` | `'gather' \| 'view' \| 'evaluate' \| 'author'` | `'gather'` | Player mode |
| `view` | `'candidate' \| 'scorer' \| 'author' \| ...` | `'candidate'` | Current view (filters rubricBlocks) |
| `item-sessions` | `Record<string, any>` | `{}` | Item sessions for restoration |
| `bundle-host` | `string` | `''` | CDN host for PIE bundles |
| `esm-cdn-url` | `string` | `'https://esm.sh'` | ESM CDN URL |
| `custom-classname` | `string` | `''` | Custom CSS class |
| `debug` | `string \| boolean` | `''` | Debug mode |

## Events

### `section-loaded`

Fired when the section is loaded and ready.

```javascript
player.addEventListener('section-loaded', (e) => {
  console.log(e.detail);
  // {
  //   sectionId: 'section-1',
  //   itemCount: 3,
  //   passageCount: 2,
  //   isPageMode: true
  // }
});
```

### `item-changed`

Fired when the current item changes (item mode only).

```javascript
player.addEventListener('item-changed', (e) => {
  console.log(e.detail);
  // {
  //   previousItemId: 'item-1',
  //   currentItemId: 'item-2',
  //   itemIndex: 1,
  //   totalItems: 3,
  //   timestamp: 1234567890
  // }
});
```

### `section-complete`

Fired when all items in the section are completed.

### `player-error`

Fired when an error occurs.

## Performance Optimization

The section player automatically optimizes element loading for sections with multiple items using the same PIE elements.

### Element Aggregation

**Problem**: When rendering multiple items that use the same PIE elements (e.g., multiple multiple-choice questions), the old approach would load the same element bundle multiple times.

**Solution**: The section player now:
1. Aggregates all unique elements from all items before rendering
2. Loads each element bundle once
3. Items initialize from the pre-loaded registry

**Benefits:**
- **50%+ faster loading** for sections with repeated elements
- **Fewer network requests** - one bundle request per unique element (not per item)
- **Automatic** - no configuration needed, works out of the box
- **Backward compatible** - existing code works without changes

### Example Performance

Section with 5 items (3 multiple-choice, 2 hotspot):

**Before**: 5 loader calls → 2 unique + 3 cached = ~550ms
**After**: 1 loader call → 2 unique = ~250ms

**50% faster load time**

### Element Version Conflicts

If items require different versions of the same element, an error is thrown:

```
Element version conflict: pie-multiple-choice requires both
@pie-element/multiple-choice@10.0.0 and @pie-element/multiple-choice@11.0.1
```

**Solution**: Normalize element versions across items in your content authoring system.

### Technical Details

For implementation details and architecture, see:
- [Element Loader Design](../../docs/architecture/ELEMENT_LOADER_DESIGN.md)
- [Generalized Loader Architecture](../../docs/architecture/GENERALIZED_LOADER_ARCHITECTURE.md)

## Rendering Modes

### Page Mode (`keepTogether: true`)

All items and passages are visible simultaneously. Ideal for:
- Paired passages
- Multi-item pages
- Print assessments

```javascript
section.keepTogether = true;
```

### Item Mode (`keepTogether: false`)

One item at a time with navigation controls. Ideal for:
- Linear assessments
- Adaptive tests
- Item-by-item delivery

```javascript
section.keepTogether = false;
```

## Methods

### `navigateNext()`

Navigate to the next item (item mode only).

```javascript
player.navigateNext();
```

### `navigatePrevious()`

Navigate to the previous item (item mode only).

```javascript
player.navigatePrevious();
```

### `getNavigationState()`

Get the current navigation state.

```javascript
const state = player.getNavigationState();
// {
//   currentIndex: 0,
//   totalItems: 3,
//   canNext: true,
//   canPrevious: false,
//   isLoading: false
// }
```

## Passage Handling

The section player extracts passages from two sources:

1. **Section-level passages** (QTI 3.0 style) - `rubricBlocks` where `use="passage"`
2. **Item-linked passages** (legacy PIE) - `item.passage`

Passages are automatically deduplicated by ID.

## Assessment Toolkit Integration

The section player integrates with the [PIE Assessment Toolkit](../assessment-toolkit/) for centralized service management via **ToolkitCoordinator**.

### Using ToolkitCoordinator (Recommended)

The **ToolkitCoordinator** provides a single entry point for all toolkit services, simplifying initialization:

```javascript
import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';

// Create coordinator with configuration
const coordinator = new ToolkitCoordinator({
  assessmentId: 'my-assessment',
  tools: {
    tts: { enabled: true, defaultVoice: 'en-US' },
    answerEliminator: { enabled: true }
  },
  accessibility: {
    catalogs: assessment.accessibilityCatalogs || [],
    language: 'en-US'
  }
});

// Pass to section player as JavaScript property
const player = document.getElementById('player');
player.toolkitCoordinator = coordinator;
player.section = mySection;
```

**Benefits:**
- **Single initialization point**: One coordinator instead of 5+ services
- **Centralized configuration**: Tool settings in one place
- **Automatic service wiring**: Services work together automatically
- **Element-level tool state**: Answer eliminations, highlights tracked per element
- **State separation**: Tool state (ephemeral) separate from session data (persistent)

### What the Coordinator Provides

The coordinator owns and orchestrates all toolkit services:

```typescript
coordinator.ttsService              // Text-to-speech service
coordinator.toolCoordinator         // Tool visibility and z-index management
coordinator.highlightCoordinator    // TTS and annotation highlights
coordinator.elementToolStateStore   // Element-level tool state (answer eliminator, etc.)
coordinator.catalogResolver         // QTI 3.0 accessibility catalogs for SSML
```

### Automatic Features

When using the coordinator, the section player automatically:

1. **Extracts services** from the coordinator
2. **Generates section ID** (from `section.identifier` or auto-generated)
3. **Passes IDs + services** through component hierarchy
4. **Extracts SSML** from embedded `<speak>` tags
5. **Manages catalog lifecycle** (add on item load, clear on navigation)
6. **Renders TTS tools** in passage/item headers
7. **Tracks element-level state** with global uniqueness

### Standalone Sections (No Coordinator)

If no coordinator is provided, the section player creates a default one:

```javascript
// No coordinator provided - section player creates default
const player = document.getElementById('player');
player.section = mySection;

// Internally creates:
// new ToolkitCoordinator({
//   assessmentId: 'anon_...',  // auto-generated
//   tools: { tts: { enabled: true }, answerEliminator: { enabled: true } }
// })
```

### Advanced: Manual Service Integration (Legacy)

For backward compatibility or advanced scenarios, you can still pass services individually:

```javascript
import {
  TTSService,
  BrowserTTSProvider,
  ToolCoordinator,
  HighlightCoordinator,
  AccessibilityCatalogResolver,
  ElementToolStateStore
} from '@pie-players/pie-assessment-toolkit';

// Initialize each service
const ttsService = new TTSService();
const toolCoordinator = new ToolCoordinator();
const highlightCoordinator = new HighlightCoordinator();
const elementToolStateStore = new ElementToolStateStore();
const catalogResolver = new AccessibilityCatalogResolver([], 'en-US');

await ttsService.initialize(new BrowserTTSProvider());
ttsService.setCatalogResolver(catalogResolver);

// Pass services individually
const player = document.getElementById('player');
player.ttsService = ttsService;
player.toolCoordinator = toolCoordinator;
player.highlightCoordinator = highlightCoordinator;
player.elementToolStateStore = elementToolStateStore;
player.catalogResolver = catalogResolver;
```

**Note:** Using ToolkitCoordinator is recommended for most use cases.

### SSML Extraction

✅ **Automatic SSML Extraction**: The section player automatically extracts embedded `<speak>` tags from item and passage content, converting them into QTI 3.0 accessibility catalogs at runtime.

**Benefits:**
- Authors embed SSML directly in content (no separate catalog files)
- Proper pronunciation of technical terms and math expressions
- Emphasis and pacing control via SSML
- Automatic catalog generation and registration

**Example:**

Authors create content with embedded SSML:
```typescript
{
  config: {
    models: [{
      prompt: `<div>
        <speak>Solve <prosody rate="slow">x squared, plus two x</prosody>.</speak>
        <p>Solve x² + 2x = 0</p>
      </div>`
    }]
  }
}
```

At runtime, the section player:
1. Extracts SSML and generates catalog entry
2. Cleans visual markup (removes SSML tags)
3. Adds `data-catalog-id` attribute for TTS lookup
4. Registers catalog with AccessibilityCatalogResolver

**Result:** TTS uses proper math pronunciation while visual display shows clean HTML.

See [TTS-INTEGRATION.md](./TTS-INTEGRATION.md) for complete details.

### Element-Level Tool State

Tool state (answer eliminations, highlights, etc.) is tracked at the **element level** using globally unique composite keys:

**Format**: `${assessmentId}:${sectionId}:${itemId}:${elementId}`

**Example**: `"demo-assessment:section-1:question-1:mc1"`

**Benefits:**
- Each PIE element has independent tool state
- No cross-item contamination
- Persists across section navigation
- Separate from PIE session data (not sent to server)

### Service Flow

Services are passed through the component hierarchy with IDs:

```
SectionPlayer (coordinator → services + assessmentId + sectionId)
  ↓
PageModeLayout / ItemModeLayout (passes assessmentId + sectionId + services)
  ↓
PassageRenderer / ItemRenderer (uses item.id, passes assessmentId + sectionId + services)
  ↓
QuestionToolBar (generates globalElementId)
  ↓
Tool web components (use globalElementId for state)
```

### Demos

See the [section-demos](../../apps/section-demos/) for complete examples:

- **Three Questions Demo**: Element-level answer eliminator with ToolkitCoordinator
- **TTS Integration Demo**: Coordinator with TTS service
- **Paired Passages Demo**: Multi-section with cross-section state persistence

## Styling

The web component uses Shadow DOM mode `'none'`, so you can style it with global CSS:

```css
.pie-section-player {
  max-width: 1200px;
  margin: 0 auto;
}

.pie-section-player .section-passages {
  background: #f5f5f5;
  padding: 1rem;
}

.pie-section-player .item-container {
  border: 1px solid #ddd;
  margin-bottom: 1rem;
}
```

## CDN Usage

```html
<script type="module">
  import 'https://cdn.jsdelivr.net/npm/@pie-players/pie-section-player/dist/pie-section-player.js';
</script>

<pie-section-player id="player"></pie-section-player>
```

## TypeScript

Full TypeScript support included:

```typescript
import type { QtiAssessmentSection } from '@pie-players/pie-players-shared/types';
import PieSectionPlayer from '@pie-players/pie-section-player';

const section: QtiAssessmentSection = {
  identifier: 'section-1',
  keepTogether: true,
  // ...
};

const player = document.querySelector('pie-section-player') as PieSectionPlayer;
player.section = section;
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires ES2020+ support (native ES modules, optional chaining, nullish coalescing).

## License

MIT
