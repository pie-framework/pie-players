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

The section player integrates with the [PIE Assessment Toolkit](../assessment-toolkit/) services for TTS, tool coordination, and highlighting.

### TTS Integration

To enable TTS (Text-to-Speech) functionality, pass the `TTSService` as a JavaScript property:

```javascript
import { TTSService, BrowserTTSProvider } from '@pie-players/pie-assessment-toolkit';

// Create and initialize TTS service
const ttsService = new TTSService();
await ttsService.initialize(new BrowserTTSProvider());

// Pass to section player as JavaScript property (NOT an HTML attribute)
const player = document.getElementById('player');
player.ttsService = ttsService;
```

**Important:** Services must be set as JavaScript properties, not HTML attributes. They cannot be serialized to strings.

### Full Toolkit Integration

For complete toolkit integration with TTS, tool coordination, and highlighting:

```javascript
import {
  TTSService,
  BrowserTTSProvider,
  ToolCoordinator,
  HighlightCoordinator
} from '@pie-players/pie-assessment-toolkit';

// Initialize services
const ttsService = new TTSService();
const toolCoordinator = new ToolCoordinator();
const highlightCoordinator = new HighlightCoordinator();

await ttsService.initialize(new BrowserTTSProvider());

// Pass all services to player
const player = document.getElementById('player');
player.ttsService = ttsService;
player.toolCoordinator = toolCoordinator;
player.highlightCoordinator = highlightCoordinator;
```

### Service Flow

Services are passed through the component hierarchy:

```
SectionPlayer
  ↓ (services passed as props)
PageModeLayout / ItemModeLayout
  ↓
PassageRenderer / ItemRenderer
  ↓
pie-esm-player
  ↓
PieItemPlayer
  ↓
PIE Elements (if they support services)
```

### Demo

See [TTS Integration Demo](./demos/tts-integration-demo.html) for a working example.

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
