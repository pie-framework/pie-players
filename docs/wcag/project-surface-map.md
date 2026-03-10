# Project Surface Map

This document maps major repo surfaces to likely WCAG concerns, relevant guidance, and useful local references.

It is intentionally pattern-oriented. It should stay useful even when file names or implementation details change.

## How To Use This Map

- Start here when deciding what to review for a package or feature area.
- Use it together with [`wcag-2.2-aa-baseline.md`](./wcag-2.2-aa-baseline.md) and [`patterns-and-widgets.md`](./patterns-and-widgets.md).
- Treat the `Relevant criteria` column as a starting point, not a full audit result.

## Surface Map

| Surface | What it includes | Relevant criteria | Useful guidance | Existing local references |
| --- | --- | --- | --- | --- |
| `assessment-toolkit` | Toolbar orchestration, tool mounting, tool visibility, shared runtime behavior | `1.3.1`, `2.1.1`, `2.4.3`, `2.5.8`, `4.1.2`, `4.1.3` | [Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/), [Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/) | [`../tool_provider_system.md`](../tool_provider_system.md), [`../tool_host_contract.md`](../tool_host_contract.md), [`../evals/assessment-toolkit/tools-coordination/evals.yaml`](../evals/assessment-toolkit/tools-coordination/evals.yaml) |
| Floating tool windows and hosted shells | Draggable and resizable tool containers, close controls, z-index layering, focus return | `2.1.1`, `2.1.2`, `2.4.3`, `2.4.11`, `2.4.13`, `2.5.7`, `4.1.2` | [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/), [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | [`../tools-and-accomodations/architecture.md`](../tools-and-accomodations/architecture.md), [`../evals/assessment-toolkit/a11y-intent/evals.yaml`](../evals/assessment-toolkit/a11y-intent/evals.yaml) |
| `section-player` layout and shell | Main layout, passage pane, item pane, shell regions, repeated cards | `1.3.1`, `1.3.2`, `2.4.1`, `2.4.3`, `2.4.6`, `4.1.2` | [Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/), [WCAG 2.4.1](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks) | [`../section_player_integration_guide.md`](../section_player_integration_guide.md), [`../assessment-toolkit-section-player-getting-started.md`](../assessment-toolkit-section-player-getting-started.md) |
| Split-pane divider and pane resizing | Adjustable horizontal space between passages and items | `2.1.1`, `2.4.3`, `2.4.7`, `2.4.11`, `4.1.2` | [Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) | `packages/section-player`, `apps/section-demos` |
| TTS and accessibility-catalog flows | TTS controls, spoken alternatives, speech state, language, SSML-backed alternatives | `1.1.1`, `3.1.1`, `3.1.2`, `3.3.2`, `4.1.3` | [WCAG 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages), [WCAG 3.1.1](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page), [WCAG 3.1.2](https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts) | [`../accessibility-catalogs-quick-start.md`](../accessibility-catalogs-quick-start.md), [`../accessibility-catalogs-integration-guide.md`](../accessibility-catalogs-integration-guide.md), [`../accessibility-catalogs-tts-integration.md`](../accessibility-catalogs-tts-integration.md), [`../tts-architecture.md`](../tts-architecture.md) |
| Selection-based tools | Annotation toolbar, highlight controls, text-selection overlays | `1.3.2`, `2.1.1`, `2.4.3`, `3.2.1`, `4.1.3` | [Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/), [WCAG 3.2.1](https://www.w3.org/WAI/WCAG22/Understanding/on-focus), [WCAG 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | [`../evals/tools/annotation-toolbar/evals.yaml`](../evals/tools/annotation-toolbar/evals.yaml) |
| Line reader and masking overlays | Reading guide, masking mode, movement and resize controls, overlay behavior | `2.1.1`, `2.4.11`, `2.5.7`, `2.5.8`, `4.1.2`, `4.1.3` | [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), [WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements) | [`../evals/tools/line-reader/evals.yaml`](../evals/tools/line-reader/evals.yaml) |
| Answer eliminator and compact answer controls | Injected or adjacent controls inside question content, toggle state, compact icon buttons | `1.4.11`, `2.4.3`, `2.5.3`, `2.5.8`, `4.1.2`, `4.1.3` | [Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/), [WCAG 2.5.3](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name) | [`../evals/tools/answer-eliminator/evals.yaml`](../evals/tools/answer-eliminator/evals.yaml) |
| Math, graph, calculator, ruler, protractor, periodic table | Domain-specific tools with custom interaction surfaces | `1.1.1`, `2.1.1`, `2.5.7`, `2.5.8`, `4.1.2` | [Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/), [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | [`../evals/tools/calculator/evals.yaml`](../evals/tools/calculator/evals.yaml), [`../evals/tools/graph/evals.yaml`](../evals/tools/graph/evals.yaml), [`../evals/tools/ruler/evals.yaml`](../evals/tools/ruler/evals.yaml), [`../evals/tools/protractor/evals.yaml`](../evals/tools/protractor/evals.yaml), [`../evals/tools/periodic-table/evals.yaml`](../evals/tools/periodic-table/evals.yaml) |
| Demo apps | Integrated review harness for layout, mode, and runtime combinations | depends on route and feature | [Evaluating Web Accessibility Overview](https://www.w3.org/WAI/test-evaluate/), [WCAG-EM Overview](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/) | `apps/section-demos`, `apps/item-demos`, [`../demo_system.md`](../demo_system.md) |
| Local eval specs | Repeatable supporting checks for behavior and intent | supporting evidence only | [About ACT Rules](https://www.w3.org/WAI/standards-guidelines/act/rules/about/) | [`../evals/readme.md`](../evals/readme.md) |

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

This repo already has useful supporting documents, but they do different jobs:

- architecture docs explain how the system is built
- tool docs explain feature behavior
- eval specs describe local checks
- this WCAG library explains how to interpret those surfaces against official accessibility guidance

Keep those roles separate to avoid duplicating standards text or letting test specs stand in for the standard.
