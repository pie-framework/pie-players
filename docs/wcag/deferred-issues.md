# Deferred Accessibility Issues

This document tracks the confirmed accessibility issues and evidence gaps in
pie-players that still need follow-up, for contributors deciding what to fix
next. It is not exhaustive.

## Source Classification

- **Normative standard**: [WCAG 2.2](https://www.w3.org/TR/wcag22/)
- **Official supporting guidance**:
  - [Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/)
  - [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/)
  - [Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)
  - [Evaluating Web Accessibility Overview](https://www.w3.org/WAI/test-evaluate/)
- **Project guidance**: the rest of this document

## Active Product Issues

### `a11y-006`: Item Player Delivery Baseline

- **WCAG**: [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value)
- **Severity**: Medium
- **Surface**: `pie-item-player` rendering a multiple-choice item
- **Evidence**: the delivery-item axe baseline allowlists `aria-allowed-attr` on
  the rendered multiple-choice surface. The invalid ARIA comes from the element
  in [pie-elements-ng](https://github.com/pie-framework/pie-elements-ng).
- **Fix direction**: fix the ARIA in the element source, then remove the
  allowlist from the player-scoped baseline.
- **Verification**: `packages/item-player/tests/item-player-multiple-choice.spec.ts`
  stays scoped to `pie-item-player`; its allowlist is retired once the upstream
  fix lands.

### `a11y-009`: Assessment Player Integrated Baseline

- **WCAG**: [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value)
- **Severity**: Medium
- **Surface**: `pie-assessment-player-default` critical flow
- **Evidence**: the critical-flow axe baseline shows the same `aria-allowed-attr`
  issue through nested multiple-choice item markup (`aria-checked` on an element
  whose role does not support it).
- **Fix direction**: fix the upstream item markup, then remove the
  assessment-player baseline allowlist.
- **Verification**: `packages/assessment-player/tests/assessment-player-smoke.spec.ts`
  keeps its baseline assertion; the allowlist is retired after the upstream fix is
  verified.

## Active Evidence Gaps

### `a11y-005`: Manual Assistive Technology Validation

- **Type**: supporting evidence gap
- **Evidence**: code review and Playwright coverage exist; no manual VoiceOver,
  NVDA or JAWS pass has covered live announcements, dialog behavior or
  reading-mode interactions.
- **Fix direction**: a manual assistive-technology pass following
  [`evaluation-method.md`](./evaluation-method.md).
- **Verification**: the manual pass comes first; browser tests then automate the
  parts they can check reliably.

## Next Work

[`evaluation-method.md`](./evaluation-method.md) and
[`project-surface-map.md`](./project-surface-map.md) guide what to tackle next.
