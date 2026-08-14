# @pie-players/pie-tool-tts-inline

Inline TTS (Text-to-Speech) tool component for PIE Players Assessment Toolkit.

For the shared TTS architecture and provider model, see
[TTS Architecture](../../docs/accessibility/tts-architecture.md). This README
focuses on the inline custom element API.

## Overview

`pie-tool-tts-inline` is a web component that renders an inline speaker trigger with an expanded floating control panel for reading controls. Unlike floating modal tools, this component renders at its natural position in the DOM (typically in passage/item headers).

## Features

- Speaker trigger that toggles an expanded panel
- Expanded controls: Play/Pause, Stop, Fast-forward, Rewind, configurable Speed options
- Play button switches to Pause while reading
- Panel remains open while reading and closes on Stop
- Arrow-key navigation within the controls toolbar
- Registers with `ToolCoordinator` for lifecycle management
- Integrates with `TTSService` for QTI 3.0 catalog-based TTS
- Size variants: `sm`, `md`, `lg`
- Full accessibility support (ARIA labels, `role="toolbar"`, live status updates)
- Coordinator-controlled visibility via CSS `display` property

## Installation

```bash
bun add @pie-players/pie-tool-tts-inline
```

## Usage

```javascript
import '@pie-players/pie-tool-tts-inline';
import { TTSService, BrowserTTSProvider, ToolCoordinator } from '@pie-players/pie-assessment-toolkit';

// Initialize services
const ttsService = new TTSService();
await ttsService.initialize(new BrowserTTSProvider());
const toolCoordinator = new ToolCoordinator();

// Create element
const ttsButton = document.createElement('pie-tool-tts-inline');
ttsButton.setAttribute('tool-id', 'tts-passage-1');
ttsButton.setAttribute('catalog-id', 'passage-1');
ttsButton.setAttribute('size', 'md');

// Bind services as JavaScript properties (not HTML attributes)
ttsButton.ttsService = ttsService;
ttsButton.coordinator = toolCoordinator;

// Coordinator controls visibility
toolCoordinator.showTool('tts-passage-1');
```

### With Svelte

```svelte
<script>
  import '@pie-players/pie-tool-tts-inline';
  import { ZIndexLayer } from '@pie-players/pie-assessment-toolkit';

  let ttsToolElement;

  $effect(() => {
    if (ttsToolElement && toolCoordinator) {
      ttsToolElement.ttsService = ttsService;
      ttsToolElement.coordinator = toolCoordinator;

      if (ttsService) {
        toolCoordinator.showTool('tts-passage-1');
      }
    }
  });
</script>

<div class="header">
  <h3>Passage Title</h3>
  <pie-tool-tts-inline
    bind:this={ttsToolElement}
    tool-id="tts-passage-1"
    catalog-id="passage-1"
    size="md"
  ></pie-tool-tts-inline>
</div>
```

## Props

### HTML Attributes

- `tool-id` - Unique identifier for tool registration (default: `'tts-inline'`)
- `catalog-id` - QTI 3.0 accessibility catalog ID for SSML lookup (default: `''`)
- `language` - Language code for TTS (default: `'en-US'`)
- `size` - Icon size: `'sm'` (1.5rem), `'md'` (2rem), or `'lg'` (2.5rem) (default: `'md'`)

### JavaScript Properties

- `ttsService` - ITTSService instance (required)
- `coordinator` - IToolCoordinator instance (optional, for visibility management)
- `speedOptions` - Optional speed options controlling inline speed button rendering
- `showSingleSpeedOption` - Optional boolean to show a one-option speed group (hidden by default)

### `speedOptions` Configuration

`speedOptions` is intended to be set as a JavaScript property (not as a
serialized HTML attribute), either directly on the element or via toolkit
provider settings.

```javascript
const ttsButton = document.createElement("pie-tool-tts-inline");
ttsButton.speedOptions = [2, 1.25, 1.5]; // host options keep this order; Normal is added if omitted
```

For hosts that need semantic button copy, pass object-form options. `rate`
still controls playback; `label` and `ariaLabel` only control visible and
accessible text.

```javascript
ttsButton.speedOptions = [
  { rate: 0.8, label: "Slow", ariaLabel: "Slow speed" },
  { rate: 1, label: "Normal", ariaLabel: "Normal speed", default: true },
  { rate: 1.5, label: "Fast", ariaLabel: "Fast speed" }
];
```

Semantics:

- Omitted or non-array: defaults to visible `Slow`, `Normal`, and `Fast` choices, with `Normal` selected.
- Explicit `[]`: no speed choices rendered; playback speed is reset to `1.0`.
- Invalid-only values: fall back to the visible `Slow`, `Normal`, and `Fast` choices.
- Numeric values and object `rate` values are deduplicated while preserving
  first-seen order.
- Numeric options render as `{rate}x` with accessible names like
  `Speed {rate}x`.
- Object options can customize labels; missing labels fall back to `{rate}x`,
  and missing `ariaLabel` values fall back to matching names like `Fast speed`.
- `1` renders as the visible `Normal` choice. If a non-empty config omits `1`,
  the component adds `Normal` at the natural point in the speed scale while
  preserving host-provided option order.
- One speed is always selected. Clicking the selected speed is a no-op.
- One-option speed groups are hidden by default; set `showSingleSpeedOption` to
  `true` to surface a single current speed.

## Behavior

1. **Tool Registration**: Registers with ToolCoordinator on mount using the provided `tool-id`
2. **Text Extraction**: Finds nearest `.pie-section-player__passage-content` or `.pie-section-player__item-content` container
3. **TTS Trigger**: Calls `ttsService.speak(text, { catalogId, language })`
4. **Catalog Resolution**: TTSService checks for SSML in accessibility catalogs (priority order):
   - **Extracted catalogs** (from embedded SSML) - generated before render by hosts that run `SSMLExtractor`
   - **Item-level catalogs** (manually authored)
   - **Assessment-level catalogs** (manually authored)
   - **Plain text fallback** (browser TTS)
5. **Expanded Controls**:
   - Trigger button opens/closes the panel
   - Play/Pause toggles based on playback state
   - Stop halts playback and closes the panel
   - Fast-forward/Rewind invoke sentence-jump seek on `ITTSService`
   - Speed buttons call `ttsService.setPlaybackRate(rate)` when available,
     otherwise `ttsService.updateSettings({ rate })`
   - Speed choices render as a named `Playback speed` radio group with
     `aria-checked` state
   - Selecting another speed switches the active radio to that option
   - Clicking the currently active speed leaves the selection unchanged
   - If `speedOptions` is `[]`, speed controls are omitted and playback rate is
     reset to `1x` while rewind/forward/stop still render
6. **Keyboard Interaction**: Arrow keys move between controls; Tab enters/leaves the toolbar
7. **Cleanup**: Unregisters from coordinator on unmount

## SSML Extraction Integration

When used with the section player, this tool benefits from extracted catalogs
when a host/import pipeline runs `SSMLExtractor` before render:

**Author embeds SSML in content:**

```html
<div>
  <speak>Solve <prosody rate="slow">x squared plus two</prosody>.</speak>
  <p>Solve x² + 2 = 0</p>
</div>
```

**Preprocessing extracts SSML:**

- Generates catalog with ID like `auto-prompt-q1-0`
- Adds `data-catalog-idref="auto-prompt-q1-0"` to visual content
- Provides `config.extractedCatalogs` for runtime catalog registration

**Tool uses extracted catalog:**

- User clicks TTS button in header
- Tool calls `ttsService.speak(text, { catalogId: 'auto-prompt-q1-0' })`
- TTSService finds SSML in extracted catalogs
- Speaks with proper math pronunciation and pacing

**Result:** Authors get high-quality TTS without maintaining separate catalog files.

## Styling

The component uses scoped styles and doesn't require external CSS. Styling uses `--pie-*` token variables:

- **Trigger**: Circular speaker button that indicates panel open state
- **Panel**: Floating card with vertically stacked controls
- **Speed state**: Active speed button receives distinct token-driven styling
- **Disabled**: Reduced opacity, no pointer

Hosts that need to theme the trigger's active/open state should prefer these
component-scoped variables instead of overriding broad semantic tokens such as
`--pie-primary`:

```css
--pie-tool-trigger-active-background: Active/open trigger background
--pie-tool-trigger-active-color: Active/open trigger foreground
--pie-tool-trigger-active-border-color: Active/open trigger border
```

If unset, the trigger looks the same open as closed: each hook falls back to the
value the control already resolves to — background through
`--pie-button-background-color` / `--pie-button-bg` / `--pie-background`, border
through `--pie-button-border-color` / `--pie-button-border` / `--pie-border`, and
foreground through `--pie-button-color` / `--pie-text`. Setting a hook is how a
host opts into a distinct active/open appearance.

This differs deliberately from `@pie-players/pie-tool-calculator-inline-desmos`,
whose equivalent hooks fall back to a filled `--pie-primary` look. This trigger
has never had a filled active state — the panel opening is itself the state
indication — so these defaults do not introduce one. Hosts remain responsible for
maintaining WCAG AA foreground/background contrast when overriding active trigger
colors.

### Overlay panel colours

The floating and left-aligned panels take their shape from the Knowledge-Check
design and their colour from the active theme. Each surface resolves a
component-scoped hook first, then a canonical token, then a literal that only
applies when no theme is loaded:

```css
--pie-tts-button-color        /* media glyphs, selected speed → --pie-button-color */
--pie-tts-inline-muted-color  /* unselected speed labels     → --pie-button-color */
--pie-tts-selected-bg         /* the card                    → --pie-surface / --pie-white */
--pie-selected-button-background /* selected speed chip      → --pie-button-active-bg */
--pie-selected-button-border  /* selected speed chip border  → --pie-button-border */
--pie-tts-menu-shadow         /* card elevation */
--pie-tts-card-border         /* card hairline; `transparent` for shadow-only */
```

The card carries a hairline mixed from `--pie-text` because its shadow is black
and disappears once the surface goes dark. It is deliberately not derived from
`--pie-border`: a host that wants borderless controls sets that to transparent,
which is the case where the shadow is the only edge. Set
`--pie-tts-card-border: transparent` for the shadow-only card.

A host that sets `--pie-button-border: transparent` also flattens the selected
speed chip, which defaults through it — set `--pie-selected-button-border` to
keep the chip outlined.

Foregrounds default through `--pie-button-color` (DaisyUI `base-content`) rather
than `--pie-primary` or `--pie-tertiary`: those are direct mappings of DaisyUI
slots chosen to pair with their own `-content` colour, so an accent glyph taken
from either falls under 3:1 against the card in 11 of the 35 shipped themes.
Selection reads from the chip fill and the bolder weight instead of from hue. A
host that wants a branded accent sets `--pie-tts-button-color` and owns the
contrast, as with the active-trigger hooks above.

Ordinary trigger and control button styling also preserves these legacy aliases:
`--pie-button-background-color`, `--pie-button-border-color`, and
`--pie-button-hover-background-color`. They remain supported for host
compatibility, but fall back through the canonical `--pie-button-bg`,
`--pie-button-border`, and `--pie-button-hover-bg` tokens before broad surface
tokens.

## Architecture

This tool follows the PIE Assessment Toolkit tool pattern:

- Always rendered in DOM at natural position
- ToolCoordinator controls visibility via `showTool()`/`hideTool()` (CSS `display` property)
- Registers with `ZIndexLayer.TOOL` for proper layering
- Services passed as JavaScript properties (objects can't be HTML attributes)

## Example

See active demos in `apps/section-demos`.

## License

MIT
