# Patterns And Widgets

This document maps common `pie-players` UI patterns to official W3C/WAI guidance.

Use it when implementing or reviewing widgets that are more complex than plain document content.

## Source Classification

- **Normative standard**: [WCAG 2.2](https://www.w3.org/TR/wcag22/)
- **Official supporting guidance**:
  - [ARIA Authoring Practices Guide (APG)](https://www.w3.org/TR/wai-aria-practices-1.2/)
  - [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/)
  - [Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
  - [Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)
  - [Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)
  - [Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
  - [Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)
  - [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)

## Core Rule

Prefer native HTML behavior first. Use ARIA patterns to fill genuine semantic gaps, not to replace working native semantics.

## Pattern Map

| Project pattern | Use these official sources | What to verify here |
| --- | --- | --- |
| Modal dialogs and settings panels | [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/), [WCAG 2.4.3](https://www.w3.org/WAI/WCAG22/Understanding/focus-order), [WCAG 2.1.2](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap), [WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) | Opening focus, contained tab order, close behavior, return focus, accurate modal claims, and correct labeling. |
| Toolbars and grouped controls | [Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/), [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Whether the grouping should behave like a real toolbar, whether arrow-key navigation is needed, and whether the toolbar has a stable label. |
| Split panes and adjustable dividers | [Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/), [WCAG 2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard), [WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) | Focusable separator semantics, current value, controlled pane, and keyboard resize behavior. |
| Sliders and custom range controls | [Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/), [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | Prefer native `input[type=\"range\"]`; if custom, verify role, value properties, keyboard support, and touch/AT behavior. |
| Landmarks and top-level layout regions | [Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/), [WCAG 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships), [WCAG 2.4.1](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks) | Meaningful `main`, `complementary`, `navigation`, `region`, and skip/bypass opportunities. |
| Accessible names and descriptions | [Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/), [WCAG 2.5.3](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name), [WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) | Labels that match visible UI, correct use of `aria-label` and `aria-labelledby`, and no duplicate or misleading naming. |
| Keyboard interaction models | [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), [WCAG 2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard) | Predictable key usage, focus movement, roving focus where justified, and no conflicts with native control behavior. |
| Status updates and live feedback | [WCAG 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages), [WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) | Tool activation, save state, speech state, and feedback messages that announce without hijacking focus. |

## Pattern Notes For This Repo

### Modal dialogs

If a panel claims to be modal, it needs to behave as modal for all users.

The official dialog pattern explicitly expects:

- focus to move into the dialog when it opens
- Tab and Shift+Tab to stay inside the dialog
- focus to return to the invoking control when the dialog closes, unless workflow logic justifies something else
- `aria-modal="true"` only when the UI actually prevents interaction with background content

Use the dialog pattern page before labeling floating windows or settings panels as modal.

### Toolbars

The APG toolbar pattern is not just a `role="toolbar"` label. It is a grouped-control interaction model.

In this repo, verify whether a control group should be:

- a simple group of independent buttons, or
- a real toolbar with managed arrow-key navigation

Do not add toolbar semantics if the resulting keyboard behavior does not match the pattern well enough to help users.

### Window splitters

For adjustable pane dividers, the APG window splitter pattern is the most relevant official reference.

High-value checks:

- focusable separator role
- accessible name matching the primary pane
- `aria-controls`
- `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`
- keyboard resizing with arrow keys and optional `Home`, `End`, and `Enter`

### Sliders and ranges

Prefer native `input[type="range"]` where possible. Only reach for a custom slider when the native control is not sufficient.

If the project implements a custom range UI, use the slider pattern and verify:

- clear labeling
- current value exposure
- keyboard support
- target size
- real assistive-technology behavior on touch platforms

### Landmarks and regions

Landmark structure is especially important in the integrated section player experience because users need fast navigation between:

- passage content
- item content
- supporting panels
- navigation or mode chrome

Use landmark regions intentionally. Do not wrap modal content in extra landmarks unless the landmark adds real navigational value.

### Accessible names

For compact tool icons and icon-only buttons, naming quality is often the difference between usable and unusable.

Check that:

- the control has a stable accessible name
- visible text and spoken name stay aligned
- labels describe the action or state clearly

### Status messages

Many project interactions are dynamic and do not trigger page navigation. That makes `4.1.3` especially important for:

- TTS start, pause, and stop state
- annotation and highlight feedback
- answer eliminator state changes
- save or persistence feedback
- tool open and close announcements where appropriate

## In This Project

Some repo surfaces do not line up perfectly with a single APG pattern. That is common for assessment tools.

When a surface is custom:

1. identify the nearest official pattern
2. verify that the implementation still satisfies WCAG criteria even if it is not a literal APG example
3. document any project-specific deviation as project guidance, not as a standard rule
