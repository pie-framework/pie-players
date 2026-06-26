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

  const coordinator = new ToolkitCoordinator({
    assessmentId: 'my-assessment',
    tools: {
      answerEliminator: { enabled: true }
    }
  });

  const player = document.getElementById('player');
  player.toolkitCoordinator = coordinator;
  player.section = mySection;
</script>

<pie-section-player id="player"></pie-section-player>
```

The section player automatically:
- Renders answer eliminator buttons in question toolbars
- Generates global element IDs
- Passes ElementToolStateStore to the tool
- Manages state lifecycle

### Manual Integration (Advanced)

For custom implementations outside the section player:

```html
<script type="module">
  import '@pie-players/pie-tool-answer-eliminator';
  import { ElementToolStateStore } from '@pie-players/pie-assessment-toolkit';

  const store = new ElementToolStateStore();
  const globalElementId = store.getGlobalElementId(
    'my-assessment',
    'section-1',
    'question-1',
    'mc1'
  );

  const tool = document.querySelector('pie-tool-answer-eliminator');
  tool.globalElementId = globalElementId;
  tool.elementToolStateStore = store;
  tool.scopeElement = document.querySelector('.question-content');
</script>

<pie-tool-answer-eliminator></pie-tool-answer-eliminator>
```

## Props/Attributes

The web component accepts the following properties (set via JavaScript, not HTML attributes):

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `globalElementId` | `string` | Yes | Composite key: `assessmentId:sectionId:itemId:elementId` |
| `elementToolStateStore` | `IElementToolStateStore` | Yes | Store for element-level tool state |
| `scopeElement` | `HTMLElement` | No | DOM element to scope choice detection (defaults to document) |

## Global Element ID Format

The tool uses globally unique composite keys for state management:

```
${assessmentId}:${sectionId}:${itemId}:${elementId}
```

**Example:**
```typescript
"demo-assessment:section-1:question-1:mc1"
"biology-exam:section-2:genetics-q1:ebsr-part1"
```

### Benefits of Composite Keys

- ✅ **Element-Level Granularity**: Each PIE element has independent eliminations
- ✅ **No Cross-Item Contamination**: Eliminations from question 1 don't appear on question 2
- ✅ **Cross-Section Persistence**: State persists when navigating between sections
- ✅ **Global Uniqueness**: No ID collisions across entire assessment

### Why Element-Level?

Items can contain **multiple interactive elements** (e.g., EBSR with two parts). Each element needs independent state:

```typescript
// ✅ Correct: Element-level state
{
  "demo:section-1:question-1:ebsr-part1": {
    "answerEliminator": { "eliminatedChoices": ["choice-a", "choice-c"] }
  },
  "demo:section-1:question-1:ebsr-part2": {
    "answerEliminator": { "eliminatedChoices": ["choice-b"] }
  }
}
```

## State Management

### Ephemeral vs Persistent State

The answer eliminator stores state in **ElementToolStateStore** (ephemeral, client-only):

**Tool State (Ephemeral - NOT sent to server):**
```typescript
{
  "demo:section-1:question-1:mc1": {
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
const coordinator = new ToolkitCoordinator({
  assessmentId: 'my-assessment',
  tools: { answerEliminator: { enabled: true } }
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

Support more element types at runtime by registering your own adapter (any object implementing the `ChoiceAdapter` interface: `canHandle`, `findChoices`, `getChoiceId`, `getChoiceLabel`, `canEliminate`, `createChoiceRange`, `getButtonContainer`):

```typescript
import { AdapterRegistry } from '@pie-players/pie-tool-answer-eliminator';

const registry = new AdapterRegistry();
registry.registerAdapter(myCustomChoiceAdapter);
```

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

For browsers without the Highlight API, each strategy falls back to a class on the choice container. Either way the eliminated choice also receives ARIA hooks (`data-pie-answer-eliminated`, plus `aria-disabled`/`aria-hidden` and an offscreen "(eliminated)" announcement) for assistive technology.

### 4. Toggle Behavior

Each detected choice gets its own elimination toggle button (class `pie-answer-eliminator-toggle`, rendered as `⊗`) placed via the adapter's `getButtonContainer()`. Clicking the button toggles that choice through the active strategy. Eliminating is blocked when the adapter's `canEliminate()` returns false — for example when the choice is already selected, disabled, or the item is in evaluate/view mode. An active button is marked with `pie-answer-eliminator-toggle--active` and `aria-pressed="true"`; clicking again restores the choice.

## Cleanup

The ElementToolStateStore provides cleanup methods:

```typescript
// Clear state for a specific element
store.clearElement('demo:section-1:question-1:mc1');

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
import type { IElementToolStateStore } from '@pie-players/pie-assessment-toolkit';

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
