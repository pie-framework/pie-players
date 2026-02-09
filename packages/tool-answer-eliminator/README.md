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

The tool automatically detects answer choices within the scoped element:

```typescript
// Searches for choice elements with these patterns
const choiceSelectors = [
  '[data-choice-id]',           // PIE standard
  '.choice',                     // Common class
  '[role="radio"]',              // Accessibility
  '[role="checkbox"]',           // Accessibility
  'input[type="radio"]',         // Native inputs
  'input[type="checkbox"]'       // Native inputs
];
```

### 2. State Storage

Eliminated choices are stored by choice ID:

```typescript
{
  "eliminatedChoices": ["choice-a", "choice-c"]
}
```

### 3. Visual Feedback

Eliminated choices receive the `eliminated` CSS class:

```css
.choice.eliminated {
  text-decoration: line-through;
  opacity: 0.5;
}
```

### 4. Toggle Behavior

Clicking a choice toggles its elimination state:

```typescript
// First click: eliminate
choiceElement.classList.add('eliminated');

// Second click: restore
choiceElement.classList.remove('eliminated');
```

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

- [ToolkitCoordinator Architecture](../../docs/architecture/TOOLKIT_COORDINATOR.md) - Element-level state design
- [Assessment Toolkit README](../assessment-toolkit/README.md) - Toolkit overview
- [Section Player README](../section-player/README.md) - Integration guide

## License

MIT
