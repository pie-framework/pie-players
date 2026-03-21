# Deferred Accessibility Issues

This document tracks confirmed accessibility issues and evidence gaps that were intentionally deferred from the current low-risk fix pass.

## Source Classification

- **Normative standard**: [WCAG 2.2](https://www.w3.org/TR/wcag22/)
- **Official supporting guidance**:
  - [Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/)
  - [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/)
  - [Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)
  - [Evaluating Web Accessibility Overview](https://www.w3.org/WAI/test-evaluate/)
- **Project guidance**: the rest of this document

## Deferred Product Issues

| ID | Surface | WCAG | Severity | Current behavior / evidence | Why deferred | Suggested fix direction | Intended automation target | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `a11y-001` | Shared floating dialogs and settings panels | [2.4.3 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order), [2.1.2 No Keyboard Trap](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap), [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) | High | Shared focus trap behavior is now implemented in `packages/players-shared/src/ui/focus-trap.ts` and adopted in tool settings/floating panel surfaces. `section-player-tts-ssml` now includes focused in-dialog keyboard coverage. | N/A | N/A | `packages/section-player/tests/section-player-tts-ssml.spec.ts` | Fixed in-repo |
| `a11y-002` | Hosted floating tool shells | [2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard), [2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements), [2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | High | Hosted shell now provides single-action move/resize/center controls and keyboard alternatives in `packages/assessment-toolkit/src/components/ItemToolBar.svelte`. | N/A | N/A | `packages/section-player/tests/section-toolbar-tools.spec.ts` | Fixed in-repo |
| `a11y-003` | Splitpane narrow-width layout | [1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | High | Splitpane stacked-pane overflow constraints were tightened and dedicated 320px reflow checks were added for `question-passage` and `tts-ssml`. | N/A | N/A | `packages/section-player/tests/section-player-reflow.spec.ts` | Fixed in-repo |
| `a11y-008` | Post-navigation focus placement in section player | [2.4.3 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order), [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible), [2.4.11 Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | High | A safe opt-in policy path is now available (`focus.autoFocusFirstItem`) and wires focus-to-card behavior after controller `item-selected` events without changing default behavior. | Default ownership behavior is intentionally unchanged pending UX approval. | Keep default host behavior stable; use opt-in policy where needed and validate manually with AT before making default-policy changes. | `packages/section-player/tests/section-player-navigation-contract.spec.ts` | Deferred — design/default decision still pending |
| `a11y-006` | Item-player delivery baseline blocked upstream | [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) | Medium | The delivery-item axe baseline for `pie-item-player` still needs a known blocker for `aria-allowed-attr` on the rendered multiple-choice surface. The underlying issue originates in `pie-elements-ng`, not in `pie-players`. | This round cannot modify `../pie-elements-ng`, and `packages/item-player/src/PieItemPlayer.svelte` must remain a generic host instead of gaining element-specific logic. | Fix the invalid ARIA at the PIE element source, then remove the `aria-allowed-attr` allowlist from the player-scoped baseline. | Keep `packages/item-player/tests/item-player-multiple-choice.spec.ts` scoped to `pie-item-player` and retire the allowlist once the upstream fix lands. | Deferred |
| `a11y-009` | Assessment-player integrated baseline blocked by upstream item markup | [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) | Medium | The `pie-assessment-player-default` critical-flow axe baseline now exposes the same `aria-allowed-attr` issue through nested multiple-choice item markup (`aria-checked` on unsupported element role). | The issue is inherited from upstream item rendering and cannot be resolved in `pie-players` assessment host orchestration. | Keep the assessment-player baseline allowlist scoped to `aria-allowed-attr` and remove it once upstream item markup is corrected. | Maintain `packages/assessment-player/tests/assessment-player-smoke.spec.ts` baseline assertion and retire allowlist after upstream fix verification. | Deferred |
| `a11y-007` | Item/section demos route chrome and debug panels | [1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum), [2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard) | Low | Demo chrome contrast and panel scroll-region focusability were addressed in item/section demo surfaces and debugger/session panels, with route-level axe regression specs added. | N/A | N/A | `packages/item-player/tests/item-demos-chrome-a11y.spec.ts`, `packages/section-player/tests/section-demos-chrome-a11y.spec.ts` | Fixed in-repo |

## Deferred Evidence And Tooling Gaps

| ID | Surface | Type | Current behavior / evidence | Why deferred | Suggested fix direction | Intended automation target | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `a11y-004` | `docs/evals` runner wiring | Supporting evidence gap | `docs/evals/readme.md` now uses current host app naming, but runnable `test:evals*` scripts are still not wired in committed `apps/section-demos/package.json`. | Runner work is broader than the current safe accessibility fix scope. | Either wire a real YAML eval runner into a host app or keep `docs/evals` explicitly positioned as intent/spec documentation. | Add a host-app eval runner only when the repo is ready to maintain it. | Deferred |
| `a11y-005` | Manual assistive technology validation | Supporting evidence gap | Current evidence is strong for code review and Playwright coverage, but VoiceOver/NVDA/JAWS validation is still missing for live announcements, dialog behavior, and reading mode interactions. | Real AT validation cannot be replaced by code changes alone and was outside this implementation pass. | Run a manual AT pass using `docs/wcag/evaluation-method.md` after the next round of UI fixes lands. | Manual pass first; automate only the parts that can be checked reliably in browser tests. | Deferred |

## Notes

- This file is a planning/status artifact, not a claim that the deferred issues are the only remaining accessibility concerns.
- Use [`evaluation-method.md`](./evaluation-method.md) and [`project-surface-map.md`](./project-surface-map.md) when deciding what to tackle next.
- Treat `docs/evals` as supporting evidence and intent capture, not as proof of conformance on its own.
