# Project Surface Map

This document maps pie-players surfaces to the WCAG criteria, official guidance
and local docs that govern them, for contributors deciding what to review in a
package or feature area. It is organized by pattern, so it survives file renames.

## Map Usage

- Use it together with [`wcag-2.2-aa-baseline.md`](./wcag-2.2-aa-baseline.md) and [`patterns-and-widgets.md`](./patterns-and-widgets.md).
- The `Relevant criteria` column is a starting point for review; it is not an audit result.

## Review Tiers

These tiers define the default project-wide review scope.

| Tier | Scope | Notes |
| --- | --- | --- |
| Tier 1 (critical) | `packages/section-player`, `packages/item-player`, `packages/assessment-player`, `packages/assessment-toolkit`, `packages/tool-*`, `packages/theme`, `packages/print-player` | Primary learner-facing and shipped custom-element surfaces. |
| Tier 2 (integration) | `apps/section-demos`, `apps/item-demos`, `apps/assessment-demos`, `apps/docs` | Integration wrappers and demo chrome that can add or hide accessibility defects. |
| Tier 3 (support) | `packages/section-player-tools-*` and demo-only support panels | Lower learner impact, still reviewed when visible in supported demo flows. |

## Surface Map

| Surface | What it includes | Relevant criteria | Useful guidance | Existing local references |
| --- | --- | --- | --- | --- |
| `assessment-toolkit` | Toolbar orchestration, tool mounting, tool visibility, shared runtime behavior | `1.3.1`, `2.1.1`, `2.4.3`, `2.5.8`, `4.1.2`, `4.1.3` | [Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/), [Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/) | [`../tools-and-accomodations/tool_provider_system.md`](../tools-and-accomodations/tool_provider_system.md), [`../tools-and-accomodations/tool_host_contract.md`](../tools-and-accomodations/tool_host_contract.md) |
| Floating tool windows and hosted shells | Draggable and resizable tool containers, close controls, z-index layering, focus return | `2.1.1`, `2.1.2`, `2.4.3`, `2.4.11`, `2.4.13`, `2.5.7`, `4.1.2` | [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/), [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | [`../tools-and-accomodations/architecture.md`](../tools-and-accomodations/architecture.md) |
| `section-player` layout and shell | Main layout, passage pane, item pane, shell regions, repeated cards | `1.3.1`, `1.3.2`, `2.4.1`, `2.4.3`, `2.4.6`, `4.1.2` | [Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/), [WCAG 2.4.1](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks) | [`../section-player/integration-guide.md`](../section-player/integration-guide.md), [`../../packages/section-player/README.md`](../../packages/section-player/README.md) |
| Split-pane divider and pane resizing | Adjustable horizontal space between passages and items | `2.1.1`, `2.4.3`, `2.4.7`, `2.4.11`, `4.1.2` | [Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) | `packages/section-player`, `apps/section-demos` |
| TTS and accessibility-catalog flows | TTS controls, spoken alternatives, speech state, language, SSML-backed alternatives | `1.1.1`, `3.1.1`, `3.1.2`, `3.3.2`, `4.1.3` | [WCAG 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages), [WCAG 3.1.1](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page), [WCAG 3.1.2](https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts) | [`../accessibility/accessibility-catalogs-quick-start.md`](../accessibility/accessibility-catalogs-quick-start.md), [`../accessibility/accessibility-catalogs-integration-guide.md`](../accessibility/accessibility-catalogs-integration-guide.md), [`../accessibility/accessibility-catalogs-tts-integration.md`](../accessibility/accessibility-catalogs-tts-integration.md), [`../accessibility/tts-deep-dive.md`](../accessibility/tts-deep-dive.md), [`../accessibility/tts-architecture.md`](../accessibility/tts-architecture.md) |
| Selection-based tools | Annotation toolbar, highlight controls, text-selection overlays | `1.3.2`, `2.1.1`, `2.4.3`, `3.2.1`, `4.1.3` | [Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/), [WCAG 3.2.1](https://www.w3.org/WAI/WCAG22/Understanding/on-focus), [WCAG 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | `packages/tool-annotation-toolbar` |
| Line reader and masking overlays | Reading guide, window pane and obscuring frame, movement and resize controls, overlay behavior | `2.1.1`, `2.4.11`, `2.5.7`, `2.5.8`, `4.1.2`, `4.1.3` | [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), [WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements) | `packages/tool-line-reader` |
| Answer eliminator and compact answer controls | Injected or adjacent controls inside question content, toggle state, compact icon buttons | `1.4.11`, `2.4.3`, `2.5.3`, `2.5.8`, `4.1.2`, `4.1.3` | [Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/), [WCAG 2.5.3](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name) | `packages/tool-answer-eliminator` |
| Math, graph, calculator, ruler, protractor, periodic table | Domain-specific tools with custom interaction surfaces | `1.1.1`, `2.1.1`, `2.5.7`, `2.5.8`, `4.1.2` | [Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/), [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | `packages/tool-calculator-*`, `packages/tool-graph`, `packages/tool-ruler`, `packages/tool-protractor`, `packages/tool-periodic-table` |
| Dictionary and picture dictionary | Lookup field, result panel, picture results, loading and empty states | `1.1.1`, `1.3.1`, `2.1.1`, `2.4.3`, `3.3.2`, `4.1.2`, `4.1.3` | [Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/), [WCAG 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | `packages/tool-dictionary`, `packages/tool-picture-dictionary`, [`../tools-and-accomodations/dictionary-languages-and-services.md`](../tools-and-accomodations/dictionary-languages-and-services.md) |
| Sign-language video | Catalog-driven sign-language video window, playback controls | `1.2.6` (AAA), `2.1.1`, `2.2.2`, `2.5.7`, `4.1.2` | [WCAG 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide), [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | `packages/tool-sign-language`, [`../prds/sign-language-asl-support.md`](../prds/sign-language-asl-support.md) |
| Theme and color schemes | Base themes, color schemes, token fallbacks for text, controls and focus indicators | `1.4.1`, `1.4.3`, `1.4.11`, `2.4.7`, `2.4.13` | [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum), [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast) | `packages/theme`, `packages/tool-color-scheme` (the color-scheme tool, `theme`), [`../theming/how-theming-works.md`](../theming/how-theming-works.md) |
| `item-player` | Single-item delivery custom element, item content, response controls, session events | `1.3.1`, `2.1.1`, `2.4.3`, `3.3.2`, `4.1.2`, `4.1.3` | [Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/), [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | [`../item-player/overview.md`](../item-player/overview.md), [`../../packages/item-player/README.md`](../../packages/item-player/README.md) |
| `assessment-player` | Multi-section navigation, position and progress chrome, section transitions | `1.4.4`, `1.4.10`, `2.4.1`, `2.4.3`, `2.4.6`, `2.5.8`, `4.1.2`, `4.1.3` | [Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/), [WCAG 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | [`../../packages/assessment-player/README.md`](../../packages/assessment-player/README.md) |
| `print-player` | Printed item and passage rendering, print alternates | `1.1.1`, `1.3.1`, `1.3.2`, `1.4.1`, `1.4.3` | [WCAG 1.1.1](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content), [WCAG 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships) | [`../../packages/print-player/README.md`](../../packages/print-player/README.md), [`../accessibility/accessibility-catalogs-integration-guide.md`](../accessibility/accessibility-catalogs-integration-guide.md) |
| Timed media sections | Video stimulus with a cue timeline, media controls, items delivered at cues | `1.2.1`, `1.2.2`, `1.2.3`, `1.2.5`, `1.4.2`, `2.1.1`, `2.2.2`, `4.1.2`, `4.1.3` | [WCAG 1.2.2](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded), [WCAG 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide) | [`../../packages/section-player/README.md#timed-media`](../../packages/section-player/README.md#timed-media), [`../architecture/timed-media-section.md`](../architecture/timed-media-section.md) |
| Audio and transcripts | Recorded spoken alternates, audio stimuli, transcript accommodation, audio autoplay | `1.2.1`, `1.4.2`, `2.1.1`, `4.1.2`, `4.1.3` | [WCAG 1.2.1](https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded), [WCAG 1.4.2](https://www.w3.org/WAI/WCAG22/Understanding/audio-control) | [`../prds/audio-accommodations.md`](../prds/audio-accommodations.md), [`../accessibility/accessibility-catalogs-integration-guide.md`](../accessibility/accessibility-catalogs-integration-guide.md) |
| Dictation | Platform and assistive-technology dictation into response fields | `2.5.3`, `3.3.2`, `4.1.2` | [Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/), [WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) | [`../tools-and-accomodations/non-embedded-dictation.md`](../tools-and-accomodations/non-embedded-dictation.md) |
| Demo apps | Integrated review harness for layout, mode, runtime combinations, and consumer integration behavior | depends on route and feature | [Evaluating Web Accessibility Overview](https://www.w3.org/WAI/test-evaluate/), [WCAG-EM Overview](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/) | `apps/section-demos`, `apps/item-demos`, `apps/assessment-demos`, `apps/docs`, [`../setup/demo_system.md`](../setup/demo_system.md) |

## Review Focus By Surface Type

### Shell and layout surfaces

Focus on:

- landmarks
- headings
- reading order
- bypass paths
- focus order across panes

### Floating and transient surfaces

Focus on:

- how the surface opens
- where focus moves
- whether background content remains interactive
- how the surface closes
- whether focus returns correctly

### Compact tool controls

Focus on:

- target size
- icon naming
- pressed state
- visible focus
- non-text contrast

### Custom interaction tools

Focus on:

- keyboard alternatives
- pointer-only assumptions
- clear instructions
- status announcements
- whether the custom widget is exposing stable role and state information

## In This Project

Architecture docs explain how the system is built, tool docs explain feature
behavior, and this WCAG library interprets those surfaces against official
accessibility guidance. Each keeps its own job, so standards text is not
duplicated and test specs do not stand in for the standard.
