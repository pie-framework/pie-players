# PIE Section Player Demos

This document provides an overview of the demo implementations for the PIE Section Player.

## Location

All demos are located in [`packages/section-player/demos/`](../packages/section-player/demos/)

## Demo Index

### 1. Paired Passages - Urban Gardens

**File**: [`packages/section-player/demos/paired-passages-urban-gardens.html`](../packages/section-player/demos/paired-passages-urban-gardens.html)

**Description**: Complete implementation of the QTI 3.0 paired passages example from [`docs/qti3-paired-passages-example.md`](./qti3-paired-passages-example.md)

**Features**:
- Two contrasting reading passages (Grade 6-8 ELA)
  - Passage 1: "The Benefits of Urban Gardening" (Lexile 950L)
  - Passage 2: "Urban Gardens: Challenges and Limitations" (Lexile 980L)
- Four multiple-choice comprehension questions
- Real PIE `@pie-element/multiple-choice` elements
- Section-level passage placement (rubricBlocks)
- Both Page Mode and Item Mode rendering
- Session restoration demo

**Visual Layout**: Matches the design shown in [`docs/img/assessment-section-sample1.png`](./img/assessment-section-sample1.png)

**Standards**: CCSS.ELA-LITERACY.RI.7.6 (Determine author's point of view or purpose)

**Controls**:
- Load Page Mode - All items visible (keepTogether: true)
- Load Item Mode - One at a time with navigation (keepTogether: false)
- Load with Saved Sessions - Demonstrates session restoration
- Clear Event Log - Reset the event log display

### 2. Basic Demo

**File**: [`packages/section-player/demos/basic-demo.html`](../packages/section-player/demos/basic-demo.html)

**Description**: Simple introduction to the section player with minimal complexity

**Features**:
- Single passage (Solar System)
- Three basic items
- Simple HTML markup (no complex PIE elements)
- Good starting point for learning

**Controls**:
- Page Mode - All items visible
- Item Mode - One at a time navigation

### 3. Original Demo

**File**: [`packages/section-player/demo.html`](../packages/section-player/demo.html)

**Description**: Original proof-of-concept demo from initial development

**Features**:
- Basic section rendering in both modes
- Simple HTML-based examples
- Located in package root

## Running the Demos

### Option 1: Local HTTP Server

```bash
# From the section-player package directory
cd packages/section-player
bun run build  # Build the component first

# Start a local server
python3 -m http.server 8080
# or
npx serve

# Open in browser:
# http://localhost:8080/demos/
# http://localhost:8080/demos/paired-passages-urban-gardens.html
# http://localhost:8080/demos/basic-demo.html
```

### Option 2: Vite Dev Server

```bash
# From the project root
bun run dev

# Navigate to the demos in your browser
```

## Key Concepts Demonstrated

### Page Mode vs Item Mode

The demos showcase both rendering modes:

**Page Mode** (`keepTogether: true`):
- All passages and items rendered simultaneously
- Ideal for paired passages, print assessments
- Better for maintaining context

**Item Mode** (`keepTogether: false`):
- One item at a time with Previous/Next navigation
- Passages persist across all items
- Ideal for linear assessments, adaptive tests
- Mobile-friendly navigation

### Section-Level Passages (QTI 3.0 Style)

The paired passages demo demonstrates the recommended approach:

```javascript
rubricBlocks: [
  {
    id: 'passage-1',
    view: 'candidate',
    use: 'passage',
    passage: {
      id: 'passage-benefits',
      config: {
        markup: '<div>...</div>',
        elements: {},
        models: []
      }
    }
  }
]
```

### Session Management

The paired passages demo shows:
- Initial session restoration (pre-filled answers)
- Real-time session updates
- Event logging for `session-changed` events

### Event System

All demos demonstrate event handling:
- `section-loaded` - Section ready
- `item-changed` - Current item changed (item mode)
- `session-changed` - Item session updated
- `player-error` - Errors

## Visual Design

The paired passages demo includes:
- Professional styling matching [`assessment-section-sample1.png`](./img/assessment-section-sample1.png)
- Instructions in highlighted box
- Passages with clear visual separation
- Proper spacing and typography
- Navigation controls (item mode)
- Event log with color-coded events

## PIE Element Integration

The paired passages demo uses real PIE elements:

```javascript
elements: {
  'multiple-choice': '@pie-element/multiple-choice@latest'
}
```

The section player uses `<pie-esm-player>` internally to render both passages and items, ensuring consistency with the PIE ecosystem.

## Documentation Structure

```
packages/section-player/
├── demos/
│   ├── index.html                        # Demo landing page
│   ├── README.md                         # Demo documentation
│   ├── paired-passages-urban-gardens.html # Full QTI 3.0 example
│   └── basic-demo.html                   # Simple introduction
├── demo.html                             # Original proof-of-concept
├── README.md                             # Usage documentation
└── ARCHITECTURE.md                       # Architecture details
```

## Related Documentation

- [packages/section-player/demos/README.md](../packages/section-player/demos/README.md) - Detailed demo documentation
- [packages/section-player/ARCHITECTURE.md](../packages/section-player/ARCHITECTURE.md) - Technical architecture
- [docs/qti3-paired-passages-example.md](./qti3-paired-passages-example.md) - Paired passages specification
- [docs/SECTION-STRUCTURE-DESIGN.md](./SECTION-STRUCTURE-DESIGN.md) - Section data model design

## Browser Compatibility

All demos work in modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

No polyfills required.
