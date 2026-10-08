---
"@pie-players/pie-context": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

A subscribing `ContextConsumer` installs one `ContextRoot` per document, on `documentElement` and shared by every copy of the package on the page, so a provider that connects late answers requests made before it. `ensureDocumentContextRoot` is exported. `connectContextWithRetry` relies on that replay and no longer polls. A provider answering a consumer again keeps its subscription, so updates keep reaching it after a re-request.

The toolkit and the shells no longer attach context roots of their own. A shell's registration carries the `runtimeId` of the toolkit that answered it, a toolkit claims an event carrying a `runtimeId` only when the id is its own, and a shell that a nearer toolkit takes over moves its registration to it. `ShellScope.send` dispatches an event addressed the same way, holding up to 50 until a toolkit answers, and the shells and `<pie-item-scope>` send their internal events through it. A nested toolkit inherits an outer one that is already providing when it connects; one that finds none keeps the coordinator it builds.

`waitForSectionController` resolves on `toolkit-ready` instead of polling, with the same timeout and result.
