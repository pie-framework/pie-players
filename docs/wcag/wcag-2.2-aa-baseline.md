# WCAG 2.2 AA Baseline For PIE Players

This document is the project's high-signal WCAG baseline for review and implementation work.

It is not a substitute for the full standard. It is a compact map of the criteria that are most likely to matter in:

- `assessment-toolkit`
- `section-player`
- floating tool windows
- dialogs and settings panels
- split-pane layouts
- text selection and annotation tools
- TTS, math, and accommodation workflows

For exhaustive criterion lookup, use the official [How to Meet WCAG 2.2 (Quick Reference)](https://www.w3.org/WAI/WCAG22/quickref/).

## How To Read This Baseline

- `WCAG scope` tells you the criterion and level
- `Why it matters here` is project guidance, not WCAG text
- `Official links` point to W3C/WAI references for authoritative details

## Perceivable

| WCAG scope | Why it matters here | Official links |
| --- | --- | --- |
| `1.1.1` Non-text Content `Level A` | Images, icons, diagrams, math renderings, and tool graphics need meaningful text alternatives or correct decorative treatment. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content) |
| `1.3.1` Info and Relationships `Level A` | Headings, landmarks, field grouping, question structure, and passage-to-item relationships must be programmatically exposed. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships) |
| `1.3.2` Meaningful Sequence `Level A` | Light DOM, shadow DOM, and dynamically mounted tools cannot create a confusing reading order. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence) |
| `1.3.3` Sensory Characteristics `Level A` | Instructions cannot rely only on visual position, color, or shape such as “use the tool on the right” or “click the green button”. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/sensory-characteristics) |
| `1.4.1` Use of Color `Level A` | Correctness, selection state, elimination state, and tool state cannot be conveyed by color alone. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color) |
| `1.4.3` Contrast (Minimum) `Level AA` | Small toolbar controls, floating-panel chrome, tool labels, and helper text must keep text contrast high enough. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) |
| `1.4.10` Reflow `Level AA` | Section layouts, passage panes, and floating tools need to work at narrow widths without forcing two-dimensional scrolling for ordinary reading tasks. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/reflow) |
| `1.4.11` Non-text Contrast `Level AA` | Borders, icons, focus rings, separators, resize handles, and other UI affordances must remain perceivable. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast) |
| `1.4.12` Text Spacing `Level AA` | Tight tool panels and dense assessment layouts must tolerate increased line height, letter spacing, and paragraph spacing. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing) |
| `1.4.13` Content on Hover or Focus `Level AA` | Tooltips, hover popovers, and focus-triggered helper UI must be dismissible, hoverable, and persistent enough to use. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus) |

## Operable

| WCAG scope | Why it matters here | Official links |
| --- | --- | --- |
| `2.1.1` Keyboard `Level A` | Toolbars, floating windows, splitters, annotation tools, and every assessment interaction need complete keyboard operation. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/keyboard) |
| `2.1.2` No Keyboard Trap `Level A` | Floating tools and dialogs cannot trap users without a predictable way out. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap) |
| `2.2.1` Timing Adjustable `Level A` | If timing or expiry flows are added in the host experience, accommodations and warnings need review. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable) |
| `2.4.1` Bypass Blocks `Level A` | Complex shells with menus, passage panes, toolbars, and repeated card chrome need a way to reach main task content efficiently. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks) |
| `2.4.3` Focus Order `Level A` | Dynamic mounting, overlays, panes, and injected controls must keep focus movement logical. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-order) |
| `2.4.6` Headings and Labels `Level AA` | Item shells, passage shells, dialogs, and tool controls need descriptive labels that match user expectations. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels) |
| `2.4.7` Focus Visible `Level AA` | Every keyboard-operable control needs an obvious visible focus indicator. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible) |
| `2.4.11` Focus Not Obscured (Minimum) `Level AA` | Sticky chrome, overlays, masking tools, and floating windows cannot hide the focused element. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) |
| `2.4.13` Focus Appearance `Level AA` | Focus indicators must be strong enough in color and area, not just technically present. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance) |
| `2.5.3` Label in Name `Level A` | Spoken labels for toolbar and dialog controls need to include the visible label text, especially for voice users and consistency. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name) |
| `2.5.7` Dragging Movements `Level AA` | Draggable or resizable tools need a single-pointer or keyboard alternative rather than drag-only operation. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements) |
| `2.5.8` Target Size (Minimum) `Level AA` | Small tool icons, close buttons, resize handles, and toggles need adequate target size or spacing. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) |

## Understandable

| WCAG scope | Why it matters here | Official links |
| --- | --- | --- |
| `3.1.1` Language of Page `Level A` | Hosts, demos, and content containers should identify language so TTS and screen readers use the right pronunciation rules. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page) |
| `3.1.2` Language of Parts `Level AA` | Mixed-language content, math annotations, and accessibility catalog alternatives may need explicit language changes. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts) |
| `3.2.1` On Focus `Level A` | Focusing a tool or question control must not trigger unexpected navigation or major context changes. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/on-focus) |
| `3.2.2` On Input `Level A` | Selecting answers, changing settings, or toggling accommodations must not surprise users with unrelated side effects. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/on-input) |
| `3.3.1` Error Identification `Level A` | Validation and tool errors need to identify what went wrong. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/error-identification) |
| `3.3.2` Labels or Instructions `Level A` | Tools, panels, and question interactions need clear setup and usage instructions. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions) |

## Robust

| WCAG scope | Why it matters here | Official links |
| --- | --- | --- |
| `4.1.2` Name, Role, Value `Level A` | Custom elements, toolbar buttons, splitters, and dynamic tool UIs must expose stable semantics and state. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) |
| `4.1.3` Status Messages `Level AA` | TTS state, save state, annotation feedback, and tool activation changes should be announced without stealing focus. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) |

## High-Priority Pattern Clusters In This Repo

These are not WCAG criteria themselves. They are project groupings that repeatedly touch multiple criteria above.

### Floating windows and dialogs

Review especially against:

- `2.1.1`
- `2.1.2`
- `2.4.3`
- `2.4.7`
- `2.4.11`
- `2.4.13`
- `4.1.2`
- `4.1.3`

### Toolbars and compact controls

Review especially against:

- `1.4.11`
- `2.1.1`
- `2.4.6`
- `2.5.3`
- `2.5.8`
- `4.1.2`

### Split-pane layouts and dividers

Review especially against:

- `1.3.1`
- `2.1.1`
- `2.4.3`
- `2.4.7`
- `2.4.11`
- `4.1.2`

### Selection-driven and text-overlay tools

Review especially against:

- `1.3.2`
- `2.1.1`
- `2.4.3`
- `2.4.11`
- `3.2.1`
- `4.1.3`

### Math, TTS, and accommodation flows

Review especially against:

- `1.1.1`
- `3.1.1`
- `3.1.2`
- `3.3.2`
- `4.1.3`

## Project Rule

When documenting findings, cite the criterion by ID and title, then link to the official W3C page instead of paraphrasing the standard from memory.
