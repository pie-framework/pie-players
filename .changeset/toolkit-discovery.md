---
"@pie-players/pie-context": patch
---

A subscribing `ContextConsumer` installs one `ContextRoot` per document, on `documentElement` and shared by every copy of the package on the page, so a provider that connects late answers requests made before it. `ensureDocumentContextRoot` is exported. `connectContextWithRetry` relies on that replay and no longer polls. A provider answering a consumer again keeps its subscription, so updates keep reaching it after a re-request.
