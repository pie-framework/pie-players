---
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

The audio transcript is a packaged capability rendering into a new `content-lead` host surface. No element and no host names a transcript.

The shipping implementation had `mc-populated-blank` render `model.audioTranscript` and reveal it from an `.rli-with-audio-transcript` class on an ancestor. A DOM class is invisible to policy — no support id is consulted, so district, test-administration and item-level precedence cannot reach it and the PNP debugger cannot explain it. `pie-elements-ng` now renders no transcript at all, the Learnosity import writes a `transcript` catalog card carrying its own visibility, and this is the half that resolves the card and puts the text on the page.

## Content without a grant

`ToolRegistration.resolvesWithoutGrant` says a content-dependent capability must be consulted even when policy granted none of its support ids, and `ToolContentDependencyContext.granted` is how `resolve` learns which case it is in.

Availability as grant AND content is the right default and stays the default. A transcript is the exception, because the card is authored for one of two different jobs: an item family designed to be delivered with its transcript on screen carries `visibility: "always"` and no student profile grants or revokes it, while a family whose construct a visible transcript would invalidate carries `onGrant` and is the accommodation. Only the content knows which, so the capability has to be able to answer from the content alone — and it still returns null for an `onGrant` card with no grant, which is where fail-closed lives.

Registration rejects `resolvesWithoutGrant` without `requiresAuthoredContent`: there would be no `resolve` to reach, so the flag would claim a behaviour nothing implements.

## The `content-lead` surface

Full-width, in flow, above the content body. `content-media` is a sticky side column sized to its media's aspect ratio — correct for a signed video, wrong for multiple sentences of prose that should be met on the way into the item.

Surface names still belong to the host: core defines none, and `CONTENT_LEAD_SURFACE` is section-player's own geometry rather than anything the capability declares.

## One resolution path for both surfaces

`resolveSurfaceCapabilities` decides eligibility and resolves content for every surface, and `SectionCardMediaSplit` now calls it instead of carrying its own copy — the second surface is what made the duplication a fork rather than a coincidence. It tries each `pnpSupportIds` entry, falls back to `toolId`, skips ungranted tools unless they declare `resolvesWithoutGrant`, and treats a resolver that returns null or throws as nothing to show.

`SectionCardSurfaceStack` mounts what comes back, on both the item and passage cards. It carries over the write-only-when-the-signature-changed guard from the split pane, which is not an optimisation: re-rendering the card re-applies `item`, which re-registers the item's catalogs, which makes the resolver emit again, and one unconditional write per emission is self-sustaining until Svelte aborts at its depth limit with the DOM half-applied.

## Reading order instead of a description

The region is labelled and placed immediately before the element's content. The alternative was preserving the `aria-describedby` from the audio control, which would have required a described-by id channel in the delivery contract so the player could reach a control inside an element it does not own — and a description is announced as a flat string on focus, so pointing one at a multi-sentence transcript is worse to listen to than reading order.

## Scope

The packaged-registration invariant that no default-granted capability declares a content dependency now permits one that declares `resolvesWithoutGrant`, since such a capability reaching a learner is a statement about the item rather than about the grant list.

Print has no toolkit and renders `model.audioTranscript` directly; print resolving catalogs itself is PIE-904.
