# @pie-players/pie-tool-answer-eliminator

Test-taking strategy tool that allows students to eliminate answer choices they believe are incorrect.

## Features

- **Element-Level State**: Answer eliminations tracked per PIE element (not per item)
- **Visual Feedback**: Strikethrough, cross-out or mask styling for eliminated choices
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

`elementStateKeys` and `elementIds` are JS properties only; the others also take the attribute shown.

| Property | Attribute | Type | Default | Description |
|----------|-----------|------|---------|-------------|
| `visible` | `visible` | `boolean` | `false` | Shows the elimination buttons; the toolbar toggle sets it |
| `alwaysOn` | `always-on` | `boolean` | `false` | Shows the buttons regardless of `visible`, for a profile-based accommodation |
| `strategy` | `strategy` | `'strikethrough' \| 'cross' \| 'mask'` | `'strikethrough'` | Elimination styling ([Visual Feedback](#3-visual-feedback)); any other value uses `strikethrough`. A change repaints eliminated choices in place, with the tool on or off. Placed through the toolbar, the tool takes it from `toolParameters.answerEliminator.strategy` in the profile, the assessment's `settings` or the item's `settings` ([PNP configuration](../assessment-toolkit/docs/PNP_CONFIGURATION.md)), which overrides the attribute |
| `elementStateKeys` | | `Record<string, string>` | `{}` | Composite key `assessmentId:sectionId:attemptId:itemId:elementId` per PIE element, by model id, into the runtime context's element tool state store. A choice is tracked under its nearest ancestor with a listed id and persists under that key; choices outside a listed element are kept in memory only |
| `elementIds` | | `string[]` | unset | Model ids of the PIE elements whose choices take a toggle; unset, every element's do. A choice belongs to an element when that element or one of its ancestors up to the item has a listed id. The toolbar sets it from the host's element list |

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
| `label` | The choice's accessible name; the toggle is named "Eliminate `label`". |
| `container` | Takes the toggle as its last child, in flow, so the element's own layout places it, and carries `data-pie-answer-eliminated`. The `strikethrough` and `cross` strategies position their marks in it, setting `position: relative` while a choice is eliminated if the container is static. An inline container, such as a token in running text, takes the toggle in the line. |
| `content` | What the strategy paints and the dim reaches: the choice's text and media, without the selection control or the toggle. It must be inside `container` and differ from it. |
| `isSelected()` | Whether the learner has chosen it. A selected choice hides its toggle, keeping its space, and is never eliminated. |
| `isEliminable()` | False in evaluate and view modes, and for disabled or selected choices. It answers for an eliminated choice as for any other: where it is false, the toggle cannot restore the choice either. |
| `setEliminated(eliminated)` | Blocks or restores the learner's selection of the choice. The element owns this: the tool never disables controls it did not render. A call with the value the choice already has changes nothing. |

The toolbar reads the same `static pieSupports` declaration to decide whether to offer the eliminator, so an element built outside this repository needs no change here. A declaration that omits `answer-masking`, including `[]`, means the element takes no eliminator.

An element may replace its choices' markup on any render, as select-text does, and may render choices after the tool starts. When a container leaves the document, or the element adds or removes markup of its own, the tool asks for the choices again. A choice whose container, content and label are unchanged keeps its toggle and its paint; a replaced one keeps its elimination by id, and focus moves to its new toggle. The tool does not call `setEliminated` again on the same element instance, so an element that re-renders from `setEliminated` settles; a new instance is asked to block its eliminated choices, and a choice no longer supplied is restored.

The outermost declaring element under the item owns its subtree: an element composed of declaring parts answers for them, prefixing ids with the part where they would collide, as EBSR does with `a-` and `b-`. Eliminations persist under the key of the nearest element listed in `elementStateKeys`, starting from the declaring element.

Elements that declare nothing fall back to the multiple-choice and EBSR markup this package reads (`.corespring-checkbox` and `.corespring-radio-button` choices, and the `ebsr-multiple-choice` parts with ids `a` and `b`). That fallback serves legacy pie-elements and pie-elements-ng releases from before elements declared their supports, and never runs inside a declaring element. Its container is the row that holds the control and the label, so the toggle ends that row ahead of any rationale or feedback; its content is the label text, and the choice is named from the prompt alone. A struck choice's input stays disabled when the element re-renders its inputs, as on a mode change, and a restored one stays disabled while the element holds its inputs read-only.

### Host element list

A host limits the eliminator to the elements whose support it has vetted, by package name, in the tool's provider entry:

```typescript
new ToolkitCoordinator({
  tools: {
    providers: {
      answerEliminator: { elements: ['multiple-choice', 'ebsr'] },
    },
  },
});
```

A name is the `<name>` of `@pie-element/<name>`, matched against the package the item's `elements` map binds a model's tag to, or, for a tag the map does not bind, against the tag with its version suffix and `pie-`/`pie-element-` prefix removed. A tag bound to a package outside `@pie-element` matches no name. A listed element must still support answer masking. The toolbar withdraws the eliminator from an item with no listed element, even under a PNP grant, and in a mixed item gives toggles only to the listed elements' choices. Omitting `elements` keeps every supporting element; an empty list allows none. A value that is not a list of names fails config validation and, under `toolConfigStrictness: "warn"` or `"off"`, allows none.

### 2. State Storage

Eliminated choices are stored by choice ID:

```typescript
{
  "eliminatedChoices": ["choice-a", "choice-c"]
}
```

### 3. Visual Feedback

The core owns the eliminated state: it sets `data-pie-answer-eliminated="true"` on the container and appends a visually hidden "(eliminated)" announcement, in the interface language, to the content. It sets no `aria-disabled`: the container holds the toggle, which stays operable, and the element blocks selection itself through `setEliminated`. The container is never `aria-hidden` either (WCAG 4.1.2). A pluggable `EliminationStrategy` only paints, and three ship:

| `strategy` | Paint |
| --- | --- |
| `strikethrough` (default) | A line through each line of text, an X over each image, and a line or an X over rendered math |
| `cross` | An X corner to corner over block content, and a line through each line box of inline content |
| `mask` | Dims and blurs the content |

Every strategy also dims the content, so elimination survives a strike colour the learner cannot tell from the text. The dim stops at the content, so the toggle and its focus ring keep their contrast; under a colour scheme it is lighter, since the scheme certifies a contrast a full dim breaks.

`strikethrough` and `cross` draw SVG marks in the container, ahead of the toggle and outside the dimmed content, so the strike keeps its full colour and the element's markup stays as it rendered it. The marks follow the content's layout: a `ResizeObserver` on the container and the content, or on the nearest box of an inline one, a late web font, and the element's own changes to its markup move them. Each `cross` mark wipes in from the inline start once, mirrored for right-to-left content.

`strikethrough` measures the text line by line and lays one line over each, through fragments that share a line, whatever elements they sit in. Text the learner does not see is not struck: hidden by `visibility`, transparent, or clipped to a pixel as screen-reader-only text is. Each `img` takes an X, each diagonal over a wider light casing (`--pie-answer-eliminator-image-strike-casing-color`, package-private with no compatibility guarantee) so it stays legible over dark artwork.

MathJax output carries no text a Range reaches: CHTML draws each glyph from `::before` content and SVG output has no text at all. For each `mjx-container`, `strikethrough` measures the inner `mjx-math` box, which holds the whole expression where an inline container's rect is only its line box:

| expression | mark | `data-pie-answer-eliminator-strike` |
| --- | --- | --- |
| single row of symbols | a centred line, as the prose gets | `line` |
| contains a fraction bar or table rule | an X | `cross` |

A centred line on a fraction lands on the fraction bar and reads as a recoloured bar. The split is structural (`mjx-mfrac`, `mjx-mtable`): an inline `a/b` is the height of a radical or a parenthesised row. Natively rendered MathML keeps real text, which is struck as text.

Every mark is SVG, so forced colours keep it, repainted `CanvasText`. All of them take one colour, `--pie-answer-eliminator-strike-color` (`component-public`, defaulting to `--pie-incorrect`), so a choice mixing prose, pictures and math reads as one strike. It folds into the scheme's `--pie-incorrect` by `--pie-fixed-hue-collapse`: a colour scheme replaces a host strike colour, and a Base Theme keeps it exactly.

### 4. Toggle Behavior

Each choice gets a toggle (class `pie-answer-eliminator-toggle`) appended as its container's last child. Clicking it toggles the choice through the active strategy and calls `setEliminated`; eliminating and restoring are both blocked while `isEliminable()` returns false. A pressed toggle has `pie-answer-eliminator-toggle--active` and `aria-pressed="true"`, and its plus turns from × to +; clicking again restores the choice. A selected choice hides its toggle and keeps its space in every mode, so selecting does not reflow it. A choice that is not eliminated and cannot be, as in evaluate mode or a disabled element, has no toggle in the layout or the tab order; an eliminated one keeps its toggle in the layout, pressed and disabled, which takes it out of the tab order. Read-only state comes from the element: a declaring element's `isEliminable()`, and for the legacy markup the element's `disabled` model or its disabled inputs. Turning the tool off keeps the eliminated choices struck, with their toggles, so the learner can still restore them; the other toggles leave the layout. A choice restored while the tool is off loses its toggle, so focus moves to the choice's control. Focus stays on a choice's toggle through a strategy change, and moves to its replacement when the toggle style changes or the element re-renders the choice.

The plain toggle (`pie-answer-eliminator-toggle--plain`) is sized in `em` of the surrounding text, 28px at a 16px base, and paints from the shared trigger tokens: `--pie-button-background-color`, `--pie-button-color`, `--pie-button-border` and `--pie-button-focus-outline` at rest, `--pie-button-hover-background-color` and a border and ring in `--pie-button-hover-border` on hover, and, pressed, the calculator and TTS triggers' `--pie-tool-trigger-active-background`, `--pie-tool-trigger-active-border-color` and `--pie-tool-trigger-active-color`. The pressed glyph defaults to `--pie-white`, which every theme pairs with `--pie-primary`, and a pressed toggle darkens to `--pie-primary-dark` on hover. With `ndsIcons` set in the runtime context, the `nds-icons` attribute on the players, the toggle is the NDS icon button (`pie-answer-eliminator-toggle--nds`), loaded on first use, with its palette bridged to the same tokens. It keeps its accent when pressed, as in the NDS design: the turned glyph and `aria-pressed` carry the state, and the button owns the fill the pressed tokens are chosen against. Disabled, the plain toggle takes the NDS button's treatment, half opacity and a `not-allowed` cursor. Forced colours fill a pressed toggle with `Highlight` and paint a disabled one `GrayText`. The toggle's transitions and the cross wipe run only under `prefers-reduced-motion: no-preference`.

The toggle's accessible name ("Eliminate {choice}", the same pressed or not, with "Unlabeled choice" standing in for a choice without text) and the "(eliminated)" announcement come from the players' catalog under `tools.answerEliminator`, in the interface locale of the runtime context. Both carry that locale's `lang` and `dir` while the choice content keeps its own, and a locale change relabels them in place without dropping eliminations.

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

- [**Answer Eliminator**](../../apps/section-demos/src/routes/%28demos%29/answer-eliminator/+page.svelte): each path the eliminator takes choices from, legacy adapters included, with the strategy, toggle style and item mode switchable mid-session. The URL carries the state, as in `?strategy=mask&nds=1&mode=evaluate`
- **Three Questions Demo**: Element-level answer eliminator with state persistence
- **Two Passages Demo**: Multi-section assessment with cross-section state

## Related Documentation

- [Assessment toolkit architecture](../../docs/architecture/architecture.md#assessment-toolkit): the coordinator and element-level tool state
- [Assessment Toolkit README](../assessment-toolkit/README.md) - Toolkit overview
- [Section Player README](../section-player/README.md) - Integration guide

## License

MIT
