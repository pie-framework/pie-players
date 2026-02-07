# PIE Section Player Demos

This directory contains working examples demonstrating the capabilities of the PIE Section Player web component.

## Available Demos

### 1. Paired Passages - Urban Gardens (`paired-passages-urban-gardens.html`)

**Full implementation of the QTI 3.0 paired passages example** from `docs/qti3-paired-passages-example.md`.

**Features:**
- Two contrasting reading passages (Grade 6-8 ELA)
- Four multiple-choice comprehension questions
- Real PIE `@pie-element/multiple-choice` elements
- Demonstrates section-level passage placement (rubricBlocks)
- Shows both Page Mode and Item Mode rendering
- Includes session restoration demo

**Assessment Details:**
- **Standard**: CCSS.ELA-LITERACY.RI.7.6
- **Topic**: Perspectives on Urban Gardening
- **Questions**: 4 multiple-choice items testing main idea, author's purpose, comparison, and synthesis
- **Time**: ~15-20 minutes
- **Passages**: Lexile 950L and 980L

**Controls:**
- Load Page Mode - Shows all passages and items together (keepTogether: true)
- Load Item Mode - Shows one item at a time with navigation (keepTogether: false)
- Load with Saved Sessions - Demonstrates session restoration

### 2. Basic Demo (`basic-demo.html`)

**Simple introduction** to the section player with minimal complexity.

**Features:**
- Single passage (Solar System)
- Three basic items
- Simple HTML markup (no complex PIE elements yet)
- Good starting point for learning the component

**Controls:**
- Load Page Mode - All items visible
- Load Item Mode - One item at a time navigation

### 3. Simple Demo (`../demo.html`)

**Original proof-of-concept demo** in the root directory.

## Running the Demos

### Option 1: Local Development Server

```bash
# From the section-player package directory
cd packages/section-player
bun run build  # Build the component first
python3 -m http.server 8080

# Open in browser:
# http://localhost:8080/demos/paired-passages-urban-gardens.html
# http://localhost:8080/demos/basic-demo.html
```

### Option 2: Using Vite Dev Server

```bash
# From the project root
bun run dev

# Navigate to the demos in your browser
```

## Demo Structure

Each demo is a self-contained HTML file that:

1. **Imports the built web component**
   ```html
   <script type="module">
     import '../dist/pie-section-player.js';
   </script>
   ```

2. **Defines section data** matching the QTI 3.0 structure
   ```javascript
   const section = {
     identifier: 'section-id',
     title: 'Section Title',
     keepTogether: true,  // Page mode
     rubricBlocks: [...],  // Instructions and passages
     assessmentItemRefs: [...]  // Items
   };
   ```

3. **Sets the section** via the web component's properties
   ```javascript
   player.section = section;
   player.mode = 'gather';
   player.view = 'candidate';
   ```

4. **Listens for events**
   ```javascript
   player.addEventListener('section-loaded', (e) => {
     console.log('Section loaded:', e.detail);
   });

   player.addEventListener('session-changed', (e) => {
     console.log('Session changed:', e.detail);
   });
   ```

## Key Concepts Demonstrated

### Page Mode vs Item Mode

**Page Mode (`keepTogether: true`)**:
- All passages and items rendered simultaneously
- Ideal for:
  - Paired passages
  - Multi-item pages
  - Print assessments
  - Situations where context should remain visible

**Item Mode (`keepTogether: false`)**:
- One item at a time with Previous/Next navigation
- Passages persist across all items
- Ideal for:
  - Linear assessments
  - Adaptive tests
  - Focused delivery
  - Mobile-friendly navigation

### Section Structure

```javascript
{
  identifier: 'section-id',
  title: 'Section Title',
  keepTogether: true,  // Controls rendering mode

  rubricBlocks: [
    {
      id: 'instructions',
      view: 'candidate',
      use: 'instructions',  // Instructions rubric
      passage: { ... }
    },
    {
      id: 'passage-1',
      view: 'candidate',
      use: 'passage',  // Section-level passage
      passage: { ... }
    }
  ],

  assessmentItemRefs: [
    {
      identifier: 'item-ref-1',
      required: true,
      item: {
        id: 'item-001',
        config: {
          markup: '<multiple-choice id="q1"></multiple-choice>',
          elements: { ... },
          models: [ ... ]
        }
      }
    }
  ]
}
```

### Passage Placement

**Section-level (QTI 3.0 style)** - Recommended:
```javascript
rubricBlocks: [
  {
    id: 'passage-1',
    view: 'candidate',
    use: 'passage',
    passage: { id: 'p1', config: { markup: '...' } }
  }
]
```

**Item-linked (Legacy PIE style)** - Still supported:
```javascript
assessmentItemRefs: [
  {
    item: {
      id: 'item-1',
      passage: { id: 'p1', config: { markup: '...' } }
    }
  }
]
```

The section player automatically deduplicates passages from both sources by ID.

### Session Management

**Providing initial sessions:**
```javascript
player.itemSessions = {
  'item-001': { value: 'choice-a' },
  'item-002': { value: 'choice-b' }
};
```

**Listening for updates:**
```javascript
player.addEventListener('session-changed', (e) => {
  const { itemId, session, timestamp } = e.detail;
  // Save to backend, local storage, etc.
});
```

## Events Reference

| Event | When Fired | Detail Properties |
|-------|-----------|-------------------|
| `section-loaded` | Section loaded and ready | `sectionId`, `itemCount`, `passageCount`, `isPageMode` |
| `item-changed` | Current item changes (item mode) | `previousItemId`, `currentItemId`, `itemIndex`, `totalItems` |
| `session-changed` | Item session updated | `itemId`, `session`, `timestamp` |
| `player-error` | Error occurs | Error details |

## PIE Element Integration

The demos use real PIE elements loaded from CDN:

```javascript
elements: {
  'multiple-choice': '@pie-element/multiple-choice@latest'
}
```

The section player uses `<pie-esm-player>` internally to render both passages and items, ensuring consistent behavior with the rest of the PIE ecosystem.

## Visual Layout

The paired passages demo matches the design shown in [docs/img/assessment-section-sample1.png](../../docs/img/assessment-section-sample1.png):

- Instructions at the top in a highlighted box
- Passages displayed with clear visual separation
- Items rendered with proper spacing
- Navigation controls (in item mode) at the bottom

## Related Documentation

- [../ARCHITECTURE.md](../ARCHITECTURE.md) - Technical architecture and design decisions
- [../README.md](../README.md) - Usage documentation and API reference
- [../../docs/qti3-paired-passages-example.md](../../docs/qti3-paired-passages-example.md) - Detailed paired passages specification
- [../../docs/SECTION-STRUCTURE-DESIGN.md](../../docs/SECTION-STRUCTURE-DESIGN.md) - Section data model design

## Browser Compatibility

The section player web component works in all modern browsers:

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

No polyfills required for web components or Svelte 5 features.
