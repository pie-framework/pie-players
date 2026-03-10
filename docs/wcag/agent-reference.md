# Agent Reference

This file is a compact retrieval-oriented reference for AI agents working in this repo.

Use it before making accessibility claims or drafting WCAG findings.

## Hard Rules

- If a claim is not backed by an official W3C/WAI URL, do not state it as a WCAG fact.
- Prefer citing the official source directly instead of paraphrasing uncertain details.
- Do not treat passing automation as proof of compliance.
- Distinguish `Normative standard`, `Official supporting guidance`, and `Project guidance`.

## First Sources To Reach For

| Need | Source |
| --- | --- |
| exact requirement or conformance language | [WCAG 2.2](https://www.w3.org/TR/wcag22/) |
| quick criterion lookup | [Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/) |
| explanation and examples | [Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/) |
| widget behavior | [APG](https://www.w3.org/TR/wai-aria-practices-1.2/) |
| review process | [Evaluating Web Accessibility Overview](https://www.w3.org/WAI/test-evaluate/) |
| conformance-style audit flow | [WCAG-EM Overview](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/) |

## Trigger Map

| Trigger phrase | Start with | Inspect for |
| --- | --- | --- |
| dialog, modal, panel, overlay | [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/) | initial focus, contained tab order, close behavior, `aria-modal`, return focus |
| toolbar, grouped buttons, floating tool controls | [Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) | whether toolbar semantics are appropriate, labeling, arrow-key model, focus management |
| splitter, resize divider, adjustable panes | [Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) | `role="separator"`, value properties, arrow-key behavior, pane relationship |
| slider, range, value scrubber | [Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) | native-vs-custom choice, keyboard, `aria-valuenow`, `aria-valuetext`, target size |
| heading, region, main, passage pane, item pane | [Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/) | landmark choice, labels, repeated landmarks, bypass opportunities |
| label, accessible name, icon button | [Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/) | stable names, label-in-name, `aria-label` vs visible label, duplicate or vague names |
| keyboard-only, tab order, roving focus | [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | predictable focus movement, tab stops, key conflicts, no traps |
| announcements, live region, saved, speaking, activated | [WCAG 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | whether status is announced without moving focus |
| focus hidden, overlay covers focus, sticky UI | [WCAG 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum), [WCAG 2.4.13](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance) | whether focused element remains visible and indicator is strong enough |
| drag only, resize only, move only | [WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements), [WCAG 2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard) | keyboard or single-pointer alternative |
| tiny button, resize handle, close icon | [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | minimum target size and spacing |
| color-only state, low-contrast chrome | [WCAG 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color), [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum), [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast) | text and non-text contrast, non-color cues |

## Repo Shortcuts

Use these local docs before exploring the entire codebase:

- [`official-sources.md`](./official-sources.md)
- [`wcag-2.2-aa-baseline.md`](./wcag-2.2-aa-baseline.md)
- [`patterns-and-widgets.md`](./patterns-and-widgets.md)
- [`project-surface-map.md`](./project-surface-map.md)
- [`../evals/readme.md`](../evals/readme.md)

## Reporting Rule

When writing findings:

1. cite the WCAG criterion ID and title
2. cite the affected repo surface
3. separate standard requirement from project interpretation
4. mention when evidence is only automated or only manual
