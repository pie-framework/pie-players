---
"@pie-players/pie-players-shared": patch
---

Scope late-arriving PIE element binding to the player's own container, and
release it when the player unmounts.

Registering a bundle installed a `MutationObserver` on `document.body` at
`window._pieElementObserver` and read its config, session and container from
`window._pieCurrentContext`. Nothing disconnected it, so it outlived every
player and kept running `querySelectorAll("*")` plus a `contains()` check per
descendant for every DOM insertion anywhere on the host page. And the context
was one slot that each registration overwrote, so a late element in any player
but the most recently registered failed the container check and never bound —
including a passage element, which an item player registers immediately after
its item config. The callback also closed over the first registration's
`options`, dropping later players' `eventListeners`.

Both globals are gone. `observePieElements(container, getContext)` observes one
container and returns the release for that registration; a container's observer
serves every registration made against it and disconnects when the last is
released. Scoping to the container is what removes the `contains()` walk: a
mutation elsewhere on the page never reaches the callback. `getContext` is read
when an element arrives rather than captured at registration, because a player
recomputes its session and env on render — a captured value is stale by the time
a late element needs it, and re-registering on every recomputed value would open
a disconnected window on each parent render.

Observation is now the container owner's resource rather than a side effect of
loading a bundle, which is why the loaders no longer install one:
`initializePiesFromLoadedBundle`, `loadPieModule` and `loadPieModuleFromString`
bind what is already in `options.container` and nothing more, with their
signatures unchanged. `PieItemPlayer` observes its own root in an `$effect`,
so a late element binds against the session the player holds now rather than the
empty one the STEP 1 registration passes, and the observer is released with the
component. That also makes the behaviour uniform:
an item player inside a section player takes the update-only registration path,
which never defined a tag from a bundle module and so never got an observer at
all.

`pieElementContextsWithin(root)` resolves the contexts registered for `root` or
a container inside it — a host holds the custom element it mounted while the
player registers its inner root. `apps/backend-demos` used the removed global to
recover the resolved models for its repair pass and now reads through this,
which also fixes it: the single slot held the passage config when there was one,
so the item's own models were unreachable.

Additive to the package's public surface; no existing export changed shape.
