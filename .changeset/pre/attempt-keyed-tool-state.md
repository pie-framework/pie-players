---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-theme": patch
---

Tool state is kept per attempt. `ElementToolStateStore` keys gain an attempt segment, `assessmentId:sectionId:attemptId:itemId:elementId`, and `getGlobalElementId` takes an `ElementIdComponents` object; the toolkit's `attempt-id` reaches tools through the runtime context's new `attemptId`. The annotation toolbar records its annotations in that store under `annotationToolbar` in place of `sessionStorage`, so one attempt's or learner's highlights no longer appear in another. `<pie-tool-theme>` follows the host's `<pie-theme scheme>` and records a learner's pick in the store for the section and attempt; it no longer reads or writes `localStorage['pie-color-scheme']`, so a host that wants the pick to outlast a reload persists the store through `loadToolState`/`saveToolState`.
