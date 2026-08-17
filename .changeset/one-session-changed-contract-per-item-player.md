---
"@pie-players/pie-players-shared": patch
---

Stop a PIE element's own `session-changed` at the item player boundary, so one
name carries one contract.

A PIE element emits `session-changed` on itself with the element contract's
metadata detail — `complete`, `component`, and no `session` — as its signal to the
player. The player listens for it, resolves the session, and re-emits a canonical
`session-changed` from its own host. The element's event kept bubbling, so a host
listening on `<pie-item-player>` received two events per change under one name: the
canonical one carrying `detail.session`, then the element's carrying
`detail.session === undefined`. A host reading the last value it saw got nothing,
and the undefined was indistinguishable from `resolveSessionChangedForwarding`'s
deliberate `session: null` plus `intent: "metadata-only"` signal, which is the
supported way to say "metadata changed, the response did not".

Now every `session-changed` that leaves the player is readable without guessing:
either it carries a session, or it declares `intent: "metadata-only"` with an
explicit null. `event.stopPropagation()` runs before the re-entry guard so the raw
event does not escape on the early-return paths either. The player's own
re-dispatch is a separate event object and is unaffected.

No behavioural risk to the known consumers, all of which were checked. The quiz
engine player's payload handler is fed by section-player's item-event coordinator
(`item-session-data-changed`), not by the DOM event; its DOM handlers are
`@HostListener('document:session-changed')` and `document:item-session-changed`,
which take no argument, read no detail, and only trigger a snapshot and persist —
and the canonical event still reaches `document`, so they still fire.
knowledge-check does not reference `session-changed` at all. Inside this repo,
section-player's `ItemShellElement` carries fingerprint and cross-shell dedupe
specifically to absorb duplicate session events; it now has one fewer to discard.
The players-shared item renderer is never nested inside another instance — a
stimulus layout is one instance rendering both passage and item — so stopping
propagation at its root cannot hide an inner element's change from an outer player.

Covered by `packages/item-player/tests/item-player-session-changed-contract.spec.ts`,
which fails without the change.
