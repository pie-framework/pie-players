# @pie-players/pie-tool-sign-language

## 0.3.69

### Patch Changes

- Updated dependencies [ced07e0]
- Updated dependencies [004d38e]
- Updated dependencies [cb99eae]
- Updated dependencies [8bb668b]
- Updated dependencies [787ad8f]
- Updated dependencies [3544e9d]
- Updated dependencies [6e2d488]
- Updated dependencies [cb99eae]
  - @pie-players/pie-assessment-toolkit@0.3.69
  - @pie-players/pie-players-shared@0.3.69

## 0.3.68

### Patch Changes

- 27284f8: Collapse six implementations that existed twice or more, with no public surface
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
- 00b8a71: Localize player and tool chrome, with Dutch as the first complete locale.
  
  A host sets one attribute — `locale="nl-NL"` on `pie-item-player` or a
  section-player layout element, or `runtime.locale`, which wins — and every string
  the suite renders itself follows it: toolbar labels, tool panels, player status
  and error text, formative controls, live-region announcements, `aria-label`s.
  Unset, the rendered output is byte-identical to before, including every tool
  button's accessible name. The graceful default is `en-US` and never
  `navigator.language`: under fixed lockstep patch-only versioning a
  rendered-string change reaches live delivery on a host's next install with no
  build signal on their side, so a host that opts into nothing must keep exactly
  the chrome it has.
  
  Interface locale is the deployment's fact and no element can know it, so it travels
  as a composition context rather than through `model`: the toolkit publishes the
  resolved locale and one provider on its runtime context, and every capability
  resolves both through `connectToolRuntimeContext`. The change signal is the
  context's own republish, which matters because a catalog is a dynamic import —
  without a reactive read every label would pin the English that rendered a tick
  earlier, the same silent failure `composition-context.md` records twice. A
  component that finds no publisher falls back to an English-only default provider
  rather than rendering raw message keys, which is what keeps tools working in
  `print-player`, in Studio preview and in a bare harness.
  
  Content language is untouched and remains a separate concern on a separate
  channel. QTI 3's implementation guide states the independence directly: a
  candidate may choose an interface language which may or may not also be the
  language of the content. Conflating the two is why classic PIE renders Spanish
  widget chrome for a Spanish item.
  
  `@pie-players/pie-players-shared/i18n` is rebuilt around that. Catalogs are
  TypeScript modules keyed by full BCP-47 tag, replacing JSON keyed by bare
  language: the English catalog's shape now generates the `MessageKey` union, so a
  mistyped key is a compile error instead of a key rendered on screen — a key
  assembled at runtime has to be asserted through `dynamicMessageKey()`, which is
  greppable and pairs with `hasKey()` so a miss falls back to a literal — and `tsc`
  compiling a `.ts` catalog removes the `with { type: "json" }` import-attribute
  hazard that already broke every non-English locale once under Node's ESM loader.
  Requests resolve through RFC 4647 lookup and then primary-subtag widening, so
  POSIX `nl_NL`, bare `nl` and regional `nl-BE` all reach the `nl-NL` catalog;
  `SimpleI18n` gains `plural()` — `Intl.PluralRules` alone, so Arabic's
  `zero`/`two`/`few`/`many` and Polish's `few`/`many` are reachable — plus
  `withLocale()` for two players rendering different locales from one provider, and
  it no longer writes `lang`/`dir` to `document.documentElement`, which an embedded
  player has no business doing. Components stamp their own host instead.
  
  The module split is what keeps this off the wire. `i18n/types` is type-only and
  erases; `i18n/provider` carries the 5 KB English catalog; the dynamic loader map
  lives in `i18n/catalogs`, which players import and tools do not. Since every
  player and tool `vite.config.ts` sets `external: []`, that boundary is the
  difference between one locale chunk and eighteen tool bundles each carrying a
  catalog they will never load.
  
  `ToolRegistration` gains optional `nameKey` and `descriptionKey` beside the
  still-required `name` and `description`. The keys are supplied by
  `default-tool-loaders`, which owns the packaged capability set, and a
  host-authored registration with no keys renders its `name` verbatim.
  
  The English catalog does enumerate a `tools.<capability>` namespace per packaged
  capability, so `default-tool-loaders` is not the only file naming them.
  `check:capability-neutrality` is unaffected: what it protects is core not
  branching on a capability id or granting behaviour from one, and a message key
  does neither — it is inert text, resolved by whoever holds the id. Splitting the
  catalog per capability would satisfy the letter of it and cost both the
  single-reference coverage check and the bundle boundary that keeps locale strings
  out of eighteen tool bundles.
  
  English output is byte-identical. Every English catalog value reproduces the
  literal it replaced exactly, punctuation and inconsistencies included, because
  fixed lockstep patch-only versioning puts a reworded string into a host's live
  delivery on their next install with no signal on their side — and most of what
  this change touches is accessible names and live-region announcements, where a
  host may be asserting exact text. Where the pre-adoption code rendered the same
  concept in two forms, the catalog carries both rather than assembling one by
  interpolation: `tools.ruler` has three forms of each unit name, matching the Title
  Case button label, the lowercase announcement and the raw state token in the
  accessible name. Improving any of these strings is a separate change with its own
  entry.
  
  `en-US` and `nl-NL` are complete at 402 keys, and they are the only locales
  shipped. The pre-adoption `es`/`zh`/`ar` catalogs are deleted rather than
  re-keyed: 76 of their 142 keys named UI this codebase does not render — a
  section-builder, an assessment shell, 25 Desmos internals Desmos localizes
  itself, colour-scheme names the theme registry owns — while the strings actually
  on screen had no keys at all; the published `dist` omitted
  `with { type: "json" }` on exactly the three dynamic locale imports, so none of
  them could load outside a bundler in any version through `0.3.67`; and nothing
  read them, here or in any consumer checkout. Machine-filling the gap would ship
  strings nobody has read, to learners.
  
  `check:i18n-coverage` now runs in the pre-commit and CI gates: a locale declared
  complete must stay at 100%, a locale mid-translation can be listed as carried and
  is reported without gating, and either fails on a key English no longer defines.
  
  The pre-adoption i18n layer is replaced rather than versioned alongside.
  `BUNDLED_TRANSLATIONS`, `loadTranslations`, `SimpleI18n.tn()` and two Svelte
  composables are gone. A grep of all three consumer checkouts finds no call site
  for any of them outside build caches — the layer was published complete and
  unused, which is what made replacement the right move instead of a second
  parallel implementation of the kind that produced `I18nService` as a copy of
  `SimpleI18n`.
- e94b097: Reject a media reference whose `version` this build does not implement, instead
  of rendering it on a guess.
  
  `MediaAssetRef.version` is a required literal and the shared contract requires
  unknown-version rejection for runtime rendering, but both card validators cast
  the payload to `Partial<MediaAssetRef>` and never read the field, so a card
  claiming version 2 rendered as though it were version 1 — with whatever the
  fields meant then. `isUnsupportedMediaAssetVersion` now guards both, and the
  toolkit exports it alongside the other media-payload validators a capability
  package needs.
  
  An absent `version` is still accepted. Producers predate the field, and this
  module's posture toward absent fields is to treat them as absent rather than as
  a positive claim of something else — the same rule `media.kind` and
  `matchesRequestedSignLanguage` already follow.
- cb11691: Deliver timed-media sections: cues that reveal and gate questions against a media
  timeline.
  
  A section that sets `sectionType: "timed-media"` carries a `timedMedia` block with
  a required `stimulusRef`, a cue timeline and a playback policy. The stimulus is a
  passage — a `class: "stimulus"` rubric block whose PIE config mounts the media
  element — so media keeps a Catalog Owner and its captions, transcript and signed
  alternates resolve through the accessibility-catalog rail that already serves them.
  `timedMedia` carries no media payload at all.
  
  The section reaches media only through a **Media Time Source** port shaped after
  `HTMLMediaElement`, never through a library API. `createMediaElementTimeSource`
  adapts a native `<video>`/`<audio>` in a few lines, and a host can register its own
  implementation for a third-party player through the same `pie-media-time-source`
  event the stimulus card uses — so delivering timed media needs no PIE element. The
  port declares `canPause` and `canRestrictSeeking`; where a capability is missing the
  matching policy degrades from enforced to **advisory** — cues still fire, state is
  still recorded, the projection reports `enforcement: "advisory"`, and a recoverable
  framework warning of kind `timed-media` says which policy lost its teeth. A seek
  lock that does not lock must not read as one that does.
  
  Cue gate conditions name the shipped formative vocabulary rather than defining
  their own: `responded` (which reads item completion, so it works in a section that
  does not deliver formatively), `correct`, and `partial-or-better`. A gate on
  correctness must state `onUnknownCorrectness`, because an item no controller can
  score is a real state and neither answer may be assumed. Three authoring mistakes
  are refused loudly rather than delivered silently: a `stimulusRef` that resolves to
  nothing; a correctness gate over an item without unlimited Tries, where a learner
  who spent a finite budget could never release playback again; and a `stimulusRef`
  that resolves to a renderable exposing no time source, which is reported once the
  section's content has loaded and no source has attached — whether a renderable
  mounts media is not knowable from authored data, so that half of the rule is a
  runtime report rather than a validation error. All three deliver the section with
  every item visible; a cue timeline nothing can drive would otherwise leave a pane of
  questions no cue can ever reveal.
  
  New public surface: `@pie-players/pie-players-shared/timed-media` (data types, the
  port, validation, the cue reduction, the session slice and the native adapter),
  `sectionType` / `timedMedia` on `AssessmentSection`, `timedMedia` on the section
  composition model and on the persisted session snapshot,
  `attachMediaTimeSource` / `detachMediaTimeSource` / `getTimedMediaProjection` on
  `SectionControllerHandle` (`attachMediaTimeSource` takes an optional
  `renderableId`, checked against the renderable `stimulusRef` resolved to so a
  second video passage cannot drive the timeline), `pauseMediaForCompetingAudio` on
  the same handle, and four controller events — `timed-media-cue-changed`,
  `timed-media-audio-started`, `timed-media-policy-degraded`, `timed-media-invalid`.
  A host switching exhaustively over `SectionControllerEvent["type"]` with no
  `default` gains four variants; everything else is optional and absent reads as
  `null`.
  
  Cue state joins the toolkit's composition revision key, without the clock: a cue
  firing changes neither the renderables nor the item sessions, so the emit would be
  coalesced away and no card would ever see it — while folding media position in
  would republish four times a second for a change nothing renders.
  
  Read-aloud and media audio never overlap, on a last-action-wins rule: starting
  read-aloud pauses the media, starting media pauses read-aloud, and neither side
  resumes what it silenced. The section supplies the two halves it can — the
  `pauseMediaForCompetingAudio()` method and the `timed-media-audio-started` event —
  and the toolkit arbitrates, because only the toolkit holds both the TTS service and
  the section. A port reporting `canPause: false` cannot yield and read-aloud proceeds
  over it: withholding an accommodation to protect a policy the port already said it
  cannot keep is the worse failure, and that gap is already reported at attach. Media
  carrying no audio still pauses read-aloud, because no portable signal distinguishes
  a silent track from a narrated one.
  
  That rule already existed for the signing region, and now has one statement instead
  of two: `bindTtsAudioHandoff` and `pauseTtsForMediaAudio` are exported from
  `@pie-players/pie-assessment-toolkit`, and `@pie-players/pie-tool-sign-language`
  binds them in place of its own copy. Signing behavior is unchanged — the states that
  count as speaking, the pause-not-stop rule, and the tolerance for a torn-down
  service are the same, and now carry unit coverage neither call site had.
  
  Two things outside timed media change. The section content service now records how
  a `stimulusRef` resolves to a rendered renderable, rather than leaving each caller
  to re-derive it. And the engine's controller subscription isolates the new
  `onControllerEvent` handler it routes events through, so a diagnostic that throws
  cannot abort the listener before the composition republish and stop every
  controller event in the section behind a console warning. That guard is hardening
  around the new route, not a fix for a defect on `develop`: before this the
  subscription took no event and only republished.
  
  `scoringPolicy` accepts `sum-child-outcomes`, `average-child-outcomes` and
  `host-defined`. It is validated, persisted and carried to the host unchanged; PIE
  derives no aggregate from any of them and assigns no default, so a section that omits
  it is not silently given one. `weighted-child-outcomes` is deliberately absent: no
  weight is authorable on a cue, an item ref or the section, so the entry would name a
  capability PIE does not have. A host holding its own weights says `host-defined`.
  
  Existing content is untouched: no `sectionType` means no projection, no session
  slice and no cue behavior, and cue-gated cards are the only cards that ever carry
  `hidden`.
- Updated dependencies [2d8ce6a]
- Updated dependencies [27284f8]
- Updated dependencies [e94b097]
- Updated dependencies [67a3d7e]
- Updated dependencies [d68c01b]
- Updated dependencies [3f5e968]
- Updated dependencies [27284f8]
- Updated dependencies [67f286c]
- Updated dependencies [55016b5]
- Updated dependencies [fc71c91]
- Updated dependencies [e94b097]
- Updated dependencies [00b8a71]
- Updated dependencies [6e1e053]
- Updated dependencies [e94b097]
- Updated dependencies [7c9fb28]
- Updated dependencies [979e643]
- Updated dependencies [1d9f2d3]
- Updated dependencies [e94b097]
- Updated dependencies [27284f8]
- Updated dependencies [54742db]
- Updated dependencies [f61c7c7]
- Updated dependencies [0dc9c96]
- Updated dependencies [cb11691]
- Updated dependencies [4f0cb3f]
- Updated dependencies [e94b097]
  - @pie-players/pie-players-shared@0.3.68
  - @pie-players/pie-assessment-toolkit@0.3.68

## 0.3.67

### Patch Changes

- Updated dependencies [b264ab2]
- Updated dependencies [fe9b4f0]
- Updated dependencies [61d6aa0]
  - @pie-players/pie-players-shared@0.3.67
  - @pie-players/pie-assessment-toolkit@0.3.67

## 0.3.66

### Patch Changes

- 5e6fcde: Make accessibility catalog ownership one resolver contract.

  Mounted items and passages now register all entity-root, extracted, and model
  catalogs through one owner transaction. Content surfaces observe a bound owner
  view and give capabilities an immutable, deterministic catalog snapshot instead
  of exposing the raw entity, resolver, and separately assembled owner context.
  Signing and transcript capabilities now own only their card interpretation.

  Capability authors should read `ToolContentDependencyContext.catalogs` and no
  longer use the removed catalog-collection exports. Direct resolver clients,
  including inline TTS, retain `getAlternative(...)` and
  `catalogOwnerContextFor(...)`. Existing catalog IDs, card and payload shapes,
  `data-catalog-idref`, scoped lookup precedence, TTS fallback behavior, and
  section-player custom-element contracts are unchanged. Invalid optional catalog
  data remains recoverable: it is warned about and omitted without blocking the
  primary assessment content.

- Updated dependencies [556c422]
- Updated dependencies [2a741c6]
- Updated dependencies [5e6fcde]
- Updated dependencies [2bcd9fa]
- Updated dependencies [2bcd9fa]
- Updated dependencies [2bcd9fa]
- Updated dependencies [1f29de7]
- Updated dependencies [5e6fcde]
- Updated dependencies [5f133be]
- Updated dependencies [9a183cf]
  - @pie-players/pie-assessment-toolkit@0.3.66
  - @pie-players/pie-players-shared@0.3.66

## 0.3.65

### Patch Changes

- 2b015a9: Render docked alternates on the passage card, not only the item card.

  A catalog card docks to a content node, and a passage owns content nodes exactly
  as an item does — so a signed reading of a shared passage is authored once, on the
  passage, under the owner scope `<pie-passage-shell>` already registers. Resolution
  worked; nothing rendered it, because the media region existed only on the item
  card.

  The region moves to `SectionCardMediaSplit`, shared by both cards, so there is one
  implementation of grant-plus-content availability, mount reconciliation and split
  sizing rather than a copy per card kind. The host surface is renamed
  `item-media` → `content-media`, since item cards and passage cards open the same
  slot and a capability should declare it once: `@pie-players/pie-tool-sign-language`
  now exports `CONTENT_MEDIA_SURFACE` in place of `ITEM_MEDIA_SURFACE` and declares
  `supportedLevels: ["item", "passage"]`. A host capability that declared
  `surfaces: ["item-media"]` must declare `"content-media"` to keep mounting.

- 3f6e33a: Signing becomes a capability package. New `@pie-players/pie-tool-sign-language`, and no package in the player names signing any more.

  The last capability-specific code in the generic core was signing's: the toolkit validated `sign-language` catalog cards, and section-player's item card knew the `signLanguage` support id, the catalog type, the language-matching rule and the region element by name. So the one accommodation PIE most needs hosts to be able to add was the one thing only we could add.

  ## The new package

  `@pie-players/pie-tool-sign-language` owns `signLanguageRegistration` (`activation: "region"`, `surfaces: ["item-media"]`, `supportedLevels: ["item"]`, `requiresAuthoredContent`), the card validators and language matching that were `services/sign-language-cards.ts` in the toolkit, the content resolver that was the signing half of section-player's `section-item-media.ts`, and `<pie-tool-sign-language>`, which was `SectionItemMediaRegion.svelte`.

  It is authored against `@pie-players/pie-assessment-toolkit/tools/internal` — the same entry point our packaged registrations use — and it is the worked example of a capability contributed from outside the player. A host opts in with two lines:

  ```ts
  import { signLanguageRegistration } from "@pie-players/pie-tool-sign-language";
  registry.register(signLanguageRegistration);
  ```

  Importing the package registers the element, so there is no module-loader entry to add.

  **Deliberately not in `createPackagedToolRegistry` or `DEFAULT_TOOL_MODULE_LOADERS.`** An accommodation with an authored-content dependency is a deployment's decision: a default that granted it would hand signing to every learner whose item happened to carry a card. The `apps/section-demos` `sign-language` route now registers it itself, which is the demonstration that a host can contribute a capability with no id of ours involved.

  ## What section-player kept and what it lost

  `SectionItemCard.svelte` iterates `getToolsBySurface("item-media")`, decides each capability against **its own** `pnpSupportIds`, calls its `requiresAuthoredContent.resolve`, and mounts through `ToolRegistry.renderForSurface`. It names no capability, no support id, no catalog type and no element tag, and it does not depend on the signing package — `check:player-tool-boundaries` forbids even the string.

  The region's own layout stays here, because it is the card's geometry rather than the capability's: `MEDIA_REGION_*`, `clampMediaRegionPercent`, `mediaRegionPercentFromDrag` and `SectionCardSplitDivider`. The three `--pie-section-player-item-media-*` tokens keep their names — hosts set them and PIE-880 is in testing against them — but the registry now records the signing package as their owner.

  Two behaviours the old file documented are preserved and re-keyed generically, because both were load-bearing: the `onCatalogsChange` re-resolve with a resolve-once-on-subscribe, and the write-only-when-the-signature-changed guard. That guard is not an optimisation. Re-rendering the card re-applies `item` on `<pie-item-shell>`, which re-registers the item's catalogs, which makes the resolver emit again; one unconditional write per emission makes the cycle self-sustaining and Svelte aborts at its depth limit with the DOM half-applied.

  ## Contract changes

  `isVisibleInContext` is now optional on `ToolRegistration`, required for the two toolbar activations and rejected only when present and not a function. A region capability has no toolbar presence to be relevant to, and the question it would answer — is there anything to show here — is `requiresAuthoredContent`. A registration that omits it is never returned by `getVisibleTools`. Callers that invoke it on a registration they wrap need `?.` — the one in-repo case was a demo decorator.

  `applyMediaFragment` reached the public surface through `sign-language-cards.js`; it is now exported from `services/catalog-media.js` directly, along with `isSafeMediaSrc`, `normalizeMediaSources`, `normalizeMediaFragment` and `trimmedOrUndefined` — the validators any capability package needs to read a media payload. The signing-specific exports (`SIGN_LANGUAGE_CATALOG_TYPE`, `AMERICAN_SIGN_LANGUAGE`, `describeSignLanguage`, `isSignLanguageCard`, `matchesRequestedSignLanguage`, `resolveSignLanguageMedia`, `SignLanguageMedia`) move to the new package.

  `packages/players-shared`'s `SignLanguageCardPayload` stays. It is authored wire data alongside `CatalogCard`, and a published shape for a standard support id is not a core dependency on a capability — the same argument that exempts `pnp-standard-features.ts`.

  ## Behaviour

  Unchanged, and that is the whole point. PIE-880 is in testing, so the guard is that its specs pass with import-path edits and **no assertion changes**: `section-player-sign-language-region.spec.ts` and `pie881-imported-asl-integration.spec.ts` (14 specs, including the re-registration-loop and keyboard-divider cases), plus the unit tests, now split between `sign-language-content.test.ts` in the new package and the sizing half left behind.

  `check:fixed-versioning` treated a 404 from npm as a failure, so adding any publishable package broke it. A never-published package is now reported and excluded from the version-sequence comparison; a network or auth failure still stops the gate, because "cannot tell" must not read as "fine".

- 3972f16: **Breaking for capability packages.** `ToolSurfaceRenderResult.sync` takes the current render context: `sync?: (context: ToolSurfaceRenderContext) => void`.

  It took no argument, so a registration had nothing to read but the context captured when it rendered. A host reconciles surface capabilities by `toolId` and calls `sync` rather than remounting — a `<video>` recreated mid-playback restarts the recording — so `sync` is the _only_ path a re-resolve has to an element already on screen, and with a captured context it re-applied the values the host already had. Two live consequences: a signed alternate re-resolved to a different recording (a `signLang` parameter change, or a catalog registering after first paint) left the learner watching the previous one, and a host calling `updateAssessment(...)` mid-session left the annotation gateway wired to the previous coordinator. Both were silent.

  Update a registration by reading the parameter instead of the closure:

  ```diff
  -const applyProps = () => {
  -  element.media = context.content;
  +const applyProps = (current: ToolSurfaceRenderContext) => {
  +  element.media = current.content;
   };
  -applyProps();
  +applyProps(context);
   return { element, sync: applyProps };
  ```

  ## Host surfaces a region capability can actually reach

  `section-overlay` gated every capability on `decideToolPolicy`, whose candidates are seeded only from `tools.placement` — and placing an `activation: "region"` capability is a `tools.unplaceableActivation` error at `error` severity. A capability that is only ever a region was therefore unreachable on that surface in both directions, and the mechanism worked for exactly the one capability that motivated it, which also has a toolbar activation. Region capabilities are now gated on `decideFeaturePolicy`, matching the item-media surface; placement-driven ones keep the placement question, which is where their candidacy comes from.

  `item-media` now awaits `ensureToolModuleLoaded` before mounting, so a capability registered through the documented lazy module-loader path renders instead of silently missing its element. This costs a capability that registers its element eagerly one microtask.

  `requiresAuthoredContent` is resolvable only on a surface the host renders per item or per passage. `CatalogOwnerContext` names an item model or a passage and never a section, because a DRD resource pairs with content rather than with a container — so `section-overlay` now declines a capability declaring one, with a console warning, instead of mounting it with `content: undefined`. That is documented on the contract; `resolve` must also be synchronous and return JSON-serializable content, both of which hosts already relied on and neither of which was stated.

  ## Item media region lifecycle

  Three fixes in `SectionItemCard`, all reachable by toggling an accommodation at runtime:

  - **Losing the last grant destroys the region, and the mount effect treated a missing anchor as "nothing to do."** The capability's `destroy()` never ran, so a detached `<video>` kept playing audio, and its entry stayed in the mounted map — so the next grant found an "existing" mount that was no longer in the document and the region stayed blank for the rest of the session. It now tears down, matching what the section-overlay surface already did.
  - **The region and its keyboard-focusable resize divider followed the grant count, not what mounted.** `renderSurface` returning `null` is a legitimate answer — a host that remapped the element tag through `toolTagMap` to one it never defined takes that path — which produced an empty 34% column with a handle dividing nothing. Both now follow the mounted count.
  - **Both surface anchors are `display: contents`.** They were always-present elements generating their own box: the overlay anchor as a permanent flex item shifting `gap` and child-index selectors, the media anchor breaking any `height: 100%` chain between the region and the capability's element.

  ## Guarantee that was asserted but not enforced

  `UNIVERSAL_SUPPORTS_PRESET`'s exclusion of content-dependent accommodations was a hardcoded `not.toContain("signLanguage")`, with a comment deferring the declaration-driven form to the step that has now landed. It reads `registry.getContentDependentSupportIds()`, which had no caller outside its own unit test, and a second assertion covers the other half: no packaged registration declares a content dependency, so a twelfth one could not pass by being invisible to the first check.

  ## PNP debugger

  Region capabilities no longer get per-level placement toggles or an "all available tools" entry. Clicking one wrote config that fails `tools.unplaceableActivation` at `error` severity, and the "visible" marker beside it read a placement-scoped decision a region capability is never in — so it reported "not visible" while the capability was correctly rendering. Rows show `host surface (not placed)` and, for a content-dependent capability, what has to be authored, which is what `contentDependencyDescription` was added for.

- Updated dependencies [35f1cc9]
- Updated dependencies [c5fbf21]
- Updated dependencies [c4c3aca]
- Updated dependencies [2b015a9]
- Updated dependencies [411b2cd]
- Updated dependencies [f0d5802]
- Updated dependencies [f588924]
- Updated dependencies [3f6e33a]
- Updated dependencies [3972f16]
- Updated dependencies [5183654]
- Updated dependencies [c59396b]
  - @pie-players/pie-assessment-toolkit@0.3.65
  - @pie-players/pie-players-shared@0.3.65
