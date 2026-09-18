---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

Restore two behaviours hosts had from the legacy players, so moving from
`<pie-player>` or the fixed player to `<pie-item-player>` and
`@pie-players/pie-preloaded-player` changes nothing but the server support.

The `session` property is live again. `<pie-player>` pushed an entry per model
into the host's own `session.data` through `findOrAddSession` as the item
rendered, and the element then mutated that entry in place, so a host read the
response off its own object. `ItemController` owns the session here, so the
player projects onto the host's container instead: an entry per model at
`load-complete`, then each change written into that entry before
`session-changed` is dispatched, so a host reading the property inside its own
handler sees the response. The projection runs one way and never reads the
container back after the first load. The array and the entry objects keep their
identity, for a host holding a reference into `data`, and entries the player did
not produce are left alone, so a section-level container spanning several items
stays intact. `detail.session` is unchanged and remains the authoritative
payload. `pie-players-shared` exports `projectSessionIntoHostContainer` and
`ensureHostSessionEntries` for a player that owns its own host contract.

Quiz Engine's PIE item element read `session.data` this way and saw an empty
array after its move to the preloaded player, on plain `multiple-choice`.

The preloaded player announces its load the way
`@pie-framework/pie-fixed-player-static` did: `PiePlayerLoadEvent` on
`document` with detail `PIE-Fixed-Player-Load-Complete`, a matching
`performance.mark`, and `window.pieFixedPlayerLoaded` for a host that
initializes after the player and misses the dispatch. A failed initialization
dispatches `PIE-Fixed-Player-Load-Failed` before the error propagates, as it did
there. Star listens for this signal.

`resolveUrl` in the built-in `pie-api` client now collapses a doubled `/api`.
`<pie-api-player>` carried that segment in its `host` and left it out of its
paths; this client does the reverse, so a host pasting its old `host` into
`baseUrl` requested `/api/api/player/load`. A base ending in `/api` and a path
starting with `/api/` resolve to one. A backend that really serves `/api/api`
leaves `baseUrl` at the origin and puts the whole path in `endpoints`.

The section player hands each embedded item player a copy of the item session
rather than the composition's object, and `EMPTY_ITEM_SESSION` — the one object
that stands in for every item with no session yet — is frozen. Without both, a
live host container would write one item's entries into another item's session
and into what `persist()` saves. `projectSessionIntoHostContainer` and
`ensureHostSessionEntries` refuse a frozen container or a frozen `data` array for
the same reason.

One legacy behaviour is deliberately not restored: `<pie-player>`'s
`responseCompleted` event, which that component declares and never emits.
