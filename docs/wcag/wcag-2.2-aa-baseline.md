# WCAG 2.2 AA Baseline For PIE Players

This document lists the WCAG 2.2 criteria most likely to matter in pie-players,
each with a project note, for contributors implementing or reviewing UI. The
surfaces it covers:

- `assessment-toolkit`
- `section-player`
- floating tool windows
- dialogs and settings panels
- split-pane layouts
- text selection and annotation tools
- TTS, math, and accommodation workflows
- timed media, recorded audio and sign-language video

The full criterion list is the official [How to Meet WCAG 2.2 (Quick Reference)](https://www.w3.org/WAI/WCAG22/quickref/).

## Table Columns

- `WCAG scope` gives the criterion and level
- `Why it matters here` is project guidance; it is not WCAG text
- `Official links` point to the W3C/WAI references that settle the details

## Perceivable

| WCAG scope | Why it matters here | Official links |
| --- | --- | --- |
| `1.1.1` Non-text Content `Level A` | Images, icons, diagrams, math renderings, and tool graphics need meaningful text alternatives or correct decorative treatment. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content) |
| `1.2.1` Audio-only and Video-only (Prerecorded) `Level A` | Recorded audio stimuli and spoken recordings need a text alternative; the `transcript` catalog type and the audio transcript accommodation carry it. Signing video is a media alternative for the item's text, which the criterion exempts when it is labeled as one. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded) |
| `1.2.2` Captions (Prerecorded) `Level A` | Video stimuli with speech, timed-media sections included, need synchronized captions. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded) |
| `1.2.3` Audio Description or Media Alternative (Prerecorded) `Level A` | Video stimuli whose visuals carry meaning need audio description or a full text alternative. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/audio-description-or-media-alternative-prerecorded) |
| `1.2.5` Audio Description (Prerecorded) `Level AA` | At AA, those video stimuli need audio description; a text alternative alone no longer suffices. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/audio-description-prerecorded) |
| `1.2.6` Sign Language (Prerecorded) `Level AAA` | Beyond the AA baseline; the sign-language tool delivers it where content carries `sign-language` cards. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/sign-language-prerecorded) |
| `1.3.1` Info and Relationships `Level A` | Headings, landmarks, field grouping, question structure, and passage-to-item relationships must be programmatically exposed. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships) |
| `1.3.2` Meaningful Sequence `Level A` | Light DOM, shadow DOM, and dynamically mounted tools cannot create a confusing reading order. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence) |
| `1.3.3` Sensory Characteristics `Level A` | Instructions cannot rely only on visual position, color, or shape such as “use the tool on the right” or “click the green button”. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/sensory-characteristics) |
| `1.4.1` Use of Color `Level A` | Correctness, selection state, elimination state, and tool state cannot be conveyed by color alone. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color) |
| `1.4.2` Audio Control `Level A` | Audio that starts automatically and runs longer than 3 seconds, such as stimulus autoplay, needs a pause or stop control or a volume control independent of the system volume. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/audio-control) |
| `1.4.3` Contrast (Minimum) `Level AA` | Small toolbar controls, floating-panel chrome, tool labels, and helper text must keep text contrast high enough. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) |
| `1.4.4` Resize Text `Level AA` | Item, passage and tool text must resize to 200% without loss of content or function, including in fixed-size tool panels. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/resize-text) |
| `1.4.10` Reflow `Level AA` | Section layouts, passage panes, and floating tools need to work at narrow widths without forcing two-dimensional scrolling for ordinary reading tasks. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/reflow) |
| `1.4.11` Non-text Contrast `Level AA` | Borders, icons, focus rings, separators, resize handles, and other UI affordances must remain perceivable. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast) |
| `1.4.12` Text Spacing `Level AA` | Tight tool panels and dense assessment layouts must tolerate increased line height, letter spacing, and paragraph spacing. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing) |
| `1.4.13` Content on Hover or Focus `Level AA` | Tooltips, hover popovers, and focus-triggered helper UI must be dismissible, hoverable, and persistent enough to use. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus) |

## Operable

| WCAG scope | Why it matters here | Official links |
| --- | --- | --- |
| `2.1.1` Keyboard `Level A` | Toolbars, floating windows, splitters, annotation tools, and every assessment interaction need complete keyboard operation. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/keyboard) |
| `2.1.2` No Keyboard Trap `Level A` | Floating tools and dialogs cannot trap users without a predictable way out. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap) |
| `2.1.4` Character Key Shortcuts `Level A` | A single-character shortcut must be possible to turn off or remap, or be active only while its control has focus. The ruler's `U` unit switch is bound to the focused ruler, which the criterion exempts. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts) |
| `2.2.1` Timing Adjustable `Level A` | If timing or expiry flows are added in the host experience, accommodations and warnings need review. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable) |
| `2.2.2` Pause, Stop, Hide `Level A` | Moving content that starts automatically and lasts more than 5 seconds, such as autoplaying video and animated indicators, needs a way to pause, stop or hide it. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide) |
| `2.4.1` Bypass Blocks `Level A` | Complex shells with menus, passage panes, toolbars, and repeated card chrome need a way to reach main task content efficiently. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks) |
| `2.4.3` Focus Order `Level A` | Dynamic mounting, overlays, panes, and injected controls must keep focus movement logical. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-order) |
| `2.4.6` Headings and Labels `Level AA` | Item shells, passage shells, dialogs, and tool controls need descriptive labels that match user expectations. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels) |
| `2.4.7` Focus Visible `Level AA` | Every keyboard-operable control needs an obvious visible focus indicator. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible) |
| `2.4.11` Focus Not Obscured (Minimum) `Level AA` | Sticky chrome, overlays, masking tools, and floating windows cannot hide the focused element. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) |
| `2.4.13` Focus Appearance `Level AAA` | Beyond the AA baseline; the project holds focus indicators to it, which sets a minimum indicator area and a 3:1 contrast change between focused and unfocused states. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance) |
| `2.5.3` Label in Name `Level A` | Spoken labels for toolbar and dialog controls need to include the visible label text, especially for voice users and consistency. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name) |
| `2.5.7` Dragging Movements `Level AA` | Draggable or resizable tools need a single-pointer alternative that does not drag, such as buttons or tap-to-place; a keyboard alternative alone does not meet it. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements) |
| `2.5.8` Target Size (Minimum) `Level AA` | Small tool icons, close buttons, resize handles, and toggles need a 24 by 24 CSS px target or enough spacing around a smaller one. | [Understanding](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) |

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

## Pattern Clusters

Project groupings of criteria that the same surfaces touch together; they are
not part of WCAG.

| Cluster | Review against |
| --- | --- |
| Floating windows and dialogs | `2.1.1` Keyboard, `2.1.2` No Keyboard Trap, `2.4.3` Focus Order, `2.4.7` Focus Visible, `2.4.11` Focus Not Obscured (Minimum), `2.4.13` Focus Appearance, `4.1.2` Name, Role, Value, `4.1.3` Status Messages |
| Toolbars and compact controls | `1.4.11` Non-text Contrast, `2.1.1` Keyboard, `2.4.6` Headings and Labels, `2.5.3` Label in Name, `2.5.8` Target Size (Minimum), `4.1.2` Name, Role, Value |
| Split-pane layouts and dividers | `1.3.1` Info and Relationships, `2.1.1` Keyboard, `2.4.3` Focus Order, `2.4.7` Focus Visible, `2.4.11` Focus Not Obscured (Minimum), `4.1.2` Name, Role, Value |
| Selection-driven and text-overlay tools | `1.3.2` Meaningful Sequence, `2.1.1` Keyboard, `2.4.3` Focus Order, `2.4.11` Focus Not Obscured (Minimum), `3.2.1` On Focus, `4.1.3` Status Messages |
| Math, TTS, and accommodation flows | `1.1.1` Non-text Content, `3.1.1` Language of Page, `3.1.2` Language of Parts, `3.3.2` Labels or Instructions, `4.1.3` Status Messages |
| Timed media, audio and video | `1.2.1` Audio-only and Video-only (Prerecorded), `1.2.2` Captions (Prerecorded), `1.2.3` Audio Description or Media Alternative (Prerecorded), `1.2.5` Audio Description (Prerecorded), `1.4.2` Audio Control, `2.2.2` Pause, Stop, Hide |

## Project Rule

A finding cites the criterion by ID and title and links the official W3C page; it never paraphrases the standard from memory.
