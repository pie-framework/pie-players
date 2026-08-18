---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-player": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-tool-sign-language": patch
"@pie-players/tts-server-core": patch
"@pie-players/tts-server-polly": patch
"@pie-players/tts-server-google": patch
---

Collapse six implementations that existed twice or more, with no public surface
changes.

**Media fragment enforcement.** `applyMediaFragment` writes a `#t=start,end` URI
that browsers honour at neither bound reliably, so each consumer enforced the
range itself — the signing region and recorded read-aloud audio holding two copies
of the same seek-forward-once and stop-at-end pair, which is how one of them came
to enforce only the end. `enforceMediaFragment` now owns the arithmetic and each
consumer supplies what reaching the end means: the signing region pauses, while
`playRecordedAudio` treats it as the clip finishing so the chunk sequence advances.
The end bound is now watched on `timeupdate` as well as by poll, so it is checked
at least as tightly as before in both consumers.

**Tag-name helpers.** `print-player/src/tag-names.ts` was a copy of
`players-shared/src/pie/tag-names.ts`, itself the exported owner, down to
`toPrintHashedTag` — which exists in the owner *for print* and has no other caller.
Both copies carried their own test file. Print now imports from
`@pie-players/pie-players-shared/pie/tag-names`.

**Backend config cloning.** The assessment player carried an 85-line field-aware
`BackendConfig` cloner duplicating the section player's, for a type the item player
owns; a newly nested field would have been cloned by one copy and shared by
reference in the other. It only ever needed a plain deep clone, and `cloneDeep`
already existed at `@pie-players/pie-players-shared/object`. The section player's
field-aware helpers stay: its merge logic consumes the pieces individually.

**Overwide content wrappers.** The image and table wrappers shared an identical
`isInsidePieCustomElement` and near-identical wrap-and-parse bodies. Both now call
one engine in `security/wrap-overwide.ts`, declaring only what differs — selector,
wrapper tag and class, markup probe, and the accessible name, which is the real
divergence between an `alt` and a `<caption>`.

**Context text extraction.** `extractTextContent` ran three byte-identical
traversals, one per level, each redeclaring `stripHtml`, the models normalization
and the model walk. The traversal is now shared and each level declares only which
fields it reads, so a new place text can hide is added once. Verified
output-identical against the previous implementation across fifteen context shapes,
including record-form `models` and every missing-config path.

**Toolbar rendering.** Seven packaged capabilities inlined the same
`renderToolbar` body, varying only in overlay surface, window geometry and whether
the coordinator is re-handed on sync. That is why one rule — the shell title
tracking the interface locale — landed in three different spellings across three
files. They now call `renderOverlayToolbar`, which derives the catalog keys from
`toolId` as all seven already did.

**Section-player shells.** The three layout shells plus the kernel host shell each
carried the same clamp bounds, `resolveConfiguredPx`, host-element walk,
narrow-breakpoint clamp, content-max-width pair and `matchMedia` watch. All of that
moves to `components/shared/section-player-shell-layout.svelte.ts`. Two things stay
duplicated because the compiler requires it, and the module says so: the `props`
map inside `<svelte:options customElement>` must be a statically analyzable object
literal, and a component's `export function` declarations are what become
custom-element methods.

**SSML detection.** Polly sniffed for SSML twice with the same seven tags inline,
and Google kept a private copy of the standard set. `BaseTTSProvider.detectSSML`
now owns the standard elements and takes a provider's own vocabulary as an
argument, which is the part that legitimately differs: `<amazon:effect>` and
`<aws-*>` mean nothing to Google, and Google's list was missing none of the
standard tags but Polly's was missing `<say-as>` and `<mark>` — so Polly now
recognises two standard elements it previously treated as plain text.

Covered by the existing suites plus the reflow, tabbed-layout and
vertical-passage-layout Playwright specs, which exercise the shared narrow-layout
watch at 320px and across stacked-collapse strategy switches.
