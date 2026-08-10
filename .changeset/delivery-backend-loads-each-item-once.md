---
"@pie-players/pie-section-player": patch
---

Enabling a delivery backend at runtime no longer remounts every item.

`resolvePlayerRuntime` sets `hosted: true` when a delivery backend is enabled and the host has not said otherwise, and `hosted` is one of the inputs to the items pane's element-warmup signature — correctly, because it changes how bundles are requested. But the pane rendered its cards only while that warmup was resolved, so re-warming tore every card out of the DOM and built a new one.

Two consequences, both invisible in the DOM after the fact. Every item player was destroyed and recreated, discarding whatever session state the learner had in progress. And each item POSTed its delivery `load` twice — once from the dying instance and once from its replacement — so a host whose load endpoint starts an attempt or stamps a timestamp saw it happen twice per item.

The placeholder now covers a first paint and a genuine content swap. Once a warmup has resolved for an element set, the cards stay mounted through any later invalidation that leaves that set alone; item players re-register their own elements on demand either way.

Also corrects two stale assertions in the preloaded e2e spec, which expected three item shells on a fixture that dropped to two items in PIE-619.
