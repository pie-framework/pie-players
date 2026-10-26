# @pie-players/pie-tool-answer-eliminator

Test-taking strategy tool that allows students to eliminate answer choices they believe are incorrect.

## Features

- **Element-Level State**: Answer eliminations tracked per PIE element (not per item)
- **Visual Feedback**: Strikethrough styling for eliminated choices
- **Global Uniqueness**: Uses composite keys for state management across sections
- **Separate from session data**: Eliminations never enter the PIE session; the coordinator's `saveToolState` hook persists them ([Persistence Integration](#persistence-integration))
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
  import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

  const toolRegistry = createPackagedToolRegistry();
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
- Passes each element's composite state key to the tool as `elementStateKeys`
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
| `buttonAlignment` | `button-alignment` | `'start' \| 'end' \| 'inline'` | `'inline'` | Toggle placement: `inline` in the flow after the choice, or `start`/`end` beside it, resolved against the choice's own direction so they mirror under right-to-left content. `left` and `right` are aliases of `start` and `end`; any other value is `inline` |
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

- **Element-Level Granularity**: Each PIE element has independent eliminations
- **No Cross-Item Contamination**: Eliminations from question 1 don't appear on question 2
- **Cross-Section Persistence**: State persists when navigating between sections
- **Global Uniqueness**: No ID collisions across entire assessment

### Why Element-Level?

Items can contain **multiple interactive elements** whose choice ids repeat (two multiple-choice elements both have a choice `a`). Each element needs independent state:

```typescript
// Element-level state
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

### Tool state and session data

The answer eliminator stores eliminations in the toolkit's **ElementToolStateStore**, apart from the PIE session. They leave the browser only through the coordinator's `saveToolState` hook.

**Tool state (not part of the session, never scored):**
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
import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';
import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';

const storageKey = 'tool-state:my-assessment';
const coordinator = new ToolkitCoordinator({
  assessmentId: 'my-assessment',
  toolRegistry: createPackagedToolRegistry(),
  tools: { placement: { item: ['answerEliminator'] } },
  hooks: {
    loadToolState: () => JSON.parse(localStorage.getItem(storageKey) ?? 'null'),
    saveToolState: (state) => localStorage.setItem(storageKey, JSON.stringify(state)),
  },
});
```

## How It Works

### 1. Choice Detection

Elements supply their own choices. An element takes the eliminator by declaring the AfA PNP 3.0 support term `answer-masking` on its class and answering `pieSupportTargets('answer-masking')` on its instances:

```typescript
class ChoiceGrid extends HTMLElement {
  static pieSupports = ['answer-masking'];

  pieSupportTargets(term: string) {
    if (term !== 'answer-masking') return [];
    return this.rows.map((row) => ({
      id: row.value,
      label: row.text,
      container: row.element,
      content: row.labelElement,
      isSelected: () => this.isChosen(row.value),
      isEliminable: () => this.mode === 'gather' && !this.isChosen(row.value),
      setEliminated: (eliminated: boolean) => this.block(row.value, eliminated),
    }));
  }
}
```

Every field is required, and a choice missing one is skipped with a console warning:

| Field | Contract |
| --- | --- |
| `id` | Unique within the element and stable across renders: eliminations persist by it. |
| `label` | The choice's accessible name; the toggle is announced as "Toggle elimination for `label`". |
| `container` | Receives the toggle and the eliminated state. The tool sets `position: relative` on it. An inline container, such as a token in running text, takes the toggle in the line. |
| `content` | The part that is struck through or masked. It must be inside `container`. |
| `isSelected()` | Whether the learner has chosen it. A selected choice hides its toggle and is never eliminated. |
| `isEliminable()` | False in evaluate and view modes, and for disabled or selected choices. |
| `setEliminated(eliminated)` | Blocks or restores the learner's selection of the choice. The element owns this: the tool never disables controls it did not render. A call with the value the choice already has changes nothing. |

The toolbar reads the same `static pieSupports` declaration to decide whether to offer the eliminator, so an element built outside this repository needs no change here. A declaration that omits `answer-masking`, including `[]`, means the element takes no eliminator.

An element may replace its choices' markup on any render, as select-text does. When a container leaves the document, the tool asks for the choices again and keeps their eliminations by id, moving focus to the replacement toggle. It does not call `setEliminated` again on the same element instance, so an element that re-renders from `setEliminated` settles; a new instance is asked to block its eliminated choices, and a choice no longer supplied is restored.

The outermost declaring element under the item owns its subtree: an element composed of declaring parts answers for them, prefixing ids with the part where they would collide, as EBSR does with `a-` and `b-`. Eliminations persist under the key of the nearest element listed in `elementStateKeys`, starting from the declaring element.

Elements that declare nothing fall back to the multiple-choice and EBSR markup this package reads (`.corespring-checkbox` and `.corespring-radio-button` choices, and the `ebsr-multiple-choice` parts with ids `a` and `b`). That fallback serves legacy pie-elements and pie-elements-ng releases from before elements declared their supports, and never runs inside a declaring element.

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

Images need separate treatment: they are replaced elements, so neither `::highlight()` nor `text-decoration` paints on them and a picture choice would look untouched. The `strikethrough` strategy therefore wraps each `img` in the eliminated choice in a `span.pie-answer-eliminator-image-strike` (marked with `data-pie-answer-eliminator-image-strike`) and overlays a decorative, `pointer-events: none` SVG that draws an X corner to corner — upper-left to lower-right and lower-left to upper-right. Restoring the choice unwraps the image and returns the DOM to its original shape. Each diagonal is painted over a wider light casing line (`--pie-answer-eliminator-image-strike-casing-color`, package-private with no compatibility guarantee) so it stays legible over dark artwork.

MathJax-rendered math needs its own mark for the same reason. MathJax's CHTML output draws each glyph as an `mjx-c` element with empty `textContent` (the character comes from `::before` generated content, which belongs to no Range), and its SVG output has no text at all — so the highlight had nothing to decorate and a math-only choice looked untouched. For each `mjx-container` in the eliminated choice, the `strikethrough` strategy marks the inner `mjx-math` box with `pie-answer-eliminator-math-strike` plus one of two modifiers, and the theme paints it:

| expression | mark | `data-pie-answer-eliminator-math-strike` |
| --- | --- | --- |
| single row of symbols | centered line-through, as the prose gets | `line` |
| contains a fraction bar or table rule | diagonals, as an eliminated image gets | `cross` |

A centered line on a fraction lands on the math axis — exactly where the fraction bar already sits — so it reads as a recolored bar rather than an elimination. The split is structural (`mjx-mfrac`, `mjx-mtable`), not height-based: an inline `a/b` is only 1.16× its font size, indistinguishable in height from a radical or a parenthesised row, yet it is precisely the colliding case. Radicals and stacked limits keep the line, since their bars sit at the top or the strike simply crosses the base.

The inner `mjx-math` box is the paint target, not the container: for inline math `mjx-container` is `display: inline`, so its rect is the surrounding line box while the expression itself overflows it — a fraction sticks out several pixels above and below.

Only MathJax containers are marked: natively rendered MathML keeps real text in `mi`/`mn`/`mo`, so the highlight already strikes every token there.

All three treatments — the text line-through, the diagonals over an image, the line over math — are drawn in one color, `--pie-answer-eliminator-strike-color` (a registered `component-public` token, defaulting to `--pie-incorrect`), so a choice mixing prose, pictures, and math reads as a single strike and can be restyled from one place.

For browsers without the Highlight API, each strategy falls back to a class on the choice container. Either way the eliminated choice also receives ARIA hooks (`data-pie-answer-eliminated`, plus `aria-disabled`/`aria-hidden` and an offscreen "(eliminated)" announcement) for assistive technology.

### 4. Toggle Behavior

Each choice gets its own elimination toggle button (class `pie-answer-eliminator-toggle`, rendered as `⊗`) appended to its `container`. Clicking the button toggles that choice through the active strategy and calls `setEliminated`. Eliminating is blocked while `isEliminable()` returns false. An active button is marked with `pie-answer-eliminator-toggle--active` and `aria-pressed="true"`; clicking again restores the choice.

The toggle's accessible name ("Toggle elimination for {choice}", with "Unlabeled choice" standing in for a choice without text) and the "(eliminated)" announcement come from the players' catalog under `tools.answerEliminator`, in the interface locale of the runtime context. Both carry that locale's `lang` and `dir` while the choice content keeps its own, and a locale change relabels them in place without dropping eliminations.

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

## Examples

See the [section-demos](../../apps/section-demos/) for complete examples:

- **Three Questions Demo**: Element-level answer eliminator with state persistence
- **Two Passages Demo**: Multi-section assessment with cross-section state

## Related Documentation

- [Assessment toolkit architecture](../../docs/architecture/architecture.md#assessment-toolkit): the coordinator and element-level tool state
- [Assessment Toolkit README](../assessment-toolkit/README.md) - Toolkit overview
- [Section Player README](../section-player/README.md) - Integration guide

## License

MIT
