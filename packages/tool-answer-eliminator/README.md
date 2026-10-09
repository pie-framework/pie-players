# @pie-players/pie-tool-answer-eliminator

Test-taking strategy tool that allows students to eliminate answer choices they believe are incorrect.

## Features

- **Element-Level State**: Answer eliminations tracked per PIE element (not per item)
- **Visual Feedback**: Strikethrough styling for eliminated choices
- **Global Uniqueness**: Uses composite keys for state management across sections
- **Ephemeral State**: State is client-only, separate from PIE session data
- **ElementToolStateStore Integration**: Works with Assessment Toolkit's state management

## Installation

```bash
npm install @pie-players/pie-tool-answer-eliminator
# or
bun add @pie-players/pie-tool-answer-eliminator
```

## Usage

### As Web Component

The answer eliminator is automatically integrated when using the PIE Section Player with ToolkitCoordinator:

```html
<script type="module">
  import '@pie-players/pie-section-player';
  import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';
  import {
    createPackagedToolRegistry,
    DEFAULT_TOOL_MODULE_LOADERS,
  } from '@pie-players/pie-default-tool-loaders';

  const toolRegistry = createPackagedToolRegistry({
    toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS,
  });
  const coordinator = new ToolkitCoordinator({
    assessmentId: 'my-assessment',
    toolRegistry,
    tools: {
      placement: { item: ['answerEliminator'] }
    }
  });

  const player = document.getElementById('player');
  player.runtime = { ...(player.runtime ?? {}), coordinator };
  player.section = mySection;
</script>

<pie-section-player-splitpane id="player"></pie-section-player-splitpane>
```

The section player automatically:
- Renders answer eliminator buttons in question toolbars
- Generates global element IDs
- Manages state lifecycle

The tool reads its coordinator and the `ElementToolStateStore` from the toolkit
runtime context, so it has to sit inside `<pie-assessment-toolkit>`.

### Manual Integration (Advanced)

For a custom layout inside the toolkit. The tool detects choices under the item root its enclosing `<pie-item-scope>` provides, and with none it warns and injects nothing:

```html
<script type="module">
  import '@pie-players/pie-tool-answer-eliminator';

  const tool = document.querySelector('pie-tool-answer-eliminator');
  // Store key per PIE element in the question, by model id
  tool.elementStateKeys = {
    mc1: 'my-assessment:section-1:attempt-1:question-1:mc1',
    mc2: 'my-assessment:section-1:attempt-1:question-1:mc2',
  };
  tool.visible = true; // or alwaysOn = true; the tool injects no buttons while neither is set
</script>

<pie-assessment-toolkit>
  <pie-item-scope item-id="question-1">
    <!-- the item's rendered content -->
    <pie-tool-answer-eliminator></pie-tool-answer-eliminator>
  </pie-item-scope>
</pie-assessment-toolkit>
```

## Props/Attributes

`elementStateKeys` is a JS property only; the others also take the attribute shown.

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `visible` | `visible` | `boolean` | `false` | Shows the elimination buttons; the toolbar toggle sets it |
| `alwaysOn` | `always-on` | `boolean` | `false` | Shows the buttons regardless of `visible`, for a profile-based accommodation |
| `strategy` | `strategy` | `'strikethrough' \| 'mask'` | `'strikethrough'` | Elimination styling; any other value uses `strikethrough` |
| `buttonAlignment` | `button-alignment` | `'left' \| 'right' \| 'inline'` | `'right'` | Button placement relative to the choice |
| `elementStateKeys` | | `Record<string, string>` | `{}` | Composite key `assessmentId:sectionId:attemptId:itemId:elementId` per PIE element, by model id, into the runtime context's element tool state store. A choice is tracked under its nearest ancestor with a listed id and persists under that key; choices outside a listed element are kept in memory only |

## Global Element ID Format

The tool uses globally unique composite keys for state management:

```
${assessmentId}:${sectionId}:${attemptId}:${itemId}:${elementId}
```

**Example:**
```typescript
"demo-assessment:section-1:attempt-1:question-1:mc1"
"biology-exam:section-2:attempt-1:genetics-q1:ebsr1"
```

### Benefits of Composite Keys

- ✅ **Element-Level Granularity**: Each PIE element has independent eliminations
- ✅ **No Cross-Item Contamination**: Eliminations from question 1 don't appear on question 2
- ✅ **Cross-Section Persistence**: State persists when navigating between sections
- ✅ **Global Uniqueness**: No ID collisions across entire assessment

### Why Element-Level?

Items can contain **multiple interactive elements** whose choice ids repeat (two multiple-choice elements both have a choice `a`). Each element needs independent state:

```typescript
// ✅ Correct: Element-level state
{
  "demo:section-1:attempt-1:question-1:mc1": {
    "answerEliminator": { "eliminatedChoices": ["a", "c"] }
  },
  "demo:section-1:attempt-1:question-1:mc2": {
    "answerEliminator": { "eliminatedChoices": ["a"] }
  }
}
```

## State Management

### Ephemeral vs Persistent State

The answer eliminator stores state in **ElementToolStateStore** (ephemeral, client-only):

**Tool State (Ephemeral - NOT sent to server):**
```typescript
{
  "demo:section-1:attempt-1:question-1:mc1": {
    "answerEliminator": {
      "eliminatedChoices": ["choice-b", "choice-d"]
    }
  }
}
```

**PIE Session Data (Persistent - sent to server for scoring):**
```typescript
{
  "question-1": {
    "id": "session-123",
    "data": [
      { "id": "mc1", "element": "multiple-choice", "value": ["choice-a"] }
    ]
  }
}
```

### Persistence Integration

To persist tool state across page refreshes:

```typescript
import {
  createPackagedToolRegistry,
  DEFAULT_TOOL_MODULE_LOADERS,
} from '@pie-players/pie-default-tool-loaders';

const toolRegistry = createPackagedToolRegistry({
  toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS,
});
const coordinator = new ToolkitCoordinator({
  assessmentId: 'my-assessment',
  toolRegistry,
  tools: { placement: { item: ['answerEliminator'] } }
});

// Save to localStorage on change
const storageKey = `tool-state:${coordinator.assessmentId}`;
coordinator.elementToolStateStore.setOnStateChange((state) => {
  localStorage.setItem(storageKey, JSON.stringify(state));
});

// Load on mount
const saved = localStorage.getItem(storageKey);
if (saved) {
  coordinator.elementToolStateStore.loadState(JSON.parse(saved));
}
```

## How It Works

### 1. Choice Detection

The tool detects choices through an **adapter registry** (`AdapterRegistry`), not a fixed selector list. Each adapter knows how to find and operate on choices for a specific PIE element type, and the registry runs them in priority order (`canHandle()`, then `findChoices()`), so a single question can mix element types:

| Adapter | Element type | How it finds choices |
| --- | --- | --- |
| `MultipleChoiceAdapter` | `multiple-choice` (single- or multi-select) | `.corespring-checkbox` / `.corespring-radio-button` choices |
| `EBSRAdapter` | `ebsr` | delegates to the multiple-choice adapter for each `ebsr-multiple-choice` part (Part A/B), prefixing choice IDs with the part |
| `InlineDropdownAdapter` | `inline-dropdown` | dropdown items with `role="option"` |

The tool builds its registry internally with these three adapters and has no injection point. The `./adapters/adapter-registry` export provides `AdapterRegistry` and `registerAdapter(...)`, and a registry a host constructs is not the one the tool reads, so supporting another element type is a change to this package. A `ChoiceAdapter` declares `elementType`, `priority`, `canHandle`, `findChoices`, `getChoiceId`, `getChoiceLabel`, `canEliminate`, `createChoiceRange` and `getButtonContainer`.

### 2. State Storage

Eliminated choices are stored by choice ID:

```typescript
{
  "eliminatedChoices": ["choice-a", "choice-c"]
}
```

### 3. Visual Feedback

Elimination styling is applied by a pluggable `EliminationStrategy` built on the **CSS Custom Highlight API** (zero DOM mutation, so the choice text and structure stay intact for screen readers). Two strategies ship today:

- `strikethrough` (default): a `::highlight(pie-answer-eliminated-<id>)` rule renders a line-through over the choice label.
- `mask`: a `::highlight(pie-answer-masked-<id>)` rule dims and blurs the choice.

Images need separate treatment: they are replaced elements, so neither `::highlight()` nor `text-decoration` paints on them and a picture choice would look untouched. The `strikethrough` strategy therefore wraps each `img` in the eliminated choice in a `span.pie-answer-eliminator-image-strike` (marked with `data-pie-answer-eliminator-image-strike`) and overlays a decorative, `pointer-events: none` SVG that draws an X corner to corner — upper-left to lower-right and lower-left to upper-right. Restoring the choice unwraps the image and returns the DOM to its original shape. Each diagonal is painted over a wider light casing line (`--pie-answer-eliminator-image-strike-casing-color`) so it stays legible over dark artwork.

MathJax-rendered math needs its own mark for the same reason. MathJax's CHTML output draws each glyph as an `mjx-c` element with empty `textContent` (the character comes from `::before` generated content, which belongs to no Range), and its SVG output has no text at all — so the highlight had nothing to decorate and a math-only choice looked untouched. For each `mjx-container` in the eliminated choice, the `strikethrough` strategy marks the inner `mjx-math` box with `pie-answer-eliminator-math-strike` plus one of two modifiers, and the theme paints it:

| expression | mark | `data-pie-answer-eliminator-math-strike` |
| --- | --- | --- |
| single row of symbols | centred line-through, as the prose gets | `line` |
| contains a fraction bar or table rule | diagonals, as an eliminated image gets | `cross` |

A centred line on a fraction lands on the math axis — exactly where the fraction bar already sits — so it reads as a recoloured bar rather than an elimination. The split is structural (`mjx-mfrac`, `mjx-mtable`), not height-based: an inline `a/b` is only 1.16× its font size, indistinguishable in height from a radical or a parenthesised row, yet it is precisely the colliding case. Radicals and stacked limits keep the line, since their bars sit at the top or the strike simply crosses the base.

The inner `mjx-math` box is the paint target, not the container: for inline math `mjx-container` is `display: inline`, so its rect is the surrounding line box while the expression itself overflows it — a fraction sticks out several pixels above and below.

Only MathJax containers are marked: natively rendered MathML keeps real text in `mi`/`mn`/`mo`, so the highlight already strikes every token there.

All three treatments — the text line-through, the diagonals over an image, the line over math — are drawn in one colour, `--pie-answer-eliminator-strike-color` (defaulting to `--pie-incorrect`), so a choice mixing prose, pictures, and math reads as a single strike and can be restyled from one place.

For browsers without the Highlight API, each strategy falls back to a class on the choice container. Either way the eliminated choice also receives ARIA hooks (`data-pie-answer-eliminated`, plus `aria-disabled`/`aria-hidden` and an offscreen "(eliminated)" announcement) for assistive technology.

### 4. Toggle Behavior

Each detected choice gets its own elimination toggle button (class `pie-answer-eliminator-toggle`, rendered as `⊗`) placed via the adapter's `getButtonContainer()`. Clicking the button toggles that choice through the active strategy. Eliminating is blocked when the adapter's `canEliminate()` returns false — for example when the choice is already selected, disabled, or the item is in evaluate/view mode. An active button is marked with `pie-answer-eliminator-toggle--active` and `aria-pressed="true"`; clicking again restores the choice.

## Cleanup

The ElementToolStateStore provides cleanup methods:

```typescript
// Clear state for a specific element
store.clearElement('demo:section-1:attempt-1:question-1:mc1');

// Clear all answer eliminator state across all elements
store.clearTool('answerEliminator');

// Clear all elements in a section
store.clearSection('demo', 'section-1');

// Clear all state
store.clearAll();
```

## TypeScript Support

Full TypeScript definitions included:

```typescript
import type { ElementToolStateStoreApi } from '@pie-players/pie-assessment-toolkit';

interface AnswerEliminatorState {
  eliminatedChoices: string[];
}
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires ES2020+ support (native ES modules, optional chaining, nullish coalescing).

## Examples

See the [section-demos](../../apps/section-demos/) for complete examples:

- **Three Questions Demo**: Element-level answer eliminator with state persistence
- **Paired Passages Demo**: Multi-section assessment with cross-section state

## Related Documentation

- [ToolkitCoordinator Architecture](../../docs/architecture/architecture.md#toolkitcoordinator-centralized-service-management) - Element-level state design
- [Assessment Toolkit README](../assessment-toolkit/README.md) - Toolkit overview
- [Section Player README](../section-player/README.md) - Integration guide

## License

MIT
