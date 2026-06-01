# Deferred Accessibility Issues

This document tracks confirmed accessibility issues and evidence gaps that still
need follow-up.

## Source Classification

- **Normative standard**: [WCAG 2.2](https://www.w3.org/TR/wcag22/)
- **Official supporting guidance**:
  - [Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/)
  - [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/)
  - [Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)
  - [Evaluating Web Accessibility Overview](https://www.w3.org/WAI/test-evaluate/)
- **Project guidance**: the rest of this document

## Active Product Issues

| ID | Surface | WCAG | Severity | Current behavior / evidence | Suggested fix direction | Intended verification |
| --- | --- | --- | --- | --- | --- | --- |
| `a11y-006` | Item-player delivery baseline blocked upstream | [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) | Medium | The delivery-item axe baseline for `pie-item-player` still needs a known blocker for `aria-allowed-attr` on the rendered multiple-choice surface. The underlying issue originates in `pie-elements-ng`, not in `pie-players`. | Fix the invalid ARIA at the PIE element source, then remove the `aria-allowed-attr` allowlist from the player-scoped baseline. | Keep `packages/item-player/tests/item-player-multiple-choice.spec.ts` scoped to `pie-item-player` and retire the allowlist once the upstream fix lands. |
| `a11y-009` | Assessment-player integrated baseline blocked by upstream item markup | [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) | Medium | The `pie-assessment-player-default` critical-flow axe baseline exposes the same `aria-allowed-attr` issue through nested multiple-choice item markup (`aria-checked` on unsupported element role). | Fix upstream item markup, then remove the assessment-player baseline allowlist. | Maintain `packages/assessment-player/tests/assessment-player-smoke.spec.ts` baseline assertion and retire the allowlist after upstream fix verification. |

## Active Evidence Gaps

| ID | Surface | Type | Current behavior / evidence | Suggested fix direction | Intended verification |
| --- | --- | --- | --- | --- | --- |
| `a11y-005` | Manual assistive technology validation | Supporting evidence gap | Current evidence is strong for code review and Playwright coverage, but VoiceOver/NVDA/JAWS validation is still missing for live announcements, dialog behavior, and reading mode interactions. | Run a manual AT pass using `docs/wcag/evaluation-method.md`. | Manual pass first; automate only the parts that can be checked reliably in browser tests. |

## Notes

- This file is an active issue tracker, not a claim that the deferred issues are
  the only remaining accessibility concerns.
- Use [`evaluation-method.md`](./evaluation-method.md) and [`project-surface-map.md`](./project-surface-map.md) when deciding what to tackle next.
