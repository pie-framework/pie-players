# Accessibility Coverage Matrix

This matrix captures current accessibility review coverage for the repo's primary UI surfaces.

It is a planning and execution artifact, not a compliance claim.

Last updated: 2026-03-20.

## Status Key

- `Automated`: Playwright + axe and/or focused keyboard/focus assertions.
- `Manual AT`: VoiceOver/NVDA/JAWS spot validation status.
- `Open risks`: Highest-priority known gaps still needing remediation.

## Tier 1 (Critical Surfaces)

| Surface | Automated | Manual AT | Open risks |
| --- | --- | --- | --- |
| `packages/section-player` | Yes (critical route suite + hosted-shell/navigation/reflow contracts + route-level chrome checks) | Pending | Default post-navigation focus ownership remains policy-driven (opt-in implemented). |
| `packages/item-player` | Partial (multiple-choice flow + scoped axe baseline) | Pending | Upstream `aria-allowed-attr` debt on rendered multiple-choice surface. |
| `packages/assessment-player` | Yes (smoke + navigation keyboard assertions + scoped axe baseline) | Pending | Known upstream `aria-allowed-attr` debt appears through nested item content in integrated flow. |
| `packages/assessment-toolkit` | Yes (direct hosted-shell interaction coverage via section-player tests) | Pending | Continue periodic checks for tool-shell control discoverability and target size. |
| `packages/toolbars` | Partial (integrated coverage via player flows) | Pending | Focus order, target size, and naming consistency across compact controls. |
| `packages/tool-*` | Partial (integrated checks in section/player routes plus focused dialog/panel updates) | Pending | Some tool-specific interaction models still need dedicated manual AT passes. |
| `packages/theme` | Partial (theme-related player tests exist) | Pending | Cross-theme focus visibility and non-text contrast regressions need explicit periodic checks. |
| `packages/print-player` | Not started in this pass | Pending | Print/alternate rendering semantics and heading structure still need dedicated review. |

## Tier 2 (Integration Surfaces)

| Surface | Automated | Manual AT | Open risks |
| --- | --- | --- | --- |
| `apps/section-demos` | Yes (route-level demo chrome axe checks plus critical section-player flows) | Pending | Continue to monitor panel/content accessibility as demo controls evolve. |
| `apps/item-demos` | Yes (route-level demo chrome axe checks + item player critical flow) | Pending | Continue to monitor non-delivery tabs and utility controls in future additions. |
| `apps/assessment-demos` | Partial (assessment-player smoke/event path coverage) | Pending | Need explicit a11y baseline in assessment flow and route-level keyboard paths. |
| `apps/docs` | Not started in this pass | Pending | Site-level navigation, headings, and contrast require dedicated docs-site audit pass. |

## Tier 3 (Support Surfaces)

| Surface | Automated | Manual AT | Open risks |
| --- | --- | --- | --- |
| `packages/section-player-tools-*` panels | Yes (panel visibility + scroll-region/keyboard checks in route-level and critical tests) | Pending | Manual screen-reader validation still required for announcement quality. |

## Notes

- Manual assistive-technology validation remains required before making conformance statements.
- Automated checks are supporting evidence only and do not prove WCAG conformance.
- Keep this matrix in sync with `deferred-issues.md` and Playwright/CI coverage changes.
- Current CI/local critical command: `bun run test:e2e:a11y:critical`.
