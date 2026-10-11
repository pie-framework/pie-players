# Patterns And Widgets

This document maps pie-players UI patterns to official W3C/WAI guidance and
states which pattern each PIE widget implements. It is for tool and element
authors, and for contributors reviewing widgets more complex than plain document
content.

## Source Classification

- **Normative standard**: [WCAG 2.2](https://www.w3.org/TR/wcag22/)
- **Official supporting guidance**:
  - [ARIA Authoring Practices Guide (APG)](https://www.w3.org/WAI/ARIA/apg/)
  - [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/)
  - [Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
  - [Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)
  - [Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)
  - [Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
  - [Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)
  - [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)

## Core Rule

Native HTML behavior comes first. ARIA patterns fill genuine semantic gaps and never replace working native semantics.

## Pattern Map

| Project pattern | Use these official sources | What to verify here |
| --- | --- | --- |
| Modal dialogs and settings panels | [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/), [WCAG 2.4.3](https://www.w3.org/WAI/WCAG22/Understanding/focus-order), [WCAG 2.1.2](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap), [WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) | Opening focus, contained tab order, close behavior, return focus, accurate modal claims, and correct labeling. |
| Toolbars and grouped controls | [Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/), [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Whether the grouping should behave like a real toolbar, whether arrow-key navigation is needed, and whether the toolbar has a stable label. |
| Split panes and adjustable dividers | [Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/), [WCAG 2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard), [WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) | Focusable separator semantics, current value, controlled pane, and keyboard resize behavior. |
| Sliders and custom range controls | [Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/), [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | Prefer native `input[type="range"]`; if custom, verify role, value properties, keyboard support, and touch/AT behavior. |
| Landmarks and top-level layout regions | [Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/), [WCAG 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships), [WCAG 2.4.1](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks) | Meaningful `main`, `complementary`, `navigation`, `region`, and skip/bypass opportunities. |
| Accessible names and descriptions | [Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/), [WCAG 2.5.3](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name), [WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) | Labels that match visible UI, correct use of `aria-label` and `aria-labelledby`, and no duplicate or misleading naming. |
| Keyboard interaction models | [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), [WCAG 2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard) | Predictable key usage, focus movement, roving focus where justified, and no conflicts with native control behavior. |
| Status updates and live feedback | [WCAG 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages), [WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) | Tool activation, save state, speech state, and feedback messages that announce without hijacking focus. |

## Pattern Notes

### Modal Dialogs

A panel that claims to be modal behaves as modal for all users. The dialog
pattern expects:

- focus to move into the dialog when it opens
- Tab and Shift+Tab to stay inside the dialog
- focus to return to the invoking control when the dialog closes, unless workflow logic justifies something else
- `aria-modal="true"` only when the UI actually prevents interaction with background content

Floating windows and settings panels are checked against the dialog pattern
before they are labeled modal.

PIE implements:

- **TTS settings panel** (`section-player-tools-tts-settings`): a modal dialog,
  `role="dialog"` with `aria-modal="true"`.
- **Floating tool windows** (the toolkit's tool shell): on open, focus moves to
  the close button; Escape closes the window and focus returns to the control
  that opened it. Tab stays inside the window unless the tool's shell config sets
  `pageTabOrder`, which hands Tab back to the opener and the item content. The
  focusable header moves the window with the arrow keys, resizes it with
  Shift+arrows and recenters it with Home. The shell sets no `aria-modal`.
- **Tool panels** (dictionary, picture dictionary, graph, periodic table, the
  color-scheme tool `theme`): `role="dialog"` without `aria-modal`.

### Toolbars

The APG toolbar pattern is a grouped-control interaction model: the group is one
tab stop, and arrow keys move between its controls. A control group is either a
set of independent buttons or a toolbar with managed arrow-key navigation;
`role="toolbar"` goes only on a group whose keyboard behavior matches the
pattern.

PIE implements:

- **Item and section toolbar** (`ItemToolBar` in `assessment-toolkit`):
  independent toggle buttons, each a tab stop with `aria-pressed`, without
  `role="toolbar"`.
- **Annotation toolbar** (`tool-annotation-toolbar`): `role="toolbar"`, one tab
  stop; arrow keys move between controls, Home and End jump, Escape dismisses it
  and returns focus.
- **Inline read-aloud tool** (`tool-tts-inline`): `role="toolbar"`, with the speed
  choices as a `radiogroup`; arrow keys stay inside the cluster they start in.

### Window Splitters

The APG window splitter pattern governs adjustable pane dividers. The checks:

- focusable separator role
- accessible name matching the primary pane
- `aria-controls`
- `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`
- keyboard resizing with arrow keys and optional `Home`, `End`, and `Enter`

PIE implements the pattern in the section player's passage-items divider
(`SectionSplitDivider`) and its in-card divider (`SectionCardSplitDivider`):
`role="separator"`, `aria-orientation="vertical"`, `aria-controls`,
`aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext`. Left and
Right arrows resize both; the passage-items divider also takes Home and End.

### Sliders and Ranges

Native `input[type="range"]` comes first; a custom slider is for a need the
native control cannot meet, and it follows the slider pattern. A custom range UI
is checked for:

- clear labeling
- current value exposure
- keyboard support
- target size
- real assistive-technology behavior on touch platforms

PIE implements native ranges only: the graph tool's grid-opacity control is an
`input type="range"`, and no package defines a custom `role="slider"`.

### Landmarks and Regions

In the integrated section player, landmarks give users fast navigation between:

- passage content
- item content
- supporting panels
- navigation or mode chrome

A landmark goes only where it adds navigational value; modal content gets no
extra landmark.

PIE implements: the split-pane layout puts passages in a labeled `<aside>` and
items in a labeled `<main>`, and the section shell puts section tools in a
labeled `<aside>`.

### Accessible Names

Compact tool icons and icon-only buttons depend on their accessible name. The
checks:

- the control has a stable accessible name
- visible text and spoken name stay aligned
- labels describe the action or state clearly

### Status Messages

Most interactions here change state without page navigation, so `4.1.3`
governs:

- TTS start, pause, and stop state
- annotation and highlight feedback
- answer eliminator state changes
- save or persistence feedback
- tool open and close announcements where appropriate

PIE implements: the annotation toolbar, the inline read-aloud tool and the line
reader announce through polite live regions (`role="status"`,
`aria-live="polite"`). The answer eliminator adds visually hidden
"(eliminated)" text to the choice label, so a screen reader reads the state with
the choice.

## In This Project

Assessment tools often match no single APG pattern. For a custom surface:

1. identify the nearest official pattern
2. verify that the implementation still satisfies WCAG criteria even if it is not a literal APG example
3. document any project-specific deviation as project guidance, not as a standard rule
