---
"@pie-players/pie-assessment-toolkit": patch
---

PIE-512 follow-up: fix persistent-shell cohort handoff in the section runtime
engine.

When a passage shell stays mounted across a cohort flip (same passage element
diffed between sections in the passage-only narrow-viewport split layout), it
does not re-fire `pie-register` / `pie-content-loaded`. The previous fix
restored event delivery for the **freshly-mounted** shell case, but the
engine's `initialize(...)` swap to a new `SectionController` left that
controller's `loadedRenderables` snapshot empty for any persistent shell —
late `content-loaded` subscribers on the new cohort therefore saw nothing.

`SectionRuntimeEngine` now mirrors a "loaded" set alongside the existing
`RuntimeRegistry`. On a controller swap, it replays both the registered shells
and the still-loaded ones into the new controller in document order, so the
new cohort's snapshot is correct without requiring shells to remount.
Same-cohort `updateInput` resolves to the existing controller and short-
circuits the replay (no double-bookkeeping).

Covered by
`packages/assessment-toolkit/tests/pie-512-persistent-shell-cohort-handoff.test.ts`,
which pins the cohort handoff at the engine layer (the previous Playwright
e2e used `{#key}` and force-remounted the CE host, masking this gap).
