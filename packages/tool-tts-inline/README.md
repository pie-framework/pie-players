# @pie-players/pie-tool-tts-inline

Inline TTS (Text-to-Speech) tool component for PIE Players Assessment Toolkit.

For the shared TTS architecture and provider model, see
[TTS Architecture](../../docs/accessibility/tts-architecture.md). This README
focuses on the inline custom element API.

## Overview

`pie-tool-tts-inline` is a web component that renders an inline play/pause trigger with an expanded floating control panel for reading controls. Unlike floating modal tools, this component renders at its natural position in the DOM (typically in passage/item headers).

## Features

- Play/pause trigger that opens the expanded panel when reading starts
- Expanded controls: configurable Speed options, Rewind, Fast-forward, Stop
- Play button switches to Pause while reading
- Panel stays open while reading and after a read ends on its own; it closes on Stop or when the host calls `TTSService.stop()`
- Arrow-key navigation within the controls toolbar
- Takes its services from the toolkit runtime context and its reading scope from the enclosing item or passage shell
- Integrates with `TTSService` for QTI 3.0 catalog-based TTS
- Size variants: `sm`, `md`, `lg`
- Full accessibility support (ARIA labels, `role="toolbar"`, live status updates)
- Four panel layouts through `layout-mode`

## Installation

```bash
bun add @pie-players/pie-tool-tts-inline
```

## Usage

The element renders inside `<pie-item-scope>` or `<pie-passage-shell>` under
`<pie-assessment-toolkit>`. The toolkit runtime context supplies the TTS service,
the highlight coordinator and the toolkit coordinator, and the shell supplies the
content to read. Section players provide both; around a plain item player, the
host writes the toolkit and the scope. The packaged
`textToSpeech` capability in `@pie-players/pie-default-tool-loaders` creates
this element in item and passage toolbars, takes `catalog-id` and `size` from
the toolbar, and takes `layout-mode`, `speedOptions` and
`showSingleSpeedOption` from the toolkit's `textToSpeech` tool configuration.

```javascript
import '@pie-players/pie-tool-tts-inline';

// passageHeader: an element inside <pie-passage-shell>
const ttsButton = document.createElement('pie-tool-tts-inline');
ttsButton.setAttribute('catalog-id', 'passage-1');
ttsButton.setAttribute('size', 'md');
ttsButton.setAttribute('layout-mode', 'expanding-row');
passageHeader.append(ttsButton);
```

### With Svelte

```svelte
<script>
  import '@pie-players/pie-tool-tts-inline';
</script>

<div class="header">
  <h3>Passage Title</h3>
  <pie-tool-tts-inline
    catalog-id="passage-1"
    size="md"
    layout-mode="expanding-row"
  ></pie-tool-tts-inline>
</div>
```

## Props

### HTML Attributes

- `catalog-id` - QTI 3.0 accessibility catalog ID for SSML lookup (default: `''`)
- `size` - Icon size: `'sm'` (1.5rem), `'md'` (2rem), or `'lg'` (2.5rem) (default: `'md'`)
- `layout-mode` - Panel placement (default: `'left-aligned'`). `'reserved-row'`
  and `'expanding-row'` drop the panel below the trigger; in the packaged toolbar
  the first keeps the controls row reserved and the second expands it while the
  panel is open. `'floating-overlay'` and `'left-aligned'` open the panel as an
  overlay to the left of the trigger.

### JavaScript Properties

- `speedOptions` - Optional speed options controlling inline speed button rendering
- `showSingleSpeedOption` - Optional boolean to show a one-option speed group (hidden by default)

Both also read attributes: `speed-options` takes a JSON array, and
`show-single-speed-option` is true when present.

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

1. **Services**: Reads `ttsService`, `highlightCoordinator` and `toolkitCoordinator` from the toolkit runtime context; the controls stay disabled until a `ttsService` arrives. A read started before the service is ready waits on the service's readiness gate, and a failure there announces that text-to-speech could not initialize
2. **Text Extraction**: Reads the text of the scope element's content region (the region scope, else the shell scope, when it is `[data-region='content']`, else its first `[data-region='content']` descendant, else the scope element itself), including text rendered into open shadow roots
3. **TTS Trigger**: Calls `ttsService.speak(readingTarget, { ownerId, rate, catalogId, catalogContext, language })`, where `ownerId` names this instance, `rate` is the selected speed, `catalogContext` names the owning item or passage and `language` is the toolkit's `content-language`. The service decides whether anything is speakable, cards included; a read that settles without playing closes the panel and announces that there is nothing to read. `speak` resolves the read's language from it as [TTS language](../../docs/architecture/internationalization.md#tts-language) sets out
4. **Catalog Resolution**: TTSService checks for SSML in accessibility catalogs (priority order):
   - **Extracted catalogs** (from embedded SSML) - generated before render by hosts that run `SSMLExtractor`
   - **Item-level catalogs** (manually authored)
   - **Assessment-level catalogs** (manually authored)
   - **Generated speech** - MathML speech, else the visible text, on any backend
5. **Expanded Controls**:
   - The trigger starts, pauses and resumes reading; starting opens the panel
   - The instance owns the service's run its read started (`getRunOwner()`); a read started by anything else, another instance or a selection read, closes its panel
   - Stop halts playback and closes the panel
   - Fast-forward/Rewind call `seekForward(1)` / `seekBackward(1)` on the TTS service, one sentence per press, and are enabled only while reading
   - Speed buttons call `ttsService.setPlaybackRate(rate)`
   - Speed choices render as a named `Playback speed` radio group with
     `aria-checked` state
   - Selecting another speed switches the active radio to that option
   - Clicking the currently active speed leaves the selection unchanged
   - If `speedOptions` is `[]`, speed controls are omitted and playback rate is
     reset to `1x` while rewind/forward/stop still render
6. **Keyboard Interaction**: Arrow keys, Home and End move focus within one cluster, either the speed radio group or the Rewind/Fast-forward/Stop buttons, and skip disabled controls; arrowing onto a speed also selects it. Every control is a Tab stop except the speed radios, which share one Tab stop on the checked option
7. **Active State**: Opening or closing the panel dispatches a bubbling, composed `pie-tool-active-change` event with `{ active }` and mirrors the state in the host's `data-active` attribute
8. **Cleanup**: Clears its highlight target resolver provider on unmount

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
- Tool calls `ttsService.speak(readingTarget, { catalogId: 'auto-prompt-q1-0' })`
- TTSService finds SSML in extracted catalogs
- Speaks with proper math pronunciation and pacing

**Result:** Authors get high-quality TTS without maintaining separate catalog files.

## Styling

The component uses scoped styles and doesn't require external CSS. Styling uses `--pie-*` token variables:

- **Trigger**: Circular play/pause button that indicates panel open state
- **Panel**: Floating card with the controls in a row; in the compact `left-aligned` overlay the speed options stack below them
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
through `--pie-button-border` / `--pie-border`, and
foreground through `--pie-button-color` / `--pie-text`. Setting a hook is how a
host opts into a distinct active/open appearance.

This differs deliberately from `@pie-players/pie-tool-calculator-inline-desmos`,
whose equivalent hooks fall back to a filled `--pie-primary` look. This trigger
has never had a filled active state — the panel opening is itself the state
indication — so these defaults do not introduce one. Hosts remain responsible for
maintaining WCAG AA foreground/background contrast when overriding active trigger
colors.

### Overlay panel colours

The floating and left-aligned panels take their colour from the active theme.
Each surface resolves a component-scoped hook first, then a canonical token,
then a literal that only applies when no theme is loaded:

```css
--pie-tts-button-color        /* media glyphs, selected speed → --pie-button-color */
--pie-tts-inline-muted-color  /* unselected speed labels     → --pie-button-color */
--pie-tts-selected-bg         /* the card                    → --pie-surface / --pie-white */
--pie-selected-button-background /* selected speed chip      → --pie-button-active-bg */
--pie-selected-button-border  /* selected speed chip border  → --pie-button-border */
--pie-tts-menu-shadow         /* card elevation */
--pie-tts-card-border         /* card hairline; `transparent` for shadow-only */
```

None of the seven is a registered host token. Each is read as
`var(--x, fallback)`, so a host declaration wins without `!important`, and each
carries no compatibility guarantee — the panel's internals may move it.

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

Trigger and control backgrounds read `--pie-button-background-color` ahead of
the canonical `--pie-button-bg`; borders and hover backgrounds read
`--pie-button-border` and `--pie-button-hover-bg`. Each falls back to the broad
surface tokens.

## Architecture

This tool follows the PIE Assessment Toolkit tool pattern:

- Always rendered in DOM at natural position
- Services arrive through `connectToolRuntimeContext`, and the reading scope
  through `connectToolShellContext` and `connectToolRegionScopeContext`
- One instance owns playback at a time across the page
- Panel state is announced with `pie-tool-active-change`, which the packaged
  toolbar registration subscribes to

## Example

See active demos in `apps/section-demos`.

## License

MIT
