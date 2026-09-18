---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
---

Guarantee that a committed response reaches the host before its element stops
existing (PIE-1058).

A delivery element coalesces its `session-changed` dispatch, so a response the
learner had finished entering could be dropped when the element was discarded
inside that window, with no event at all for a host to detect.

`pie-players-shared` adds `commitPendingSessions(root)`,
`bindPageLifecycleCommit()` and `noteSessionBaseline`/`noteSessionObserved`. The
item player commits on a `config` change, on `visibilitychange` to `hidden`, on
`pagehide` and on destroy; the section player commits on shell teardown and
before navigation, `updateInput()` and `persist()`. Every commit carries
`detail.sessionCommitReason`, and nothing is announced unless it changed since
the host last heard. No element version is required.

Hosts listening on `<pie-item-player>` or `document` need no change, except when
they unmount the player themselves, which calls
`commitPendingElementSessions()` first. A host supplying its own
`backend.delivery` client forwards `requestOptions.keepalive` to `fetch`. Hosts
that added DOM-level dirty-tracking workarounds can remove them.

`docs/prds/session-commit-on-teardown.md` records the contract.
