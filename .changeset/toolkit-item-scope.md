---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-tool-annotation-toolbar": patch
---

`<pie-item-scope>`, from `@pie-players/pie-assessment-toolkit/components/item-scope-element`, holds a plain item player for the toolkit's tools: the toolbar inside it takes the item from it, read-aloud reads its content region, and the toolkit files the item's accessibility catalogs. It publishes through `createShellScope`, as `<pie-item-shell>` and `<pie-passage-shell>` now do, and registers once it finds its toolkit, so it may mount first. The shells now republish a changed scope to tools already subscribed, which kept the first value before.

A tool whose provider fails to start now reports itself unavailable and leaves the section on screen, unless policy grants it as an accommodation; a server speech provider that browser speech replaces is never fatal. `lazyInit` is honoured: text-to-speech starts at the first speak, or at composition when policy grants it, and `<pie-assessment-toolkit>`'s `lazy-init` now defaults to `false`, which is when every host's speech already started. A speak before speech has started starts it, and the read-aloud tools show the interface catalog's message when it cannot. `<pie-assessment-toolkit>` emits `runtime-ready` once per coordinator, and without a section its stage chain ends at `engine-ready` and it no longer emits a null `composition-changed`. A section completes loading once every registered item has loaded, and holds a load that arrives before its registration. The section player's error state resets on a section or attempt change for section-scoped failures, and the missing-provider check follows coordinator readiness instead of polling. `<pie-item-toolbar>` takes its registry from its toolkit, and the toolkit warns once per page about an unclaimed registration, a toolbar whose registry is empty and a scope no toolkit answers.
