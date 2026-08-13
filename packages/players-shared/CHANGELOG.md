# @pie-players/pie-players-shared

## 0.3.65

### Patch Changes

- c5fbf21: `baseHeadingLevel` and `includeSrHeading` reflect to attributes on `<pie-item-player>`, so a host controls the item's heading outline for the whole session rather than only its first paint.

  A PIE element resolves both itself: it walks up to the nearest `pie-player` / `pie-item-player`, reads the property, falls back to the `base-heading-level` / `include-sr-heading` attribute, and re-renders on a MutationObserver watching those two attributes. The player therefore has to put the value where the element looks. `baseHeadingLevel` was registered without `reflect`, and `includeSrHeading` was not a declared prop at all — it reached the element as an expando. Both were honoured at first paint and inert after it, which made the accommodation unusable anywhere the host adjusts it in response to the learner's profile or a change of surrounding page structure.

  `includeSrHeading` is now declared, typed on `PieItemPlayerElement`, and reflected. Because its default is `true`, hosts turn it off through the property: reflection then clears the attribute, and a present boolean attribute means on whatever its value.

  No host code changes. A host already passing either prop starts getting live updates; one passing neither is unaffected.

  The documented level arithmetic was off by one and is corrected. `baseHeadingLevel` names the level the item's heading occupies, not the level the element emits: the element puts its visually-hidden item heading there when `includeSrHeading` is on, and expects the host's own natural heading there when it is off. Authored `data-heading` content nests one level below either way, so `baseHeadingLevel: 2` yields `h2` for the item heading and `h3`/`h4` for `heading1`/`heading2`. The old text described `@pie-element/*` before it read the host at all, when the rewrite ran off a hardcoded default.

## 0.3.64

### Patch Changes

- 9b2f37d: `CatalogCard.payload` is the only name for a card's structured content; the `signLanguage` alias is removed.

  `pie-elements-ng` (PIE-879) and the `pie-api-aws` Learnosity importer (PIE-881) had both landed with the signing payload under `signLanguage`, so this repo accepted that spelling on input and folded it into `payload` during resolution. That kept imported items rendering, and it introduced a worse failure than the one it prevented: only the resolution path knew about the alias, so an imported card rendered its signing video _and_ reported that the item had no signed alternate to anything that enumerated alternates. One fact under two names means every read path is a place to forget one of them, and the enumeration path forgot.

  Both producers now emit `payload`, on branches that land alongside this one, so the alias has nothing left to accept. It is gone from `CatalogCard`, from `resolveCard`, and from `resolveSignLanguageMedia`.

  `resolveSignLanguageMedia` now warns on _any_ `sign-language` card it cannot resolve, not only one carrying a string in `content`. A card written against the old spelling arrives with no payload at all, and the previous code returned `null` for it in silence — which is the shape of bug that reaches a learner and no one else. The new message names `payload` and says the card needs re-importing.

  Sequencing matters for anyone landing these: a host that ships this player against content built by the older `pie-elements-ng` types or the older importer will see signing cards stop resolving, with that warning as the signal. Re-import, or take all three changes together.

- bb1a90b: `ItemEntity.passage` accepts `null`, which is what importers actually write.

  JSON has no `undefined`, so an item transformed from another format carries an explicit `passage: null` for "no passage" — the Learnosity import in `pie-api-aws` emits exactly that. The type allowed only `string | PassageEntity | undefined`, so real importer output failed to type-check on any typed path, and a host had to cast the null away to use it.

  The runtime was never the problem: `isPassageEntity` has always tested `passage !== null`, a check that was unreachable under the declared type and load-bearing in practice. Widening the field is what makes that check mean something, and it is additive — every value that type-checked before still does.

  Found by committing verbatim transform output as a fixture rather than hand-writing the shape the importer was assumed to produce.

- a5241b9: Render `sign-language` accessibility catalog cards. `sign-language` has been a declared `CatalogType` with no consumer since catalogs landed — only `spoken` was wired, through `TTSService` — so an item carrying an ASL video showed the question and no video. This adds the four pieces that make signed alternates appear, deliberately shaped as a second instance of the spoken/TTS path rather than as new machinery.

  ## Card payload

  `CatalogCard.content` is a flat string, so a signing card could only hold a bare URL — no second source, no MIME type, no poster, no time range, all of which QTI 3 expresses inside `qti-card-entry`. `CatalogCard` gains an optional structured `payload`, and `players-shared` gains the media vocabulary it uses (`MediaAssetRef`, `MediaSource`, `TextTrackRef`, `TranscriptRef`, `MediaFragmentRange`, `SignLanguageCardPayload`).

  A card carries **either** `content` **or** `payload`, never both. QTI gives `qti-card` one content slot and names the type in `@support`, which PIE already models as `CatalogCard.catalog`; so `content` is the string form for types a string can express (SSML for `spoken`), `payload` is the structured form for types it cannot, and `catalog` is the only discriminator. Two consequences, both deliberate:

  - **`content` becomes optional.** A signing card has no string form at all. Nothing is projected or mirrored into `content`, so there is never a second copy of the payload's primary URL to fall out of sync with it — and no precedence rule silently deciding which copy wins. `ResolvedCatalog.content` is optional for the same reason; `TTSService` treats a card with no string form as "no catalog", falling through to generated speech.
  - **The payload carries no `kind` tag.** Restating `catalog` inside the payload would be a second source of truth for the type that can disagree with the first. Consumers select a card by catalog type and then validate the payload structurally, which they must do anyway for authored wire data.

  One media vocabulary rather than two: `MediaAssetRef` is defined against both this consumer and prospective stimulus media, with the required subset resolved per consumer instead of by making every field optional at the type level — a type where nothing is required stops catching anything. For signing, sources and language are required, poster and duration do not apply, and `tracks`/`transcript` are actively meaningless, since captions on a signing video would be the English text already on screen. Stated explicitly so no future policy adds a caption requirement to signed content.

  Validation is "treat as absent, never as text": a payload with no usable source resolves to `null` instead of rendering an empty player or a URL as visible content, and a `sign-language` card carrying a bare URL in `content` is reported and ignored rather than half-rendered. Source URLs are restricted to schemes a media element can actually fetch, so an authored `javascript:` or `file:` URL cannot ride into the DOM.

  ## Extraction

  `SignLanguageExtractor` is the signing counterpart of `SSMLExtractor` and exists for the same reason: authors carry the accessibility material inline, and the runtime needs catalog cards. It probes content for `data-sign-language` regions, lifts the video into a card with sources, poster and an optional `data-sign-language-start` / `-end` range, removes it from the visible markup, and docks the catalog on the content it translates via `data-catalog-idref`.

  Removing the video from visible content is the substantive divergence from Learnosity, where a signing video is ordinary item content that renders unconditionally with nothing to gate. In PIE it becomes catalog data that policy decides on.

  An existing `data-catalog-idref` is never overwritten. The attribute is one canonical name with two readers, and clobbering it would break TTS resolution for that node; the synthesized catalog is still emitted and still resolves, because the region finds cards through the item's catalog set rather than by walking the DOM.

  ## Resolution

  Lookup goes through `AccessibilityCatalogResolver.getAlternative(catalogId, { type: "sign-language", language })`, so assessment/item/scoped priority and owner scoping are not re-implemented. `ResolvedCatalog` now carries the card's `payload`.

  Owner scoping needed one consolidation to make that true. Catalogs are placed dynamically — a shell registers what its entity carries on mount, and readers resolve by identifier within an owner scope — so registration and lookup have to agree on where a catalog is filed, and the resolver matches contexts field by field, meaning a disagreement resolves nothing rather than failing loudly. The walk over the three places catalogs hang off an entity, and the construction of the context each is filed under, now live in one place: `collectEntityCatalogRegistrations` and `catalogOwnerContextFor`, both exported from `pie-assessment-toolkit`, with the runtime registration event handler reduced to an adapter over the first. The media region borrows the walk rather than repeating it, so a lookup cannot name a scope registration never wrote.

  One behaviour is deliberately stricter than the resolver's default. Its last fallback rung matches any card of the requested type regardless of language, which is helpful for spoken content and wrong for signing: ASL, BSL and LSF are not interchangeable, so handing an ASL learner a BSL recording is worse than handing them nothing. A card reached by that rung is accepted only if its language matches, or if it asserts no language at all — a card that names no language cannot be shown to be a mismatch, while one that positively claims another language can.

  ## Policy

  Signing is gated on the `signLanguage` PNP support id through the existing six-level `PnpPolicySource` precedence. Because the region is not a toolbar surface, a placement-scoped `decide(...)` would answer the wrong question — absent because it was never placed, not because policy said no — so `ToolPolicyEngine.decideFeature(featureId)` and `ToolkitCoordinator.decideFeaturePolicy(featureId)` resolve one feature id independent of placement. `PnpPolicySource.resolveFeature(...)` reuses the existing rule evaluation rather than copying the six levels, so the two cannot drift.

  `pnpEnforcement` is not consulted for a feature decision: that flag governs whether profile policy _refines_ an otherwise-visible tool set, and a feature with no placement has no unrefined baseline to fall back to, so skipping the profile read would make the accommodation permanently unavailable rather than merely unrefined.

  `computeDefaultSupports()` now excludes `ACCOMMODATION_ONLY_SUPPORT_IDS`, which lists `signLanguage`. That function derives the fallback profile from every registered tool's `pnpSupportIds`, which is right for universal features and wrong for an accommodation: signing requires a documented need, so inheriting it by default would invert the eligibility tier. Excluded by id rather than by declining to register, so the guarantee holds however a signing tool later reaches the registry. Hosts that supply their own profile are unaffected.

  ## Region

  `SectionItemCard.svelte` gains a `data-region="media"` region beside its existing `header` and `content` regions, holding a resolved catalog card. Named for the slot rather than its first tenant — audio description is the same "docked alternate media, gated by PNP" shape.

  `item-player` needs no changes and learns nothing about signing.

  - **Fixed to the right of the content.** Not below: signing is re-checked _while_ an answer is being formed, so a bottom placement means scrolling between video and choices repeatedly. Side by side keeps both visible however long the item is, and the region is sticky within the card so it follows a long question down. Being parallel rather than sequential also sidesteps a problem an above/below split cannot solve, since `item-player` renders prompt and choices as one opaque block.
  - **Resizable** via a keyboard-accessible `role="separator"` divider following `SectionSplitDivider.svelte`'s shape rather than reusing it — that component is wired to the passage/items grid and converts a drag with a fixed 0.1%-per-pixel factor. Inside a card the same drag has to mean the same thing whether the card is wide or narrow, so the math here is container-relative.
  - **Sized for legibility** by an aspect-ratio target with a height floor, not a flat width percentage, which either wastes space on a short clip or crushes signing on a narrow device. Retunable via `--pie-section-player-item-media-aspect-ratio`, `--pie-section-player-item-media-min-height` and `--pie-section-player-item-media-max-height`. Below a 560px card width the region stacks and the divider withdraws.
  - No orientation toggle and no free repositioning. Free 2D positioning is the floating-tool pattern, built for movable utility windows; the `toolParameters` seam is the right place for a policy-driven generalization, and nothing hangs there yet.

  The split wrapper is always present and the content region always occupies the same slot within it, so a card resolving after mount adds siblings rather than re-creating the item player. An item with no signing markup comes back from extraction by reference, so nothing downstream sees config churn.

  Playback is a minimal `<video>` wrapper: the clips are seconds long, so sharing a player with a section-scale stimulus element buys nothing. Its own audio is muted by default, its accessible name states the language ("American Sign Language") rather than saying "video", and starting it pauses TTS — the action the learner just took wins.

  ## Availability

  Signing appears when **both** conditions hold: the item carries a matching card, and policy grants eligibility. Both are checked independently and neither is a default. The content half is AfA's resource-side declaration (QTI approximates DRD in-band — the presence of a card _is_ the declaration) and is what keeps the region off the overwhelming majority of items, so a learner with the accommodation still sees no dead affordance where no signing was authored.

  ## Also

  `AssessmentSection` gains an optional `personalNeedsProfile`. Section players already read it (falling back to `settings.personalNeedsProfile`, then to the computed default) through an `any` cast; this types an existing runtime contract.

- acee584: Accept `signLanguage` as an input alias for a sign-language card's `payload`, so cards from the two producers that already shipped resolve.

  `CatalogCard.payload` was the only accepted name for a signing card's structured media. Two landed implementations disagree with that: `pie-elements-ng` declares the payload as `signLanguage` (PIE-879), and the `pie-api-aws` Learnosity importer emits `signLanguage` (PIE-881). A card from either validated, imported, stored and then resolved to `null` — no signing video, no error a learner or proctor would ever see. That is the exact failure mode the accommodation model exists to prevent, and it is invisible precisely to the people who depend on it.

  `CatalogCard.signLanguage` is now accepted and folded into `payload` at the one point where `AccessibilityCatalogResolver` projects a card, so a single field still reaches every consumer and nothing downstream learns two names. `resolveSignLanguageMedia` reads the alias too, for callers that hand it a raw card. `payload` wins when a card somehow carries both.

  Tolerated on input, never canonical. Which name the three repos settle on is a separate decision; this stops content from silently losing its accommodation while that decision is made.

- b3acac4: `SignLanguageCardPayload.signLang` is optional, matching how it has always been read.

  The card's `language` is QTI's `xml:lang` on the card entry and the only field catalog resolution selects on — resolution runs before anything knows the card is a signing card, so it can only key on the generic field. `signLang` is read afterwards, to name the language in the media region's accessible label and to refuse a card in a sign language the learner did not ask for, and it has always fallen back to the card's `language` when absent. Typing it required made the redundant case look mandatory: nearly every card carries the same code twice, and authors had no way to tell which copy mattered.

  It earns its place only where the two differ — a card tagged with the item's content language (`language: "en-US"`, `signLang: "ase"`) so resolution reaches it by the default-language rung. The sign-language demo drops it accordingly.

- 25511d7: Play recorded audio as a `spoken` alternate.

  PIE's `spoken` card was a string, so it could carry a reading script but never
  "play this file for this node" — and some programs prefer a human voice to
  synthesis. QTI 3 treats the two as the _same_ support, with recorded audio
  referenced by file and MIME type on a `spoken` card, so this adds a form of an
  existing accommodation rather than a new one. No new PNP entitlement: a recording
  played by the player is still computer-delivered speech.

  `SpokenAudioCardPayload` carries a `MediaAssetRef` of `kind: "audio"` plus an
  optional time range. `resolveSpokenAudioMedia` validates it with the same
  "absent, never partially valid" posture as sign-language cards, refusing
  non-audio media so signing and speech cards cannot quietly swap roles, and
  staying silent for a plain script card — which arrives on that path routinely,
  since form resolution is a preference.

  Highlighting is the docked node as a block for the clip's duration. A recording
  emits no word-boundary events, and deriving them from its duration would
  highlight the wrong words confidently rather than the right region vaguely; word
  -level highlighting stays available on the synthesized path. The rate setting
  applies through `playbackRate`, a time range becomes a Media Fragments URI with
  the end bound enforced by the player, and the first source is used because an
  `<audio>` element with alternative `<source>` children reports failure through a
  path that is awkward to observe reliably.

  A clip that will not play degrades to the node's `content` card through the
  existing speak-time fallback — which is the concrete reason QTI's guidance keeps
  the script alongside the audio. With no script, the failure is reported rather
  than silently skipped. `stop()` and seeking cancel a playing clip and settle its
  pending playback, so a superseded run cannot wedge the chunk loop, and
  `data-tts-suppress` withholds a recording exactly as it withholds a script.

  Also extracts the media-URL allow-list, source and fragment normalization shared
  by signing and spoken-audio cards into one module, rather than keeping two copies
  of a security-relevant allow-list.

## 0.3.63

## 0.3.62

### Patch Changes

- 14666b3: Install the shared PIE content stylesheet from the player instead of requiring hosts to import it.

  `@pie-players/pie-theme/components.css` holds classes that authored content depends on but no component owns: passage markup (`.numbered-paragraph`, `.p-number`, `div.passage-title`), the legacy `kds-*` families, and the `pie-answer-eliminator-*` styles. `PieItemPlayer.svelte` already imported that stylesheet, but in this package's Vite library build a plain CSS import is extracted to `dist/assets/pie-item-player.css` — a file nothing loads at runtime and no `exports` entry exposes. The import was a silent no-op, so hosts rendered authored passages unstyled unless they happened to import the stylesheet themselves, which was documented nowhere.

  `@pie-players/pie-item-player` now inlines the stylesheet as text (`?raw`) and installs it once per document at import time, alongside custom-element registration, so it is in place before any instance renders. The separately importable session-debugger entry installs it too. The orphaned `dist/assets/pie-item-player.css` is no longer emitted. `@pie-players/pie-section-player` and `@pie-players/pie-assessment-player` are covered transitively, since they render items through the item player.

  The stylesheet is prepended to `<head>` and deliberately left unlayered, so host CSS that loads later still wins at equal specificity — the placement hosts were previously told to arrange by hand. A cascade layer would have been wrong here: unlayered author declarations beat all layered ones regardless of specificity, so a host reset as broad as `p { margin: 0 }` would have silently outranked `.numbered-paragraph { margin-left: 36px }`.

  Hosts that want to own the stylesheet can set `<html data-pie-content-styles="host">` before the player script runs; the player then installs nothing and warns once if no content stylesheet turns out to be present. `components.css` declares `--pie-content-styles` on `:root` as the presence sentinel behind that check.

  Upgrading hosts do not have to remove an existing `import "@pie-players/pie-theme/components.css"` for this release to be correct: installation is idempotent, and two matching copies render identically. But a host copy loads later than the installed one and therefore wins ties at equal specificity, so a host copy pinned to an older `@pie-players/pie-theme` would silently override newer player rules. Rather than leave that to be discovered, the players now log a one-time warning naming the redundant import when they detect a second copy in the document.

  `@pie-players/pie-print-player` installs it the same way, from its `src/index.ts` entry. This player never told hosts to import the stylesheet at all, so it had no working route to these styles. The gap is worse than a cosmetic one here: `components.css` owns `@media print { .noprint, .kds-noprint { display: none } }`, so a missing copy did not just render authored passage markup unstyled — it printed content the author had marked as non-printing. Nothing in the package strips authored classes on the way through; `processMarkup` swaps only the interactive element tags and returns the surrounding markup verbatim, and `pie-print` renders into light DOM (`createRenderRoot()` returns `this`), so a document-level stylesheet is the only thing that can reach that content.

  New in `@pie-players/pie-players-shared`: `installContentStyles`, `contentStylesPresent`, `contentStylesOptedOut`, `auditContentStyles`, plus a narrow `@pie-players/pie-players-shared/ui/content-styles` export. Print player imports through that subpath rather than the package root, because players-shared declares `sideEffects: true` and print player externalizes nothing — the root barrel would have bundled all of players-shared into `print-player.js`.

  Hosts that already import `@pie-players/pie-theme/components.css` need no change — installation is idempotent and a duplicate host copy simply wins on document order.

- 001486e: Preserve authored attributes and children through the print tag swap, and sanitize print markup by default.

  `processMarkup` previously carried only `id`, `pie-id`, and `data-original-tag` onto the freshly built print element, so everything else authored on that element was silently dropped:

  - `class`, `style`, `lang`, `dir`, `aria-*`, and `data-*` were lost. An item authored as `<multiple-choice id="1" class="noprint">` lost its print-suppression hook and printed anyway on hosts that load `@pie-players/pie-theme/components.css`.
  - Child nodes were lost, discarding authored fallback content and destroying nested interactive elements — a nested element could even be reported in the returned node list while being absent from the returned markup.

  All attributes are now copied and children are moved across. `id`, `pie-id`, and `data-original-tag` are still set by the processor so they win over any authored value of the same name.

  `<pie-print>` now also sanitizes authored `item.markup` through `@pie-players/pie-players-shared/security` by default, matching `<pie-item-player>`. Hosts can opt out with the `trust-markup` attribute or supply their own sanitizer via the `sanitizeMarkup` property. The interactive element tags from `item.elements` and their hashed print variants are allow-listed so sanitizing does not strip them.

  `sanitizeItemMarkup` gains a `wrapOverwideContent` option (default `true`, unchanged for the screen players). The print player passes `false`: the overwide image/table wrappers are `overflow-x: auto` reflow affordances with no `@media print` override, and `overflow` clips rather than scrolls in print media, so wide images and tables would be cut off.

  Also drops the `static styles` block from `PiePrint`. It declared a `:host` border, padding and `max-width`, none of which ever applied: `createRenderRoot()` returns `this` for light-DOM rendering, so Lit never calls `adoptStyles`. Removing dead declarations, no rendered change.

- 6a18f3c: Scope external stylesheets with an at-rule-aware walker, so `@media`, `@supports` and `:root` survive.

  `pie-item-player` scoped external stylesheets by prefixing every selector-like fragment with
  one regex. That is correct for flat selector rules and wrong for everything else:
  `@media screen { ... }` became `.pie-item-player.x @media screen { ... }`, an invalid
  selector, so the browser dropped the whole block and every rule inside it. `@font-face` and
  `@keyframes` were corrupted the same way — the font never loaded, the animation name was
  gone. And `:root { --var: ... }` became `.pie-item-player.x :root`, which can never match,
  because `:root` is `<html>` and is not a descendant of the player.

  At-rules and `:root` custom properties therefore never applied at all. Both entry paths were
  affected: the `external-style-urls` attribute and `itemConfig.resources.stylesheets[*].url`.

  Scoping now walks the stylesheet brace-by-brace, in a new `scopeStylesheetCss` export from
  `@pie-players/pie-players-shared`:

  - `@media`, `@supports`, `@container`, `@layer` and `@scope` keep their prelude and have
    their inner rules scoped, recursively.
  - `@font-face`, `@keyframes` (including vendor-prefixed), `@page`, `@property` and
    `@counter-style` pass through untouched, as do at-rules the walker does not recognise —
    their blocks hold declarations or keyframe selectors, not selectors to scope.
  - `:root`, `html` and `body` are replaced by the scope selector instead of being prefixed by
    it, so external custom properties apply. Anything that followed is preserved:
    `html.dark .a` becomes `.pie-item-player.x.dark .a`.
  - A leading pseudo becomes a descendant: `:is(.a, .b) .c` scopes to
    `.pie-item-player.x :is(.a, .b) .c`, not `.pie-item-player.x:is(.a, .b) .c`, which would
    demand that the player root carry the partner's class.
  - Parsing is string- and paren-aware, so a `{` inside `content: "{"` does not end a block and
    a `,` inside `:is(a, b)` does not split a selector list. Comments are stripped before the
    walk so one sitting between two rules is not absorbed into the next selector.
  - Style-rule blocks are emitted verbatim, which is also what native CSS nesting needs:
    nested selectors are relative to a parent that has already been scoped.

  Flat selector rules scope exactly as before. No new dependency, and no public API change —
  no new attribute, prop or event.

  **Where stylesheets are passed, expect visible changes.** At-rules and `:root` variables have
  never applied in this player, so fixing the scoper turns currently-dead CSS live. That is the
  point of the fix, but it is a real rendering difference for any host that was passing a
  stylesheet with media queries or custom properties in it.

  `@import` still passes through untouched, exactly as the regex left it. It pulls in an
  unscoped stylesheet and so defeats scoping; blocking it is a policy decision, not a scoping
  one. Cross-origin stylesheets are also still unscoped — they take the `<link>` branch because
  `fetch()` cannot read the text to rewrite. Both are pre-existing and tracked separately.

## 0.3.61

## 0.3.60

## 0.3.59

## 0.3.58

### Patch Changes

- 8df52bf: Add an opt-in allow-list for executable element packages. The default policy mode requires exact versions without build metadata so legacy IIFE bundle separators cannot be injected. Existing hosts that omit the policy retain their current loading behavior.
- d5cc905: Preserve distinct full custom-element tags when multiple PIE element versions coexist, while keeping the established tag encoder and existing single-version behavior unchanged. Legacy IIFE bundles now reject unrepresentable maps containing multiple specs for one package instead of aliasing distinct tags to one constructor.

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.55

### Patch Changes

- 7f45877: Forward metadata-only item session changes when renderer snapshots leave response data unchanged, without reclassifying those echoes as response data.

## 0.3.54

## 0.3.53

## 0.3.52

### Patch Changes

- 017f5a9: Treat identity-only PIE element session echoes as metadata-only updates so restored sessions do not emit learner response data changes, while preserving explicit response clears and derived session state updates.

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.48

### Patch Changes

- 0c20d0f: Fix PIE-631: EBSR (and any element with `lockChoiceOrder: false`) no longer triggers an infinite render loop. A controller's persisted derived state (e.g. shuffled choice order) now round-trips back into the authoritative item session via a new `ItemController.mergeElementSession` and an `onElementSessionUpdate` callback on `updatePieElements`, so the order is reused across renders instead of being regenerated non-deterministically each cycle.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.44

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.42

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.40

### Patch Changes

- 3a167a8: Declare Svelte as an optional peer for `pie-players-shared` raw Svelte source exports so pnpm consumers resolve the app's Svelte runtime without installing a nested copy.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.39

### Patch Changes

- 0072fad: Move Svelte out of published runtime dependencies and add a release check that rejects future accidental `svelte` runtime dependency declarations. Assessment toolkit custom-element outputs now bundle their Svelte runtime helpers so consumers do not install a second Svelte runtime through player packages.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.38

### Patch Changes

- f856362: Bump `@pie-lib/math-rendering-module` to `5.0.0` for the PIE-423 math accessibility rendering update.
- c8d46d7: Remove PIE-owned focus-placement APIs and automatic section navigation focus movement.

  This is a breaking cleanup for pre-1.0 hosts: `pie-item-player.focusFirst()`, section-player layout `focusStart()`, `SectionPlayerFocusPolicy.autoFocus`, `DEFAULT_FOCUS_POLICY`, and `resolveAutoFocusStrategy` are no longer exported. The shared `queryFirstFocusableDeep()` and `focusFirstFocusableInElement()` helpers were also removed; `FOCUSABLE_SELECTOR` and `isProgrammaticFocusTarget()` remain for focus-trap internals.

  Hosts should own skip links, landmarks, and page-level focus placement while section player preserves natural tab order into actionable controls.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.37

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.36

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.35

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.34

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.33

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.32

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.31

### Patch Changes

- 26dbea3: PIE-501: harden element loading during section-player section swaps.

  Pre-1.0 lockstep release: every package in the `fixed` block bumps
  together at release time per the project versioning policy. Per pre-1.0
  semver convention every release is a patch bump, even when behavior
  changes are breaking — the breaking changes inventory below is for
  host migration, not for the version bump level. PIE-501
  investigation traced sporadic post-section-swap render failures
  (`Preloaded strategy requires pre-registered elements; missing tags:
…`) to two coupled root causes — a non-truthful element-load promise
  contract, and the section-player rewriting embedded items' loading
  strategy and tracking readiness through cached state. Fixing those
  unblocked a broader architecture-review compat-removal sweep that had
  been gated on the same surfaces.

  This release ships both phases of the PIE-501 plan plus the
  compat-removal work that fell out of the same review. None of the
  removed surfaces are part of the `pie-item` client contract (the only
  allowed compatibility surface per
  `.cursor/rules/legacy-compatibility-boundaries.mdc`).

  ## What's new

  - **Deep `ElementLoader` primitive** (PIE-501 Phase A). A single loader
    primitive whose promise resolves only when every requested custom-
    element tag is actually registered, and rejects with a per-tag
    reason otherwise. Both IIFE and ESM are now adapters over this
    primitive. Replaces the previous parallel `IifeLoader` / `EsmLoader`
    classes in `@pie-players/pie-players-shared`. The deep primitive is
    the shipped contract; the strategy name (`iife` / `esm` / `preloaded`)
    selects an adapter rather than a parallel implementation.

  - **Strategy substitution removed** (PIE-501 Phase B). Embedded
    item-players inherit the host's chosen strategy verbatim. The
    section-player still pre-warms the aggregate element set for
    performance but no longer owns correctness through cached state;
    widget readiness is now a function of inputs. The
    `allowPreloadedFallbackLoad` escape hatch is gone.

  - **M5 — strict two-tier mirror rule.** Tier-1 layout-CE props mirror
    to `runtime.*` keys with documented precedence; the resolver enforces
    the mirror per-key.

  - **M6 — canonical stage vocabulary.** `pie-stage-change` (`composed`,
    `engine-ready`, `interactive`, `disposed`) and `pie-loading-complete`
    are the canonical readiness surface, with a toolkit-side stage
    tracker and `onStageChange` / `onLoadingComplete` props on the layout
    CEs.

  - **M7 — `SectionRuntimeEngine`.** A single FSM-driven runtime engine
    consolidates section-controller lifecycle, readiness derivation, and
    stage emissions previously scattered across multiple coordinators.

  - **M8 — tool policy engine.** Allow/block + PNP/profile enforcement become a
    first-class policy surface on `ToolkitCoordinator`
    (`onPolicyChange`, `decideToolPolicy`, `updateToolPlacement`,
    `setPnpEnforcement`, `registerPolicySource`), with narrow profile
    auto-detection mirrored through `runtime.tools.pnpEnforcement`.

  - **`FrameworkErrorBus` contract.** A single canonical
    `framework-error` source, single subscription via
    `onFrameworkError(model: FrameworkErrorModel)`, and the layout-CE
    host emits exactly one `framework-error` per error (the previous
    toolkit-bubble + engine-bridge dual-emit is collapsed — see Removed).

  - **Tabbed section-player layout.** New `<pie-section-player-tabbed>`
    CE alongside the existing splitpane and vertical layouts.

  ## Removed (breaking)

  - **Deprecated `AssessmentToolkitEvents` event-map and member event
    interfaces** (`AssessmentStartedEvent`, `AssessmentCompletedEvent`,
    `AssessmentPausedEvent`, `AssessmentResumedEvent`,
    `CanNavigateChangedEvent`, `InteractionEvent`, `InteractionType`,
    `ItemChangedEvent`, `ItemMetadata`, `LoadCompleteEvent`,
    `LocaleChangedEvent`, `LocaleLoadingCompleteEvent`,
    `LocaleLoadingErrorEvent`, `LocaleLoadingStartEvent`,
    `NavigationRequestEvent`, `PlayerErrorEvent`, `SessionChangedEvent`,
    `StateRestoredEvent`, `StateSavedEvent`, `SyncFailedEvent`,
    `ToolActivatedEvent`, `ToolDeactivatedEvent`,
    `ToolStateChangedEvent`). They were aspirational and never emitted
    from any production path. The canonical replacement surfaces
    (DOM `CustomEvent`s on `<pie-assessment-toolkit>`,
    `ToolkitCoordinator.subscribe*` helpers, and the M3
    framework-error contract) are unchanged.

  - **Deprecated Svelte-store-shaped `toolCoordinatorStore`** and the
    prior `ToolCoordinator` _interface_ (the z-index / visibility shape
    in `packages/assessment-toolkit/src/tools/types.ts`, with
    `registerTool` / `showTool` / `hideTool` / `toggleTool` /
    `bringToFront` / `updateToolElement` / `hideAllTools` /
    `getToolState` / `isToolVisible`). The canonical replacement is the
    class-based `ToolCoordinator` (typed by `ToolCoordinatorApi` in
    `packages/assessment-toolkit/src/services/interfaces.ts`)
    re-exported from `@pie-players/pie-assessment-toolkit` and
    instantiated by `ToolkitCoordinator` as `coordinator.toolCoordinator`.
    All instance methods carry over verbatim, plus a `subscribe()` for
    reactive consumption that replaces the deleted Svelte-store derived
    views. Independently, `ToolkitCoordinator`'s tool-policy surface
    (`onPolicyChange`, `decideToolPolicy`, `updateToolPlacement`,
    `setPnpEnforcement`, `registerPolicySource`) is the canonical entry
    point for the _tool policy_ concern (allow/block + PNP/profile enforcement)
    — that is a different concern than the floating-tool z-index API
    the deleted interface served.

  - **Top-level `createSectionController` prop on every section-player
    layout custom element** (`<pie-section-player-splitpane>`,
    `<pie-section-player-vertical>`, `<pie-section-player-tabbed>`,
    `<pie-section-player-kernel-host>`, `<pie-section-player-base>`)
    and the corresponding kernel pass-through. The factory is now
    exposed only via `runtime.createSectionController`, the canonical
    M5 entry point.

    Note: `<pie-assessment-toolkit>`'s `createSectionController` prop
    is **unchanged** — the toolkit accepts it directly as part of its
    composition surface.

  - **Top-level `isolation` prop on every section-player layout custom
    element** (`<pie-section-player-splitpane>`,
    `<pie-section-player-vertical>`, `<pie-section-player-tabbed>`,
    `<pie-section-player-kernel-host>`, `<pie-section-player-base>`)
    and the corresponding kernel pass-through. The isolation strategy
    is now read only from `runtime.isolation`; when omitted, the
    resolver falls back to the package default (`DEFAULT_ISOLATION`).

    Note: the toolkit's `<pie-assessment-toolkit>` keeps `isolation` as a
    JS-only object property (see the toolkit-side carve-out below), but
    the kebab-attribute (`isolation="…"` HTML form) was also removed in
    this sweep. Layout-CE hosts must use `runtime.isolation`; standalone
    toolkit hosts must assign `el.isolation = …` programmatically.

  - **Top-level `item-toolbar-tools` / `passage-toolbar-tools`
    attribute aliases (and their `itemToolbarTools` / `passageToolbarTools`
    prop forms) on every section-player layout custom element**
    (`<pie-section-player-splitpane>`, `<pie-section-player-vertical>`,
    `<pie-section-player-tabbed>`, `<pie-section-player-kernel-host>`),
    along with the matching one-time deprecation warnings and the
    `parseToolList(itemToolbarTools)` / `parseToolList(passageToolbarTools)`
    absorption inside `resolveToolsConfig`. Per-region tool placement is
    now configured directly on the canonical `tools` object as
    `tools.placement.item` / `tools.placement.passage` (or via
    `runtime.tools.placement.{item,passage}`).

    The kernel re-exposes the canonical placement arrays as
    comma-separated strings via slot props (`itemToolbarTools`,
    `passageToolbarTools`) so internal card / pane custom elements
    (`<pie-section-player-item-card>`, `<pie-section-player-passage-card>`,
    `<pie-section-player-items-pane>`,
    `<pie-section-player-passages-pane>`) keep their existing
    string-attribute contract unchanged.

  - **Deprecated readiness DOM-event aliases on every section-player
    layout custom element** — `readiness-change`, `interaction-ready`,
    and `ready` — along with the engine's `legacy-event-bridge` that
    emitted them, the corresponding `SectionEngineOutput` kinds
    (`readiness-change`, `interaction-ready`, `ready`), the engine
    state fields that gated them (`interactionReadyEmitted`,
    `readyEmitted`, `lastReadinessDetail`), the
    `pie-section-readiness-change` / `pie-section-interaction-ready` /
    `pie-section-ready` instrumentation mappings, and the
    `readinessChange` / `interactionReady` / `ready` entries on
    `SECTION_PLAYER_PUBLIC_EVENTS`. Hosts now consume the canonical
    M6 vocabulary directly:

    - `readiness-change` → `pie-stage-change` (the readiness payload
      is also reachable via the layout CE's `selectReadiness()` /
      `getSnapshot().readiness`).
    - `interaction-ready` → `pie-stage-change` filtered on
      `detail.stage === "interactive"`.
    - `ready` → `pie-loading-complete`.

  - **Deprecated `section-controller-ready` Svelte/DOM event** — the
    kernel-side `dispatch("section-controller-ready", ...)` call,
    the matching `on:section-controller-ready={…}` forwarders on every
    layout CE wrapper (`<pie-section-player-splitpane>`,
    `<pie-section-player-vertical>`, `<pie-section-player-tabbed>`,
    `<pie-section-player-kernel-host>`), the
    `sectionControllerReady` entry on `SECTION_PLAYER_PUBLIC_EVENTS`,
    the `SectionPlayerControllerReadyDetail` type export, and the
    `pie-section-controller-ready` instrumentation mapping in
    `SECTION_INSTRUMENTATION_EVENT_MAP`. The kernel still feeds the
    engine FSM's `section-controller-resolved` input on first
    resolution per cohort (canonical stage progression
    `booting-section → engine-ready`); only the kernel-level Svelte
    event and its DOM-forwarded layout-host emit are gone. The
    toolkit-internal `pie-toolkit-section-controller-ready`
    telemetry name is unchanged. Migration:

    - Pull a controller handle directly:
      `await el.waitForSectionController(timeoutMs)` or
      `el.getSectionController()` on the layout CE.
    - Or filter `pie-stage-change` for
      `detail.stage === "engine-ready"` and then call
      `el.getSectionController()`.

  - **`autoFocusFirstItem` boolean alias on
    `SectionPlayerFocusPolicy`** and the runtime translation logic that
    mapped it onto the canonical `autoFocus` enum (along with its
    one-time deprecation warning). Hosts now set `autoFocus` directly:

    ```ts
    // before
    el.policies = { focus: { autoFocusFirstItem: true } };
    // after
    el.policies = { focus: { autoFocus: "start-of-content" } };
    // (or `"none"` to disable)
    ```

    The two Playwright tests that pinned the deprecated alias contract
    (`section-player-navigation-contract.spec.ts`) are removed.

  - **Orphaned `runtime-event-guards.ts` re-export shim** in
    `@pie-players/pie-assessment-toolkit` (`@deprecated since M7`,
    `createRuntimeId` is the only re-export). Import from
    `@pie-players/pie-assessment-toolkit/runtime/internal` instead.

  - **`one-time warning utility` deprecation-warning utility** and its
    public re-export from `@pie-players/pie-assessment-toolkit`
    (`packages/assessment-toolkit/src/services/deprecation-warnings.ts`,
    along with the test-only `test reset helper` and the
    `one-time warning utility` test block in
    `tests/framework-error-bus.test.ts`). Every internal callsite
    was removed earlier in this sweep; no in-tree code depends on the
    utility. External consumers that imported it from the package
    root should inline a per-callsite `console.warn` (the utility
    was a thin once-per-label, dev-only `console.warn` wrapper).

  - **Toolkit `isolation` kebab-attribute surface on
    `<pie-assessment-toolkit>`.** The `isolation` prop is now a
    JS-only object property (`type: "Object", reflect: false`); the
    previously observed `isolation="…"` HTML attribute is no longer
    parsed. Hosts that set isolation declaratively must move to a
    property assignment (or set it via `runtime.isolation` on the
    enclosing layout CE):

    ```html
    <!-- before -->
    <pie-assessment-toolkit isolation="shadow"></pie-assessment-toolkit>
    ```

    ```ts
    // after
    el.isolation = "shadow";
    ```

  - **Removed `ToolkitCoordinatorHooks` error hooks**
    (`onError`, `onTTSError`, `onProviderError`) and their
    subscription/dispatch logic on `ToolkitCoordinator`, plus the
    internal helpers (`toCauseError`, `contextFromFrameworkErrorModel`,
    `providerIdFromSource`) that synthesized the prior
    `(error, context)` payload from the canonical
    `FrameworkErrorModel`. The single canonical hook is
    `onFrameworkError(model: FrameworkErrorModel)`, which already
    delivers every `framework-error` exactly once per error
    (filterable on `model.kind`). Migration:

    ```ts
    // before
    coordinator.setHooks({
      onError: (error, context) => log({ error, context }),
      onTTSError: (error) => bumpTtsErrorCount(),
      onProviderError: (error, context) => log(context.providerId, error),
    });

    // after
    coordinator.setHooks({
      onFrameworkError: (model) => {
        // model.kind: "tool-config" | "runtime-init" | "runtime-dispose"
        //           | "coordinator-init" | "provider-init" | "provider-register"
        //           | "tts-init" | "tool-state-load" | "tool-state-save"
        //           | "section-controller-init" | "section-controller-dispose"
        //           | "unknown"
        // model.severity, model.source, model.message, model.details,
        // model.recoverable, model.cause, …
        log(model);
        if (model.kind === "tts-init") bumpTtsErrorCount();
      },
    });
    ```

  - **`framework-error` dual-emit on the layout CE host.** Previously,
    while a `<pie-assessment-toolkit>` was nested inside a layout CE,
    the layout host received **two** `framework-error` DOM events per
    error (one engine-bridge emit on the layout host plus the bubbled
    toolkit emit). The dual-emit is collapsed to a single canonical
    emit: the kernel's `handleFrameworkError` listener at
    `<pie-section-player-base>` now calls `event.stopPropagation()`
    after re-feeding the engine, so the bubbled toolkit emit no
    longer reaches the layout CE host. Outside listeners on the layout
    host now see exactly one `framework-error` per error — the
    engine-bridge emit (target = layout host, non-bubbling,
    non-composed). Direct listeners attached to
    `<pie-assessment-toolkit>` itself are unaffected (the toolkit
    dispatch reaches them before the kernel listener runs). The
    `onFrameworkError` callback prop and the package-internal
    `FrameworkErrorBus` are unchanged — both were already single-fire.
    The single-emit contract is now pinned by
    `packages/section-player/tests/section-player-framework-error-dual-emit.test.ts`
    (the file name is preserved for git blame; the test now asserts
    the single canonical emit).

  - **`allowPreloadedFallbackLoad` escape hatch.** Removed alongside the
    PIE-501 Phase B strategy-substitution work. Hosts that relied on it
    to mask preload-misses should ensure their preload set is correct
    (the `ElementLoader` primitive now rejects deterministically with a
    per-tag reason if a requested tag never registers).

  - **Per-strategy loader classes** (`IifeLoader`, `EsmLoader` and their
    test fixtures) in `@pie-players/pie-players-shared`. Replaced by the
    deep `ElementLoader` primitive plus IIFE / ESM adapters. Hosts that
    imported the loader classes directly should switch to
    `ElementLoader`; hosts that only used the public
    `<pie-item-player>` / `<pie-section-player-*>` attribute surface
    need no change.

  ## Migration

  ```ts
  // before
  const el = document.createElement("pie-section-player-splitpane");
  el.createSectionController = () => new SectionController();
  el.isolation = "shadow";
  el.setAttribute("item-toolbar-tools", "calculator,answer-eliminator");
  el.setAttribute("passage-toolbar-tools", "line-reader");

  // after
  el.runtime = {
    createSectionController: () => new SectionController(),
    isolation: "shadow",
    tools: {
      placement: {
        item: ["calculator", "answer-eliminator"],
        passage: ["line-reader"],
      },
    },
  };
  ```

  Section-controller resolution (replaces `section-controller-ready`):

  ```ts
  // before
  el.addEventListener("section-controller-ready", (event) => {
    const { controller } = (event as CustomEvent).detail;
    // …
  });

  // after — pull-style (preferred for one-shot consumers)
  const controller = await(
    el as HTMLElement & {
      waitForSectionController?: (timeoutMs?: number) => Promise<unknown>;
    }
  ).waitForSectionController?.(5000);

  // after — event-driven
  el.addEventListener("pie-stage-change", (event) => {
    const { stage } = (event as CustomEvent).detail;
    if (stage !== "engine-ready") return;
    const controller = (
      el as HTMLElement & { getSectionController?: () => unknown }
    ).getSectionController?.();
    // …
  });
  ```

  `AssessmentToolkitEvents` consumers should subscribe to the canonical
  DOM events / coordinator helpers instead. The Svelte-store coordinator
  had no in-tree consumers; hosts that imported it should switch to the
  class-based `ToolCoordinator` reachable via
  `coordinator.toolCoordinator` on `ToolkitCoordinator` (same method
  shape — `registerTool`, `showTool`, `hideTool`, `toggleTool`,
  `bringToFront`, `updateToolElement`, `hideAllTools`, `getToolState`,
  `isToolVisible` — plus `subscribe(listener)` for reactive consumers
  that previously relied on the Svelte-store derived views).

  ```ts
  // before
  el.addEventListener("readiness-change", (event) => {
    // event.detail: EngineReadinessDetail
  });
  el.addEventListener("interaction-ready", () => {
    // gate "start test" UI
  });
  el.addEventListener("ready", () => {
    // all items loaded
  });

  // after
  import type { StageChangeDetail } from "@pie-players/pie-players-shared/pie";
  import type { EngineReadinessDetail } from "@pie-players/pie-assessment-toolkit/runtime/internal";

  el.addEventListener("pie-stage-change", (event) => {
    const { stage } = (event as CustomEvent<StageChangeDetail>).detail;
    // stage: "composed" | "engine-ready" | "interactive" | "disposed"
    if (stage === "interactive") {
      // gate "start test" UI
    }
  });
  el.addEventListener("pie-loading-complete", () => {
    // all items loaded (single-shot, cohort-scoped)
  });
  // Readiness payload (formerly the `readiness-change` detail) is also
  // reachable on demand:
  const readiness: EngineReadinessDetail | undefined = el.selectReadiness?.();
  ```

  Hosts that previously de-duplicated `framework-error` listeners on the
  layout CE host (because the same logical error arrived twice — once
  bubbled from the toolkit, once from the engine bridge) can drop that
  de-dup logic: the layout host now fires `framework-error` exactly once
  per error. The canonical `onFrameworkError` callback prop and the
  package-internal `FrameworkErrorBus` were already single-fire and need
  no migration.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.30

### Patch Changes

- 0981bc3: Bump `@pie-lib/math-rendering-module` from `4.0.7` to `4.1.2` (PIE-147 / PIE-423).

  `math-rendering@4.1.0-next.1` regressed screen-reader support by dropping the
  `mjx-assistive-mml` MathML sibling that MathJax attaches for assistive
  technologies, so screen readers in the item player fell back to reading raw
  glyphs (e.g. "9 1 8") for prompt math. `4.1.2` — via
  [pie-framework/pie-lib#2201](https://github.com/pie-framework/pie-lib/pull/2201) —
  restores the assistive MathML attachment, so VoiceOver / NVDA announce prompt
  and answer-choice math correctly again.

  `players-shared` is the single source of truth for this dependency (enforced by
  `scripts/check-math-rendering-version.mjs`); every consumer — including
  `@pie-players/pie-item-player` — picks this up transitively on their next
  build/publish.

  The existing vite `patch-math-rendering-module-eval` hook in `item-player`
  still neutralizes the `return eval('require')` pattern in the upstream module
  (confirmed present in `4.1.2`), and `assert-no-eval-require-in-output` passes.

- 698aa82: Add `focusFirst()` to `pie-item-player` and nest it after section navigation focuses the current item card.

  - Export `queryFirstFocusableDeep`, `focusFirstFocusableInElement`, `isProgrammaticFocusTarget`, and `FOCUSABLE_SELECTOR` from `@pie-players/pie-players-shared` (deep traversal into **open** shadow roots; same selector basis as the focus trap).
  - `pie-item-player.focusFirst()` moves focus to the first visible interactive control inside the item.
  - Section player scaffold calls `focusFirst()` after programmatic focus lands on an item card (`start-of-content` without passage, and `current-item`).

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.17

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.16

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.14

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.12

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.5

### Patch Changes

- Publish a patch release for all publishable pie-players packages.

## 0.3.4

## 0.3.3

### Patch Changes

- Prepare a patch release for the latest framework fixes, math-rendering hardening, and packaging safety improvements.

## 0.3.2

### Patch Changes

- @pie-players/math-renderer-core@0.3.2
- @pie-players/math-renderer-mathjax@0.3.2

## 0.3.1

### Patch Changes

- @pie-players/math-renderer-core@0.3.1
- @pie-players/math-renderer-mathjax@0.3.1

## 0.3.0

### Minor Changes

- Adopt monorepo-wide fixed versioning and establish the first lockstep release train at 0.3.0.

### Patch Changes

- 9385ce0: Release all publishable packages in the repository.

  This intentionally triggers a full patch release sweep across all non-private workspace packages.

- Updated dependencies
- Updated dependencies [9385ce0]
  - @pie-players/math-renderer-core@0.3.0
  - @pie-players/math-renderer-mathjax@0.3.0

## 0.2.6

### Patch Changes

- beffcc0: Release all publishable packages.
- Updated dependencies [beffcc0]
  - @pie-players/math-renderer-core@0.1.5
  - @pie-players/math-renderer-mathjax@0.1.5

## 0.2.5

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
- Updated dependencies [71a9581]
  - @pie-players/math-renderer-core@0.1.4
  - @pie-players/math-renderer-mathjax@0.1.4
