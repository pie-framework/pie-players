# @pie-players/pie-section-player

## 0.3.65

### Patch Changes

- 8e0342a: Enabling a delivery backend at runtime no longer remounts every item.

  `resolvePlayerRuntime` sets `hosted: true` when a delivery backend is enabled and the host has not said otherwise, and `hosted` is one of the inputs to the items pane's element-warmup signature — correctly, because it changes how bundles are requested. But the pane rendered its cards only while that warmup was resolved, so re-warming tore every card out of the DOM and built a new one.

  Two consequences, both invisible in the DOM after the fact. Every item player was destroyed and recreated, discarding whatever session state the learner had in progress. And each item POSTed its delivery `load` twice — once from the dying instance and once from its replacement — so a host whose load endpoint starts an attempt or stamps a timestamp saw it happen twice per item.

  The placeholder now covers a first paint and a genuine content swap. Once a warmup has resolved for an element set, the cards stay mounted through any later invalidation that leaves that set alone; item players re-register their own elements on demand either way.

  Also corrects two stale assertions in the preloaded e2e spec, which expected three item shells on a fixture that dropped to two items in PIE-619.

- c4c3aca: The packaged capability set moves out of the generic toolkit into the composition layer. `@pie-players/pie-assessment-toolkit` now names no capability.

  Eleven concrete registrations, the element tag map and the placement presets lived inside the generic package, so the registry and policy core knew every capability by name and a host could not contribute one without a PR against that package. They are now in `@pie-players/pie-default-tool-loaders`, which already owned the deployment's capability set for module loading.

  ## Moved

  `createPackagedToolRegistry`, `registerPackagedTools`, `PACKAGED_TOOL_REGISTRATIONS`, the six registration modules, `PACKAGED_TOOL_TAG_MAP` (was `DEFAULT_TOOL_TAG_MAP`), `PACKAGED_TOOL_PLACEMENT`, `SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT` and `PACKAGED_TOOL_ORDER` (was `DEFAULT_TOOL_ORDER`). Each registration is also exported individually, for a host composing a subset.

  Import them from `@pie-players/pie-default-tool-loaders` instead of the toolkit. Section-player already depended on that package for `DEFAULT_TOOL_MODULE_LOADERS`, so a host using the section-player elements needs no manifest change.

  ## Kept in the toolkit

  `ToolRegistry`, the registration contract, `createDefaultToolRegistry`, the toolbar button/overlay helpers, `createToolElement` / `resolveToolTag` / `toToolIdFromTag`, and `DEFAULT_TOOL_PLACEMENT`. It knows `featureId`, placement levels, activation kinds and precedence rules, and knows no capability ids.

  Three of those kept the name and changed what they do:

  - **`createDefaultToolRegistry()` builds an empty registry.** Its option bag changed with it: `overrides` (a toolId-keyed map replacing a packaged registration) became `registrations` (the registrations to register); `includePackagedTools` and `toolIds` are gone, because there is no packaged set here to include or filter; and `toolTagMap` no longer merges a built-in map, so a partial map is now the whole map. For the packaged set, call `createPackagedToolRegistry()` from the composition package.
  - **`DEFAULT_TOOL_PLACEMENT` is empty at every level.** A host using it as a starting preset gets no tools and no diagnostic. `PACKAGED_TOOL_PLACEMENT` and `SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT` in the composition package are the populated presets.
  - **`toToolIdFromTag` reads only supplied overrides.** It returns `undefined` for a packaged tag with no installed map, where it previously resolved from the built-in one.

  A new `@pie-players/pie-assessment-toolkit/tools/internal` entry point carries what a package needs to _write_ a registration — the contract types, the context predicates, scoped-id and element helpers, the toolbar helpers, and the two provider descriptors. A separate entry point for the same reason `runtime/internal` and `policy/internal` exist: it serves sibling packages, and widening `.` with two dozen registration-authoring helpers would make each one something a host could expect us to keep. A host writing its own capability package imports from here too — the same mechanism our registrations use.

  ## Migration

  If you call `createToolsConfig` / `normalizeAndValidateToolsConfig`, or construct a `ToolkitCoordinator`, **without** passing a `toolRegistry`, add the composition package and pass one:

  ```ts
  import { createPackagedToolRegistry } from "@pie-players/pie-default-tool-loaders";

  const result = createToolsConfig({
    source,
    tools,
    toolRegistry: createPackagedToolRegistry(),
  });
  ```

  Without it your tool ids, levels and provider keys are no longer validated — see the diagnostic below. Tools still render: a host using the section-player elements gets its registry from the player, which builds one itself.

  ## Consequences

  **No fallback registry anywhere in the toolkit.** `ToolkitCoordinator` and `<pie-item-toolbar>` used to build a packaged registry when the host supplied none; they now use an empty one. A toolbar with no registry renders no buttons, which is the honest answer — with nothing registered there is nothing whose visibility or render contract could be consulted.

  **Tool-id validation reports when it cannot run.** With no registry there is nothing to check ids against, so `normalizeAndValidateToolsConfig` emits one `tools.registryUnavailable` diagnostic at `warning` severity naming the missing registry, and skips the id, level and provider checks. Two deliberate choices there: not throwing, because that would turn an existing working host setup into a construction failure; and not skipping silently, because downgrading "your ids are valid" to "nobody looked" with no signal is how a typo reaches a learner.

  `strictness: "error"` now rejects only `severity: "error"` diagnostics. Every diagnostic was `"error"` before this one, so nothing else changes.

  **`resolveToolTag` has no built-in map.** It reads only the overrides it is handed, which `createPackagedToolRegistry` installs via `setComponentOverrides`. Asking for an unmapped, non-hyphenated tool id throws naming the missing mapping rather than reporting a hyphen rule the caller did not break. `ToolRegistry.renderForSurface(toolId, context)` is new and is how a host should mount a surface capability: it merges the registry's component overrides the way `renderForToolbar` always has, so a capability can resolve its element tag.

  ## Guard

  `bun run check:capability-neutrality` fails when a capability id or `pie-tool-*` tag appears in the generic core — policy, the registry, catalog resolution, tools-config validation, the registry/tag factories. Without it the regression returns with the next capability, which is how these arrived: each reasonable on its own, each a name in a file that should not have had it. Wired into `verify:pre-commit`, `verify:ci-lint-typecheck` and `verify:publish`.

  It carries one reviewable exception: the `providers.tts` → `providers.textToSpeech` migration diagnostic in tools-config validation. That is one capability's rename in generic code and a legacy shim of the kind this repo disallows outside the `pie-item` contract, but deleting it drops a useful migration error and generalising it (a `deprecatedProviderKeys` declaration on the registration) is a design change rather than part of this move.

  `services/tts/**`, `TTSService`, `TTSToolProvider`, `DesmosToolProvider` and `tools/calculators/` stay in the toolkit; moving them is separate, larger work. The `pie-calculator` and `pie-tts` dependencies therefore remain — contrary to what PIE-886 assumed, they never came from the registrations. Both are interface-only packages with no dependencies of their own, imported type-only by `TTSService`, `interfaces.ts` and the provider descriptors.

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

- 411b2cd: **Breaking.** The core no longer synthesizes a default personal-needs profile. A host that supplied none now has none.

  What this does **not** change is which toolbar tools appear. Toolbar candidates come from `tools.placement`, and `PnpPolicySource` only evaluates support ids that appear somewhere in the bound policy inputs — so an empty profile blocks nothing and mandates nothing, and a placement-driven toolbar renders exactly as before. If your tools come from placement, this entry costs you nothing.

  What does change is `ToolkitCoordinator.decideFeaturePolicy(supportId)`. For the 38 ids the derivation used to produce it answered `granted: true` for every host that supplied no profile, and now answers `granted: false` with reason `Feature "…" not configured`. That is the path capabilities without a toolbar placement are gated on — a host surface capability, and any host code asking "is this granted for this learner" outside a toolbar. Supply a profile if you rely on it; the one-line adoption is below.

  `computeDefaultSupports()` derived the fallback profile from every registered tool's `pnpSupportIds`, which reads _registry membership_ as _eligibility tier_. Registration means a capability is policy-addressable; it does not mean "universal, on by default". So an accommodation-tier capability was granted to every student of every host that supplied no profile. The remedy was `ACCOMMODATION_ONLY_SUPPORT_IDS`, a compile-time array naming `signLanguage` — which worked for the one accommodation shipped in this repo and gave a host contributing its own accommodation nothing to add to.

  Which capabilities a deployment grants by default is a property of the program, not of a capability: TTS is a universal feature in one program and a documented accommodation in another. It belongs in policy configuration, alongside the district and test-administration levels that already live there.

  ## What changed

  `@pie-players/pie-assessment-toolkit` drops `computeDefaultSupports()`, `DEFAULT_PERSONAL_NEEDS_PROFILE`, `ACCOMMODATION_ONLY_SUPPORT_IDS` and `createDefaultPersonalNeedsProfile()`. In their place, `createEmptyPersonalNeedsProfile()` returns a profile granting nothing. No alias for the old name: a function called "default" is what invited a populated default in the first place, and the rename is the signal that the return value changed.

  `@pie-players/pie-default-tool-loaders` gains `UNIVERSAL_SUPPORTS_PRESET` and `createUniversalPersonalNeedsProfile()` — the 38 support ids the old derivation produced, frozen as data. Adopt it, extend it, or replace it. It is pinned by a test rather than recomputed, so a diff there is a deliberate program decision instead of a side-effect of registering a tool. It excludes any capability declaring `requiresAuthoredContent`, asserted against `registry.getContentDependentSupportIds()` rather than against a list of ids — which is what lets a host's own accommodation get the same guarantee.

  `section-player` stops injecting a profile into a section that carries none. `pnpEnforcement` auto-detection engages on any non-empty profile, so the injected default silently turned enforcement on for every host — a gate whose profile granted everything, so it could not deny anything. Enforcement now engages only on real host policy material: a profile, a district policy, a test administration block, or item-level tool settings.

  The PNP debugger no longer labels its fallback "toolkit default profile (derived)". Nothing derives one, and that label over an empty `supports` array read as a broken derivation rather than as an unconfigured section.

  ## Migration

  A host that wants the previous grants adds one line at the point it builds a section or assessment:

  ```ts
  import { createUniversalPersonalNeedsProfile } from "@pie-players/pie-default-tool-loaders";

  const section = {
    ...authoredSection,
    personalNeedsProfile: createUniversalPersonalNeedsProfile(),
  };
  ```

  A host already supplying `personalNeedsProfile` is unaffected. The one case that changes a toolbar: a host that relied on the implicit default _and_ supplies `settings.districtPolicy` or `settings.testAdministration`. Enforcement stays on from that material, and there are now no supports to satisfy a `requiredTools` entry or to survive a `blockedTools` one.

  `@pie-players/pie-item-player` consumers are unaffected — it does not depend on the toolkit.

  This supersedes the statement in the sign-language catalog media region entry, which described `signLanguage` being filtered out of the computed default by id. Both the computation and the filter are gone; signing stays out of a wholesale grant because it declares a content dependency, not because it is named.

- f588924: Section-player's section-scoped overlay is registry-driven. It no longer names `annotationToolbar`.

  `PieSectionPlayerBaseElement.svelte` named that tool id in three places — the policy check, the module load and the `<pie-tool-annotation-toolbar>` element — so a host could not contribute a second section-scoped capability without a PR against this repo. The base element now offers a named surface, `section-overlay`, and asks `registry.getToolsBySurface("section-overlay")` what can fill it. Nothing in section-player names a capability, an element tag, or a package.

  `annotationToolbarRegistration` declares `surfaces: ["section-overlay"]` and owns the mounting it used to have done for it: resolving its element tag through the component-override map, setting `enabled`, `ttsService` and `highlightCoordinator`, and returning a `sync` so a policy change reapplies props instead of remounting. Remounting would drop the element's own state and, for a selection gateway, the learner's current selection. It keeps `activation: "selection-gateway"` and its `renderToolbar`, so nothing about the toolbar path changes.

  Three behaviours the generic path has to keep, and does:

  - **Same grant check.** The three-level `decideToolPolicy` sweep over section, item and passage runs per discovered capability against its own `toolId`, with the same scope shape, so a custom `PolicySource` reading `assessmentId` cannot disagree with a toolbar's verdict for the same level.
  - **Same module gating.** A capability stays unmounted until `ensureToolModuleLoaded` resolves and its element is defined, so an optional package that is not installed leaves the surface empty rather than mounting an undefined element. The registration declines by returning `null` if its tag is still unknown.
  - **One instance.** The mount effect reconciles against what is already mounted, so a capability that stays granted is never torn down and remounted, and one that loses its grant is unmounted and destroyed.

  A capability returning `null` from `renderSurface` means "nothing to show", which is a legitimate answer and not an error. One throwing is logged against its tool id and skipped, so a broken capability cannot take the surface down with it.

  The mount point is an always-present `<div data-pie-tool-surface="section-overlay">` inside `<pie-assessment-toolkit>`, so a capability granted mid-session has somewhere to land and the toolkit's context requests still bubble to the provider from a mounted element.

- 23da920: **Heading structure changes for every section-player host.** The player now publishes the heading level its cards occupy, and every descendant derives its outline from it. New `base-heading-level` attribute (1–6, default 2) on `pie-section-player-splitpane`, `-vertical`, `-tabbed` and `-kernel-host`.

  Card headings were a hardcoded `<h2>` and nothing was published downward, which produced three defects with one cause:

  - **The item's heading was announced twice at one level.** The card renders "Question 3" as an `h2`; the PIE element then rendered a screen-reader-only "Multiple Choice Question" as another `h2`, so assistive technology heard the item type as a sibling of the question rather than a description of it. The item player is now told the level is already filled.
  - **Passage structure was flat.** A passage's own title sat at the level of the card's "Passage" group label. The passage player now starts one level deeper, putting the title beneath its label.
  - **Authored `data-heading` markup was inert.** A PIE element promotes `<p data-heading="headingN">` to a heading element only once a level is published. Nothing published one, so the semantic passage and prompt headings added in PIE-151 rendered as paragraphs in every host — a completed feature, with content authored against it, producing no structure and no warning.

  At the default this yields card `h2` → passage title `h3` → passage content `h4`, and question `h2` → prompt content `h3`, which is the outline PIE-159 specifies for a host that furnishes its own question headings.

  The two content kinds derive different levels from the one published value, deliberately: an item card's heading _is_ the item's heading, so the element must not add a second at that level; a passage card's heading is a group label, so the passage's title belongs beneath it.

  **What hosts should check.** Rendered heading structure changes with no configuration:

  - Screen-reader output has one fewer heading per item, and real nesting inside passages.
  - Passage titles move from `h2` to `h3`, and new heading elements appear inside passage and prompt content. CSS selecting `h2` inside a passage will stop matching; selectors keyed on `[data-heading]` are unaffected, because the element preserves that attribute through the promotion.
  - A host that furnishes no question headings of its own, and therefore wants the element to keep furnishing them, overrides per player: `runtime.player.includeSrHeading = true`. Host values in `runtime.player` continue to win over the published defaults.

  The pattern this follows — a fact only the container knows, published for whichever descendant needs it, with a resolution order, a graceful default and a change signal — is written up in `docs/architecture/composition-context.md`, along with the two places in this repo where a missing change signal made resolvers pin the first value they saw.

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

- 13cfc61: `splitPaneMinRegionWidth` now bounds the region, not the grid track it sits in.

  Each pane spends `0.5rem` on each side as margin rather than padding, so the
  gutter sits outside its scroll box. The bound was computed against the track, so
  a host asking for 280px to keep a passage legible got a 280px track holding a
  264px region, and the shortfall grows with the gutter. The gutter is now measured off the pane and added to the track
  the percentage has to reach, so the region is the width that was asked for.

  Hosts setting this get a slightly wider minimum than before, which is the width
  they configured. A host that tuned the value against the old behaviour and wants
  the previous geometry should reduce it by the pane gutter (16px by default).

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
  - @pie-players/pie-item-player@0.3.65
  - @pie-players/pie-players-shared@0.3.65
  - @pie-players/pie-default-tool-loaders@0.3.65
  - @pie-players/pie-context@0.3.65

## 0.3.64

### Patch Changes

- acee584: `onCatalogsChange` on the catalog resolver and the toolkit coordinator, replacing a timed retry in the item card's signing region.

  A reader that _renders_ a catalog card has to answer "is there content for this item" before the catalogs exist: registration is driven by an item shell's mount event, which lands after a card rendered alongside that item has already computed its first answer. TTS never hit this because it resolves by DOM lookup at the moment it speaks. The signing region did, and it compensated with a bounded retry — 20 attempts, 50 ms apart — after which it stopped for good. No budget is right for that: a second is too short when element bundles load slowly, and running out of it left an eligible learner with no signing video and nothing logged. An accommodation that fails this way is invisible to everyone except the person who needed it.

  `AccessibilityCatalogResolver.onCatalogsChange(listener)` now reports registrations and removals, with `ToolkitCoordinator.onCatalogsChange` delegating to it exactly as `onPolicyChange` delegates to the policy engine. The event names what changed (`scoped-registered`, `scoped-removed`, `item-added`, `item-cleared`) and carries the owner context for the scoped reasons, but no resolved cards: listeners re-query with their own lookup context, which keeps the resolver free of assumptions about who is reading. It fires after the mutation, so re-querying from a listener sees the new state. Subscriber errors are swallowed and dispatch iterates a copy of the listener set, so one bad listener can neither break registration nor cause its neighbours to be skipped.

  `SectionItemCard` holds the resolved alternate in state and rewrites it from that stream **only when the resolved value actually changes**, rather than bumping a version counter a `$derived` reads. The counter is the pattern this file already uses for `onPolicyChange`, and for policy it is fine, but for catalogs it closes a feedback loop. Re-rendering the card re-applies the `item` prop on `<pie-item-shell>`, whose registration effect re-runs and re-registers the item's catalogs, which makes the resolver emit again. One unconditional write per emission is enough to make that cycle self-sustaining: measured 1000 register/unregister rounds per item before Svelte aborted the update at its depth limit — and an aborted update leaves the DOM half-applied, so the media region mounted while the container it lives in never got its side-by-side layout. It was not confined to signing either; any page with the toolkit hit it, including TTS demos with no signing content, because every card subscribes.

  Comparing before writing breaks the cycle at the only point where neither side has to know about the other: a re-registration that changes nothing resolves to the same value and stops there. The comparison is structural, because each resolution builds a fresh object and identity would report a change every time.

  `onCatalogsChange` is required on the coordinator interface rather than optional. It ships with its only consumer, so there are no pre-existing host stubs to stay assignable to, and `AGENTS.md` rules out internal-API compatibility shims without a documented exception.

  Any future region rendering a catalog card — a transcript region, braille, simplified language — subscribes instead of adding a second retry loop, and should guard its writes the same way for the same reason.

  Still latent underneath: `<pie-item-shell>` re-dispatches registration whenever its `item` prop is re-applied, even when the value is unchanged, so any future source of card re-renders will re-register catalogs and re-attach session listeners. Harmless now that nothing feeds it in a cycle, and worth a guard on the shell's side independently.

- c811bf2: `<pie-item-shell>` and `<pie-passage-shell>` now dispatch `pie-register` only when the registration's own values change, and `pie-unregister` only on teardown.

  Both shells dispatched registration from the effect that attached their listeners, with `pie-unregister` in that effect's cleanup — so every re-run announced a teardown and a rebuild of state that had not moved. The runtime takes those announcements literally: a `pie-register` unregisters and re-registers the content's accessibility catalogs, re-runs `sectionEngine.register`, and re-notifies the section controller. Between the unregister and the register, content the learner is looking at has no catalogs at all.

  It was also the far half of a cycle. Any reader that re-renders in response to a catalog change re-applies a shell's props, which re-registers, which changes catalogs again. That shipped once and was measured at roughly a thousand rounds per item, ending in Svelte abandoning the update at its depth limit with the DOM half-applied — and every assertion about the rendered output passed while it was happening, because the elements were present; only the classes and grid columns the aborted update never reached were wrong. The reader was fixed on its own side; this is the half that stops the next one from re-opening the circuit.

  Listener attachment now depends on `host` alone, which in the item shell is also what makes the session dedupe state outlive a prop change instead of being rebuilt — and forgetting what it had already forwarded — on each one. The dispatch decision moved to `createShellRegistrationDispatcher` in `components/shared/shell-registration.ts`, shared by both shells: it compares `kind`, `host`, `itemId`, `canonicalItemId`, `contentKind` and `item` against what was last dispatched, `item` by identity, because the churn being guarded against re-applies the same object while a genuinely new item object means content whose catalogs may differ. No unregister precedes that re-register: both registration paths in the toolkit are keyed by element and replace what is there, so the unregister only ever created the gap.

  Teardown replays the identity it registered under rather than reading the current props, since by then the props may already describe the replacement.

  `packages/section-player/tests/section-player-item-shell-registration.spec.ts` counts the events per content id and kind on demo pages: one register per mounted shell, zero unregisters while mounted, and replaced content that re-registers without an unregister in between.

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

- 0dcec2e: Remove `SignLanguageExtractor`. A signed alternate is a catalog card, authored or imported, never lifted out of item markup at render time.

  The extractor mirrored `SSMLExtractor` for signing: it found `[data-sign-language]` video regions in an item's markup, prompts and choice labels, turned each into a `sign-language` card, removed the video from the visible content and docked the card via `data-catalog-idref`. Section-player ran it on every item card mount.

  Nothing produced that inline form. The Learnosity transform in `pie-api-aws` writes `accessibilityCatalogs` directly, and signing is new enough in PIE that no legacy content carries a video inline — the attribute's only producer was this repo's own demo. The symmetry with `SSMLExtractor` was the whole case for it, and it does not hold: inline `<speak>` is real authored content PIE does not control.

  It also failed in the wrong direction. Extraction needed `DOMParser`, so under SSR it no-opped, and a parse error took the same path — in both cases the `<video>` stayed in the visible prompt and rendered to every learner, granted the accommodation or not. A card cannot leak that way, because it was never in the content. Its synthesized catalog ids were positional (`auto-sign-prompt-q1-0`), so inserting a signing region renumbered the reference docking another one.

  Breaking for anyone importing `SignLanguageExtractor`, `SIGN_LANGUAGE_ATTRIBUTE` or `SignLanguageExtractionResult` from `@pie-players/pie-assessment-toolkit`, and for `prepareSignLanguageItem` from section-player's shared components: author the card on `accessibilityCatalogs` instead, at item or model level. Resolution, gating and rendering are unchanged — `collectSignLanguageCatalogRefs` reads the same three places catalogs hang off an entity as it always did. `SSMLExtractor` is untouched.

- Updated dependencies [82118ce]
- Updated dependencies [9b2f37d]
- Updated dependencies [acee584]
- Updated dependencies [9b2f37d]
- Updated dependencies [5749bc1]
- Updated dependencies [bb1a90b]
- Updated dependencies [82edb28]
- Updated dependencies [a5241b9]
- Updated dependencies [0dcec2e]
- Updated dependencies [acee584]
- Updated dependencies [b3acac4]
- Updated dependencies [25511d7]
- Updated dependencies [bbcabc0]
- Updated dependencies [30baec4]
  - @pie-players/pie-assessment-toolkit@0.3.64
  - @pie-players/pie-players-shared@0.3.64
  - @pie-players/pie-item-player@0.3.64
  - @pie-players/pie-default-tool-loaders@0.3.64
  - @pie-players/pie-context@0.3.64

## 0.3.63

### Patch Changes

- @pie-players/pie-default-tool-loaders@0.3.63
- @pie-players/pie-assessment-toolkit@0.3.63
- @pie-players/pie-context@0.3.63
- @pie-players/pie-item-player@0.3.63
- @pie-players/pie-players-shared@0.3.63

## 0.3.62

### Patch Changes

- a1edde5: Minify and code-split the assessment toolkit custom-element bundles. The three CE artifacts are now produced by a single bundler invocation that shares code through `dist/components/chunks/`, so the Svelte runtime, services layer, and policy engine are no longer duplicated per artifact, and `SectionToolBar` no longer inlines a second copy of `ItemToolBar`. Splitting also restores the lazy `speech-rule-engine` boundary that `math-speech.ts` already asked for: it moves to a chunk fetched only when math speech runs, instead of being flattened into the eager bundle. Eager CE bytes drop from 1,993 KB to 346 KB, and the section player's main bundle drops from roughly 2.6 MB to 1.4 MB. Entry filenames, the `exports` map, and per-entrypoint custom-element registration side effects are unchanged.
- 3b4e461: Keep every runtime dependency external in the assessment toolkit's custom-element build, and stop publishing sourcemaps.

  Inlining a dependency into a prebuilt custom-element chunk creates a copy a consumer's bundler cannot deduplicate, because its module id is the chunk file rather than the dependency's path in `node_modules`. `speech-rule-engine` was reaching the section player twice for exactly that reason — once through `services/tts/math-speech.js` and once inside the prebuilt chunk — about 1.3 MB of duplicate payload. Externalizing the manifest's dependencies collapses that to one copy. It asks nothing new of consumers: these artifacts already emitted bare `@pie-players/*` specifiers, so they always required a bundler or an import map.

  Publishable packages ship only `dist`, so a usable sourcemap also required `inlineSources`, which embedded every TypeScript source into the tarball. That cost roughly 2.5 MB across the tsc-built packages while every Vite-built package in the repo already shipped none. Sourcemaps are now off everywhere.

- Updated dependencies [c73c995]
- Updated dependencies [507b56f]
- Updated dependencies [14666b3]
- Updated dependencies [001486e]
- Updated dependencies [6a18f3c]
- Updated dependencies [a1edde5]
- Updated dependencies [7864f66]
- Updated dependencies [3b4e461]
- Updated dependencies [7605500]
  - @pie-players/pie-assessment-toolkit@0.3.62
  - @pie-players/pie-players-shared@0.3.62
  - @pie-players/pie-item-player@0.3.62
  - @pie-players/pie-default-tool-loaders@0.3.62
  - @pie-players/pie-context@0.3.62

## 0.3.61

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.61
- @pie-players/pie-context@0.3.61
- @pie-players/pie-default-tool-loaders@0.3.61
- @pie-players/pie-item-player@0.3.61
- @pie-players/pie-players-shared@0.3.61

## 0.3.60

### Patch Changes

- 6a18740: Fall back to the theme-aware `--pie-background-dark` token for split-pane passage and item pane backgrounds so the panes follow dark themes and color schemes when the host passage-player does not set `--pie-passage-header-background`.
  - @pie-players/pie-assessment-toolkit@0.3.60
  - @pie-players/pie-context@0.3.60
  - @pie-players/pie-default-tool-loaders@0.3.60
  - @pie-players/pie-item-player@0.3.60
  - @pie-players/pie-players-shared@0.3.60

## 0.3.59

### Patch Changes

- Add an opt-in `nds-icons` flag so hosts can render the vendored `<nds-icon-button>` per environment. Enable it with the `nds-icons` attribute on a section-player element (`<pie-section-player-splitpane nds-icons={true}>`, and likewise on `-vertical`, `-tabbed`, and `-base`) or via `runtime.ndsIcons: true`. When on, the toolbar tool buttons, the calculator shell controls, the inline-TTS play/pause trigger, and the section scroll-hint render as NDS icon buttons; the flag flows through the toolkit runtime context. It defaults to off, so unless a host explicitly opts in these controls render as plain `<button>`s.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.59
  - @pie-players/pie-default-tool-loaders@0.3.59
  - @pie-players/pie-context@0.3.59
  - @pie-players/pie-item-player@0.3.59
  - @pie-players/pie-players-shared@0.3.59

## 0.3.58

### Patch Changes

- 8df52bf: Add an opt-in allow-list for executable element packages. The default policy mode requires exact versions without build metadata so legacy IIFE bundle separators cannot be injected. Existing hosts that omit the policy retain their current loading behavior.
- Updated dependencies [8df52bf]
- Updated dependencies [d5cc905]
  - @pie-players/pie-players-shared@0.3.58
  - @pie-players/pie-item-player@0.3.58
  - @pie-players/pie-assessment-toolkit@0.3.58
  - @pie-players/pie-default-tool-loaders@0.3.58
  - @pie-players/pie-context@0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.57
  - @pie-players/pie-context@0.3.57
  - @pie-players/pie-default-tool-loaders@0.3.57
  - @pie-players/pie-item-player@0.3.57
  - @pie-players/pie-players-shared@0.3.57

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.56
  - @pie-players/pie-context@0.3.56
  - @pie-players/pie-default-tool-loaders@0.3.56
  - @pie-players/pie-item-player@0.3.56
  - @pie-players/pie-players-shared@0.3.56

## 0.3.55

### Patch Changes

- Updated dependencies [7f45877]
  - @pie-players/pie-players-shared@0.3.55
  - @pie-players/pie-item-player@0.3.55
  - @pie-players/pie-assessment-toolkit@0.3.55
  - @pie-players/pie-default-tool-loaders@0.3.55
  - @pie-players/pie-context@0.3.55

## 0.3.54

### Patch Changes

- f44aa3b: Add a section-player runtime backend resolver so hosts can configure item-player delivery backends once and have embedded items receive concrete per-item backend identities.
- 1748ed5: Add namespaced backend delivery and authoring support, including server-backed model refresh, authoring load/save/release and media hooks, and indirect section/assessment runtime configuration for item backends.
- Updated dependencies [1748ed5]
- Updated dependencies [bead424]
  - @pie-players/pie-item-player@0.3.54
  - @pie-players/pie-assessment-toolkit@0.3.54
  - @pie-players/pie-default-tool-loaders@0.3.54
  - @pie-players/pie-context@0.3.54
  - @pie-players/pie-players-shared@0.3.54

## 0.3.53

### Patch Changes

- ee6c081: Add the initial PIE theme token registry contract, source-usage gate, theme parity checks, compatibility fallback chains, and broad theming accessibility planning artifacts for safer host theme overrides.
  - @pie-players/pie-item-player@0.3.53
  - @pie-players/pie-default-tool-loaders@0.3.53
  - @pie-players/pie-assessment-toolkit@0.3.53
  - @pie-players/pie-context@0.3.53
  - @pie-players/pie-players-shared@0.3.53

## 0.3.52

### Patch Changes

- 905080d: Add a runtime TTS highlight target resolver so hosts can remap spoken ranges to visible highlight targets while PIE Players keeps default identity highlighting, painting, and cleanup.
- 017f5a9: Treat identity-only PIE element session echoes as metadata-only updates so restored sessions do not emit learner response data changes, while preserving explicit response clears and derived session state updates.
- c2ac471: Default section-player passage and question card title color to the themed `--pie-text` variable (with `--pie-header-text` still an opt-in host override) so card titles stay legible across DaisyUI dark and high-contrast themes instead of being stuck at a hardcoded near-black.
- Updated dependencies [905080d]
- Updated dependencies [017f5a9]
  - @pie-players/pie-assessment-toolkit@0.3.52
  - @pie-players/pie-players-shared@0.3.52
  - @pie-players/pie-default-tool-loaders@0.3.52
  - @pie-players/pie-item-player@0.3.52
  - @pie-players/pie-context@0.3.52

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.51
  - @pie-players/pie-context@0.3.51
  - @pie-players/pie-default-tool-loaders@0.3.51
  - @pie-players/pie-item-player@0.3.51
  - @pie-players/pie-players-shared@0.3.51

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.50
  - @pie-players/pie-context@0.3.50
  - @pie-players/pie-default-tool-loaders@0.3.50
  - @pie-players/pie-item-player@0.3.50
  - @pie-players/pie-players-shared@0.3.50

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.49
  - @pie-players/pie-context@0.3.49
  - @pie-players/pie-item-player@0.3.49
  - @pie-players/pie-players-shared@0.3.49
  - @pie-players/pie-tool-annotation-toolbar@0.3.49
  - @pie-players/pie-tool-calculator-desmos@0.3.49
  - @pie-players/pie-tool-text-to-speech@0.3.49
  - @pie-players/pie-tool-tts-inline@0.3.49

## 0.3.48

### Patch Changes

- 3a95675: Remove the separate `@pie-players/pie-toolbars` facade package. Section player now imports toolbar custom-element registration entrypoints directly from `@pie-players/pie-assessment-toolkit/components/item-toolbar-element` and `@pie-players/pie-assessment-toolkit/components/section-toolbar-element`.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0c20d0f]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.48
  - @pie-players/pie-item-player@0.3.48
  - @pie-players/pie-assessment-toolkit@0.3.48
  - @pie-players/pie-context@0.3.48
  - @pie-players/pie-tool-annotation-toolbar@0.3.48
  - @pie-players/pie-tool-calculator-desmos@0.3.48
  - @pie-players/pie-tool-text-to-speech@0.3.48
  - @pie-players/pie-tool-tts-inline@0.3.48

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.47
  - @pie-players/pie-context@0.3.47
  - @pie-players/pie-item-player@0.3.47
  - @pie-players/pie-players-shared@0.3.47
  - @pie-players/pie-tool-annotation-toolbar@0.3.47
  - @pie-players/pie-tool-calculator-desmos@0.3.47
  - @pie-players/pie-tool-text-to-speech@0.3.47
  - @pie-players/pie-tool-tts-inline@0.3.47
  - @pie-players/pie-toolbars@0.3.47

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.46
  - @pie-players/pie-context@0.3.46
  - @pie-players/pie-item-player@0.3.46
  - @pie-players/pie-players-shared@0.3.46
  - @pie-players/pie-tool-annotation-toolbar@0.3.46
  - @pie-players/pie-tool-calculator-desmos@0.3.46
  - @pie-players/pie-tool-text-to-speech@0.3.46
  - @pie-players/pie-tool-tts-inline@0.3.46
  - @pie-players/pie-toolbars@0.3.46

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
- Updated dependencies [fd140a3]
  - @pie-players/pie-assessment-toolkit@0.3.45
  - @pie-players/pie-context@0.3.45
  - @pie-players/pie-item-player@0.3.45
  - @pie-players/pie-players-shared@0.3.45
  - @pie-players/pie-tool-annotation-toolbar@0.3.45
  - @pie-players/pie-tool-calculator-desmos@0.3.45
  - @pie-players/pie-tool-text-to-speech@0.3.45
  - @pie-players/pie-tool-tts-inline@0.3.45
  - @pie-players/pie-toolbars@0.3.45

## 0.3.44

### Patch Changes

- Lockstep release covering develop since 0.3.42:

  - PIE-548: Integrate `<nds-icon-button>` for the calculator icon in `ItemToolBar`.
  - PIE-565: Add `splitPaneInitialPassageWidth` prop to section-player layout components (split-pane / tabbed / vertical).
  - PIE-553: Section-demos keyboard-navigation demo page; align `partLabels` default with KC.
  - Test stability: audit and wire package test coverage; stabilize item-source-editor and section TTS e2e flows; keep item-player test mocks in sync.

  Note: 0.3.43 was published manually from feat/PIE-546 without merging back to develop. This release re-issues the develop branch onto npm at 0.3.44 and brings local manifests back in sync with the published lockstep version.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.44
  - @pie-players/pie-context@0.3.44
  - @pie-players/pie-item-player@0.3.44
  - @pie-players/pie-players-shared@0.3.44
  - @pie-players/pie-tool-annotation-toolbar@0.3.44
  - @pie-players/pie-tool-calculator-desmos@0.3.44
  - @pie-players/pie-tool-text-to-speech@0.3.44
  - @pie-players/pie-tool-tts-inline@0.3.44
  - @pie-players/pie-toolbars@0.3.44

## 0.3.42

### Patch Changes

- 6496dda: Add host tool context resolvers so integrations can attach per-item render params, such as calculator type, after policy and PNP gates but without overriding packaged tool registrations.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [6496dda]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.42
  - @pie-players/pie-context@0.3.42
  - @pie-players/pie-item-player@0.3.42
  - @pie-players/pie-players-shared@0.3.42
  - @pie-players/pie-tool-annotation-toolbar@0.3.42
  - @pie-players/pie-tool-calculator-desmos@0.3.42
  - @pie-players/pie-tool-text-to-speech@0.3.42
  - @pie-players/pie-tool-tts-inline@0.3.42
  - @pie-players/pie-toolbars@0.3.42

## 0.3.41

### Patch Changes

- Apply the section-player focus ring consistently to passage content and the split-pane divider without restoring player-owned focus placement behavior.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.41
  - @pie-players/pie-context@0.3.41
  - @pie-players/pie-item-player@0.3.41
  - @pie-players/pie-players-shared@0.3.41
  - @pie-players/pie-tool-annotation-toolbar@0.3.41
  - @pie-players/pie-tool-calculator-desmos@0.3.41
  - @pie-players/pie-tool-text-to-speech@0.3.41
  - @pie-players/pie-tool-tts-inline@0.3.41
  - @pie-players/pie-toolbars@0.3.41

## 0.3.40

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [3a167a8]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.40
  - @pie-players/pie-assessment-toolkit@0.3.40
  - @pie-players/pie-context@0.3.40
  - @pie-players/pie-item-player@0.3.40
  - @pie-players/pie-tool-annotation-toolbar@0.3.40
  - @pie-players/pie-tool-calculator-desmos@0.3.40
  - @pie-players/pie-tool-text-to-speech@0.3.40
  - @pie-players/pie-tool-tts-inline@0.3.40
  - @pie-players/pie-toolbars@0.3.40

## 0.3.39

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0072fad]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.39
  - @pie-players/pie-players-shared@0.3.39
  - @pie-players/pie-context@0.3.39
  - @pie-players/pie-item-player@0.3.39
  - @pie-players/pie-tool-annotation-toolbar@0.3.39
  - @pie-players/pie-tool-calculator-desmos@0.3.39
  - @pie-players/pie-tool-text-to-speech@0.3.39
  - @pie-players/pie-tool-tts-inline@0.3.39
  - @pie-players/pie-toolbars@0.3.39

## 0.3.38

### Patch Changes

- ef29724: Rename generic QTI policy APIs and diagnostics to PNP/profile terminology, including the built-in policy source, default enforcement helpers, provenance tags, and required-tool diagnostics.

  Enhance the editable PNP debugger and section demos so hosts can exercise all available tools and PNP/profile enforcement behavior end-to-end.

- c8d46d7: Remove PIE-owned focus-placement APIs and automatic section navigation focus movement.

  This is a breaking cleanup for pre-1.0 hosts: `pie-item-player.focusFirst()`, section-player layout `focusStart()`, `SectionPlayerFocusPolicy.autoFocus`, `DEFAULT_FOCUS_POLICY`, and `resolveAutoFocusStrategy` are no longer exported. The shared `queryFirstFocusableDeep()` and `focusFirstFocusableInElement()` helpers were also removed; `FOCUSABLE_SELECTOR` and `isProgrammaticFocusTarget()` remain for focus-trap internals.

  Hosts should own skip links, landmarks, and page-level focus placement while section player preserves natural tab order into actionable controls.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [f856362]
- Updated dependencies [ef29724]
- Updated dependencies [c8d46d7]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.38
  - @pie-players/pie-assessment-toolkit@0.3.38
  - @pie-players/pie-item-player@0.3.38
  - @pie-players/pie-context@0.3.38
  - @pie-players/pie-tool-annotation-toolbar@0.3.38
  - @pie-players/pie-tool-calculator-desmos@0.3.38
  - @pie-players/pie-tool-text-to-speech@0.3.38
  - @pie-players/pie-tool-tts-inline@0.3.38
  - @pie-players/pie-toolbars@0.3.38

## 0.3.37

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [2818f93]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.37
  - @pie-players/pie-context@0.3.37
  - @pie-players/pie-item-player@0.3.37
  - @pie-players/pie-players-shared@0.3.37
  - @pie-players/pie-tool-annotation-toolbar@0.3.37
  - @pie-players/pie-tool-calculator-desmos@0.3.37
  - @pie-players/pie-tool-text-to-speech@0.3.37
  - @pie-players/pie-tool-tts-inline@0.3.37
  - @pie-players/pie-toolbars@0.3.37

## 0.3.36

### Patch Changes

- 9ef211c: PIE-512 Phase D cleanup: drop prior `sectionId` / `attemptId` args from internal subscribe call sites; sharpen the migration narrative for typed integrations.

  This is a follow-up to `0.3.35` — same active-cohort contract, no functional behavior change. It cleans up internal code that was still passing the now-ignored args, and adds an explicit migration recipe for typed integrators.

  ### BREAKING CHANGE (re-stated from `0.3.35` for clarity)

  `coordinator.subscribeSectionEvents` / `subscribeItemEvents` / `subscribeSectionLifecycleEvents` no longer accept `sectionId` / `attemptId` arguments at the type level. The runtime silently ignores any extra unknown properties, so untyped or loosely-typed call sites continue to work, but **typed integrations that import `SectionEventSubscriptionArgs`, `SectionItemEventSubscriptionArgs`, or `SectionScopedEventSubscriptionArgs` directly and pass `sectionId` / `attemptId` will fail to compile against `>=0.3.35`.**

  #### What this changes for typed integrations

  | Before (`<0.3.35`)                                                                            | After (`>=0.3.35`)                                                                                                       |
  | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
  | `subscribeItemEvents({ sectionId, attemptId, listener })`                                     | `subscribeItemEvents({ listener })`                                                                                      |
  | Listener bound to one controller; manual re-subscribe needed on cohort change                 | Listener follows the active cohort automatically; single subscribe survives navigation                                   |
  | `subscribe*` was a no-op when called with an unknown `sectionId`                              | `subscribe*` throws if **no** active cohort exists; call it after the first `getOrCreateSectionController(...)` resolves |
  | Subscribing the same listener function with different filter args added a second subscription | Subscribing the same listener function replaces the prior subscription (filter args from the second call win)            |
  | Listener throws bubbled up to the dispatcher and could break fan-out                          | Listener throws are caught and `console.warn`-logged; fan-out to other listeners continues                               |

  #### Action required

  - **Drop** `sectionId` / `attemptId` from every `subscribeSectionEvents`, `subscribeItemEvents`, `subscribeSectionLifecycleEvents` call site. The args have no runtime effect under `>=0.3.35`.
  - **Move the subscribe call** to _after_ the first `getOrCreateSectionController(...)` resolves (rather than synchronously on `toolkit-ready`).
  - **Remove any re-subscribe-on-navigation logic.** A single subscribe call after the first controller-resolve is sufficient — the listener migrates automatically and gets a snapshot replay (`content-loaded` × N then `section-loading-complete`) on every cohort transition. **This is the most common breakage pattern**: hosts that previously detached and re-subscribed on every `toolkit-ready` (correct under the pre-Phase D pinned-subscription contract) will now observe **double snapshot replays** on every section navigation — once via Phase D auto-migration, then again from the manual re-subscribe. Listener handlers that are not strictly idempotent will fire twice (e.g. analytics `pageAction`s, increment counters that aren't Set-deduplicated, side-effecting hydration calls).
  - **For intentionally-pinned subscriptions to a non-active section** (e.g. a host UI that wants to keep watching section A while displaying B), use `coordinator.getSectionController({ sectionId, attemptId })` and subscribe directly on the controller handle via `controller.subscribe?.(...)`. That binding is pinned to one controller instance and does not migrate.
  - **Hand-rolled local structural types** that duplicate the public arg shape: drop the `sectionId` / `attemptId` properties from the local type so the local declaration matches the public contract. Otherwise the local type is misleadingly-wrong dead code at runtime.

  #### Concrete simplification example

  If your wrapper used the pre-Phase D detach-and-re-subscribe pattern on every `toolkit-ready` event:

  ```typescript
  public handleToolkitReady(event: Event): void {
    const coordinator = (event as CustomEvent).detail?.coordinator;
    if (!coordinator) return;

    // Pre-Phase D: rebind for the new section.
    this.controllerUnsubscribe?.();
    const itemUnsub = coordinator.subscribeItemEvents({
      sectionId: this.sectionId, // pinned to currently-displayed section
      listener: handleItemEvent,
    });
    const sectionUnsub = coordinator.subscribeSectionLifecycleEvents({
      sectionId: this.sectionId,
      listener: handleSectionEvent,
    });
    this.controllerUnsubscribe = () => { itemUnsub?.(); sectionUnsub?.(); };
  }
  ```

  …simplify to subscribe **once** and let Phase D follow the active cohort:

  ```typescript
  public handleToolkitReady(event: Event): void {
    const coordinator = (event as CustomEvent).detail?.coordinator;
    if (!coordinator) return;
    this.toolkitCoordinator = coordinator;

    // Phase D: subscribe once; the listener follows the active cohort
    // across all subsequent navigation. Bail if already subscribed.
    if (this.controllerUnsubscribe) return;

    const itemUnsub = coordinator.subscribeItemEvents({
      listener: handleItemEvent,
    });
    const sectionUnsub = coordinator.subscribeSectionLifecycleEvents({
      listener: handleSectionEvent,
    });
    this.controllerUnsubscribe = () => { itemUnsub?.(); sectionUnsub?.(); };
  }
  ```

  The full migration recipe with before/after code samples is in `packages/assessment-toolkit/README.md` under "Migrating from `<0.3.35`".

  ### Internal cleanup

  Drops `sectionId` / `attemptId` from:

  - `packages/section-player-tools-event-debugger/EventPanel.svelte` — local `ToolkitCoordinatorLike` structural type and the two coordinator subscribe call sites.
  - `packages/section-player-tools-session-debugger/SectionSessionPanel.svelte` — same shape.
  - `packages/section-player/tests/section-player-pie-512-cross-section-events.spec.ts` — the `EventPanelHandle` type and the in-page subscribe call sites.

  These were dead-args at runtime under Phase D — the runtime ignores them, but their presence was misleading: the local types claimed args that the public API no longer accepts, and any future maintainer copy-pasting from those panels would write code that's TS-broken against the public types. No test or behavior change; the cleanup is purely contract-shape hygiene.

  Also fixes a single overlooked `sectionId,` arg in `docs/section-player/client-architecture-tutorial.md` (post-0.3.35 doc-sweep straggler) and adds explicit migration notes to `packages/assessment-toolkit/README.md` and `packages/section-player/README.md`.

  ### Coverage

  No new tests — this is a code-shape cleanup of internal call sites. Coverage for the Phase D contract itself is in:

  - `packages/assessment-toolkit/tests/pie-512-phase-d-active-cohort-tracking.test.ts` (12 cases)
  - `packages/assessment-toolkit/tests/runtime/adapter/coordinator-bridge-cohort-handoff.test.ts` (3 cases)
  - `packages/assessment-toolkit/tests/pie-512-cross-section-event-delivery.test.ts` (3 cases)
  - `packages/section-player/tests/section-player-pie-512-cross-section-events.spec.ts` (Playwright e2e, narrow-viewport A→B→A traversal)

  All pass with the cleanup applied.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [9ef211c]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.36
  - @pie-players/pie-context@0.3.36
  - @pie-players/pie-item-player@0.3.36
  - @pie-players/pie-players-shared@0.3.36
  - @pie-players/pie-tool-annotation-toolbar@0.3.36
  - @pie-players/pie-tool-calculator-desmos@0.3.36
  - @pie-players/pie-tool-text-to-speech@0.3.36
  - @pie-players/pie-tool-tts-inline@0.3.36
  - @pie-players/pie-toolbars@0.3.36

## 0.3.35

### Patch Changes

- 286418e: fix(PIE-512): make `subscribeSectionEvents` follow the active section cohort across navigation (Phase D)

  Phase B/C addressed engine-side replay and same-section `updateInput` regressions but
  left a final residual flake: `coordinator.subscribeItemEvents` and
  `coordinator.subscribeSectionLifecycleEvents` bound a listener to the section
  controller that was active **at subscribe time**. A host that subscribes once
  on `toolkit-ready` and then navigates between sections — without re-subscribing
  — stayed pinned to the original controller and silently missed `content-loaded`
  / `section-loading-complete` events from the new cohort. Demos that remounted
  the layout custom element on navigation (via `{#key}` or equivalent) avoided
  the bug; a host that keeps the element persistent (the supported pattern) hit
  it on every cross-section navigation.

  ### What changes

  - `subscribeSectionEvents`, `subscribeItemEvents`, and
    `subscribeSectionLifecycleEvents` now bind to the toolkit's _active section
    cohort_ and automatically migrate across cohort transitions. On every
    migration the listener is detached from the old controller, attached to the
    new one, and replayed the new cohort's snapshot (`content-loaded` × N in
    registration order, then `section-loading-complete` if applicable) — the
    same ordering a fresh subscriber would have observed.
  - `subscribeSectionEvents` now throws when no active cohort exists; host code
    must call `getOrCreateSectionController(...)` at least once before
    subscribing. (`toolkit-ready` alone is not sufficient.) The typical
    pattern is a single subscribe right after the first
    `getOrCreateSectionController(...)` resolves — that subscription then
    follows all subsequent navigation without further wiring.
  - Subscribing the same listener function twice replaces the prior
    subscription (filter args from the second call win); the dedup key is
    listener identity alone, no per-section key.
  - A listener that throws is caught and `console.warn`-logged; the throw does
    not interrupt fan-out to other listeners (matches the
    `FrameworkErrorBus` isolation pattern).
  - `SectionEventSubscriptionArgs`, `SectionItemEventSubscriptionArgs`, and
    `SectionScopedEventSubscriptionArgs` no longer declare `sectionId?` /
    `attemptId?` properties. **Type-level breaking change** for consumers
    importing these types directly. Runtime tolerates extra unknown
    properties, so existing call sites that still pass `sectionId` /
    `attemptId` continue to run unchanged — the args are simply ignored
    and the subscription follows the active cohort.
  - `getSectionController({ sectionId, attemptId })` is **unchanged**; it is
    still keyed by id and remains the right call when reading state from
    inactive (persisted) sections.

  ### Why this is expected to be the final pass on PIE-512

  - Removes the only remaining subscribe-time staleness path. No new corner-case
    branches, no timing dependency, no flag — single canonical contract.
  - Coordinator-side dead code (`resolveSectionSubscriptionEntry`,
    `resolveSectionControllerForSubscription`,
    `detachSectionEventSubscriptionsForMapKey`, the listener-id /
    composite-key bookkeeping) is deleted; the active-cohort registry
    collapses subscription state to one Map keyed by listener identity.

  ### Coverage

  - `packages/assessment-toolkit/tests/pie-512-phase-d-active-cohort-tracking.test.ts`
    (new) — 12 coordinator-only synthetic-harness tests covering active-cohort
    binding, migration with replay, replay ordering, the no-active-cohort
    throw, listener throw isolation, snapshot-safe unsubscribe during
    fan-out, same-cohort `updateInput` no-op, re-entrant subscribe during
    migration replay, and contract tolerance of prior `sectionId` args.
  - `packages/assessment-toolkit/tests/runtime/adapter/coordinator-bridge-cohort-handoff.test.ts`
    (new) — bridge + real-`ToolkitCoordinator` integration test mirroring
    Darin's persistent-host wrapper pattern: `resolveSectionController(A) →
resolveSectionController(B)` migrates a coordinator-bound listener with
    replay, `bridge.dispose()` detaches, and stale token rollovers do not
    dispatch a duplicate `section-controller-resolved` core input.
  - `packages/assessment-toolkit/tests/pie-512-cross-section-event-delivery.test.ts`
    — pre-existing PIE-512 regression pins, with `sectionId` arg dropped to
    match the Phase D shape; the three tests still pin live delivery on
    cohort flips, A→B→A round-trips, and asymmetric multi-item replays.
  - `packages/assessment-toolkit/tests/toolkit-coordinator-section-events.test.ts`
    — cleanup pass: rewrote "replaces existing subscription" to pin
    listener-identity dedup, deleted "ambiguous without attempt id"
    (no longer reachable), dropped `sectionId` args from all subscribes.

  ### Pre-fix failure gate

  Before any production code changed, the new + edited tests were run against
  the pre-fix source: 10 of 17 targeted tests failed in the expected ways
  (ambiguous-section throws, missed migrations, no throw isolation, missing
  contract tolerance, missing bridge replay). The 7 that passed against
  pre-fix source pin orthogonal invariants (single-cohort replay ordering,
  dispose-detach, snapshot-safe iteration). All 27 pass against the Phase D
  implementation.

  ### Migration notes for type consumers

  If your code imports `SectionEventSubscriptionArgs`,
  `SectionItemEventSubscriptionArgs`, or `SectionScopedEventSubscriptionArgs`
  directly, drop the `sectionId?` / `attemptId?` properties from your call
  sites — the runtime ignores them. Hosts using local hand-rolled structural
  types (e.g. an Angular wrapper) need no changes at compile time and pick
  up the runtime fix automatically.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [286418e]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.35
  - @pie-players/pie-context@0.3.35
  - @pie-players/pie-item-player@0.3.35
  - @pie-players/pie-players-shared@0.3.35
  - @pie-players/pie-tool-annotation-toolbar@0.3.35
  - @pie-players/pie-tool-calculator-desmos@0.3.35
  - @pie-players/pie-tool-text-to-speech@0.3.35
  - @pie-players/pie-tool-tts-inline@0.3.35
  - @pie-players/pie-toolbars@0.3.35

## 0.3.34

### Patch Changes

- af850c0: fix(PIE-512): preserve controller lifecycle on same-section updateInput and always replay registry into resolved controller (Phase C)

  Phase B (released as `0.3.33`) replayed the engine's `RuntimeRegistry` into the
  new cohort's controller when the cohort flip resolved to a fresh controller —
  fixing the persistent-shell case. It left two related gaps that surfaced as
  intermittent regressions in the consumer's narrow-viewport (passage-only)
  flow:

  - `SectionController.initialize` ran `resetLifecycleTracking()` unconditionally,
    so any `updateInput` (which `ToolkitCoordinator.resolveExistingSectionController`
    always invokes when the engine resolves the existing controller) wiped
    `trackedRenderables`, `loadedRenderableKeys`, and `sectionLoadingComplete`.
    A subscriber that attached between the wipe and the next live event saw
    empty `runtimeState.loadedRenderables` and missed `content-loaded` /
    `section-loading-complete` for shells that were already mounted and
    loaded.
  - `SectionRuntimeEngine.initialize` only re-fed the registry into the
    controller when the resolved controller was a NEW instance
    (`resolved !== previousController`). Same-cohort `updateInput` resolves
    to the existing controller, so replay was skipped and the wipe above
    was not undone.

  Phase C closes both gaps:

  - `SectionController.initialize` now only calls `resetLifecycleTracking()`
    when the section identifier actually changes between the previous
    input and the next. Same-section refreshes preserve lifecycle state.
  - `SectionController.handleContentRegistered` and `handleContentLoaded`
    short-circuit on already-tracked / already-loaded renderable keys —
    no duplicate `content-loaded` emit, no spurious re-evaluation of
    `section-loading-complete`, and the engine's replay stays safe to
    run on every `initialize` call.
  - `SectionRuntimeEngine.initialize` drops the
    `resolved !== previousController` gate and unconditionally re-feeds
    the registry into the resolved controller. Combined with the
    controller-side idempotence above, the replay is a true no-op when
    the controller already knows about the registered shells, and a
    recovery seeding when an `updateInput` cohort refresh has wiped
    state.

  Coverage:

  - `packages/section-player/tests/section-controller-pie-512-phase-c.test.ts` —
    five new Bun unit tests pinning the controller-side invariants
    (no wipe on same-section `updateInput`; idempotent register / load;
    late subscriber on same-section `updateInput` observes preserved
    `runtimeState`).
  - `packages/assessment-toolkit/tests/pie-512-persistent-shell-cohort-handoff.test.ts` —
    new same-controller engine integration test covering the
    drop-the-gate change.
  - The existing PIE-512 cross-section A → B → A Playwright spec
    continues to pass unchanged. End-to-end coverage of the
    same-cohort `updateInput` path is intentionally left to the
    engine integration test (under `@happy-dom`) which exercises
    the exact engine→controller seam where the bug lived; a
    Playwright spec that drives a second `engine.initialize`
    imperatively from `page.evaluate` (mirroring the real
    consumer's plain-HTML pattern) is a useful follow-up but is
    not required for this fix.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [af850c0]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.34
  - @pie-players/pie-context@0.3.34
  - @pie-players/pie-item-player@0.3.34
  - @pie-players/pie-players-shared@0.3.34
  - @pie-players/pie-tool-annotation-toolbar@0.3.34
  - @pie-players/pie-tool-calculator-desmos@0.3.34
  - @pie-players/pie-tool-text-to-speech@0.3.34
  - @pie-players/pie-tool-tts-inline@0.3.34
  - @pie-players/pie-toolbars@0.3.34

## 0.3.33

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [70612af]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.33
  - @pie-players/pie-context@0.3.33
  - @pie-players/pie-item-player@0.3.33
  - @pie-players/pie-players-shared@0.3.33
  - @pie-players/pie-tool-annotation-toolbar@0.3.33
  - @pie-players/pie-tool-calculator-desmos@0.3.33
  - @pie-players/pie-tool-text-to-speech@0.3.33
  - @pie-players/pie-tool-tts-inline@0.3.33
  - @pie-players/pie-toolbars@0.3.33

## 0.3.32

### Patch Changes

- 0355143: Fix PIE-512: replay `content-loaded` events for late subscribers after
  cohort transitions.

  `ToolkitCoordinator.subscribeSectionEvents` already replays a single
  `section-loading-complete` event to subscribers that attach after a
  controller finishes loading, but had no equivalent for the per-renderable
  `content-loaded` events that fire earlier in the sequence. Consumers that
  attached their listeners after the section player had bootstrapped (e.g.
  wrapper hosts that subscribe in response to `pie-section-controller-ready`,
  or hosts navigating across asymmetric sections in a narrow split-pane
  layout where the controller is recreated per cohort) silently missed every
  `content-loaded` event for renderables that had already loaded.

  The coordinator now replays one synthesized `content-loaded` event per
  renderable reported as loaded by the controller's runtime state, in
  registration order, immediately before the existing
  `section-loading-complete` replay. The replay is strict: only renderables
  explicitly reported in `runtimeState.loadedRenderables` are replayed, so
  synthetic test harnesses and older controllers that don't populate the
  field stay on the existing single-replay path.

  `SectionControllerRuntimeState` gains an optional
  `loadedRenderables: ReadonlyArray<{ itemId; canonicalItemId; contentKind }>`
  field, populated by `SectionController.getRuntimeState` from
  `loadedRenderableKeys` ∩ `trackedRenderables` in registration order. The
  field is purely additive; existing consumers that ignore it are
  unaffected.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0355143]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.32
  - @pie-players/pie-context@0.3.32
  - @pie-players/pie-item-player@0.3.32
  - @pie-players/pie-players-shared@0.3.32
  - @pie-players/pie-tool-annotation-toolbar@0.3.32
  - @pie-players/pie-tool-calculator-desmos@0.3.32
  - @pie-players/pie-tool-text-to-speech@0.3.32
  - @pie-players/pie-tool-tts-inline@0.3.32
  - @pie-players/pie-toolbars@0.3.32

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
- Updated dependencies [26dbea3]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.31
  - @pie-players/pie-players-shared@0.3.31
  - @pie-players/pie-context@0.3.31
  - @pie-players/pie-item-player@0.3.31
  - @pie-players/pie-tool-annotation-toolbar@0.3.31
  - @pie-players/pie-tool-calculator-desmos@0.3.31
  - @pie-players/pie-tool-text-to-speech@0.3.31
  - @pie-players/pie-tool-tts-inline@0.3.31
  - @pie-players/pie-toolbars@0.3.31

## 0.3.30

### Patch Changes

- 96b66d1: Ship the framework-side focus contract for Skip-to-Main (PIE-102).

  - Promote `<pie-section-player-passage-card>` and `<pie-section-player-item-card>` to public focus targets: each custom element now carries `tabindex="-1"`, `role="region"`, and `aria-labelledby` pointing at its heading, plus a `:focus-visible` outline scoped to the tag so the indicator wraps the whole card box. The inner `data-section-item-card` div remains as an internal hook.
  - Replace `SectionPlayerFocusPolicy.autoFocusFirstItem: boolean` with `SectionPlayerFocusPolicy.autoFocus: 'none' | 'start-of-content' | 'current-item'` (default `'start-of-content'`). The strategy governs both mount and navigation focus moments: `start-of-content` focuses the passage when present else the first item card; `current-item` focuses the newly-active `pie-section-player-item-card[is-current]` for stacked/list layouts; `none` disables framework-driven focus movement entirely.
  - Keep `autoFocusFirstItem` as a deprecated alias (`true` → `'start-of-content'`, `false` → `'none'`) with a one-time console warning. Existing hosts continue to work unchanged.
  - Expose a `focusStart(): boolean` imperative method on `pie-section-player-splitpane`, `pie-section-player-vertical`, `pie-section-player-tabbed`, `pie-section-player-kernel-host`, and `pie-section-player-base`. It always focuses start-of-content and is the escape hatch hosts call from Skip-to-Main handlers — strategy-agnostic by design.
  - Export `DEFAULT_FOCUS_POLICY`, `SectionPlayerAutoFocusStrategy`, and `resolveAutoFocusStrategy` alongside the existing policy types.

- 698aa82: Add `focusFirst()` to `pie-item-player` and nest it after section navigation focuses the current item card.

  - Export `queryFirstFocusableDeep`, `focusFirstFocusableInElement`, `isProgrammaticFocusTarget`, and `FOCUSABLE_SELECTOR` from `@pie-players/pie-players-shared` (deep traversal into **open** shadow roots; same selector basis as the focus trap).
  - `pie-item-player.focusFirst()` moves focus to the first visible interactive control inside the item.
  - Section player scaffold calls `focusFirst()` after programmatic focus lands on an item card (`start-of-content` without passage, and `current-item`).

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0981bc3]
- Updated dependencies [698aa82]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.30
  - @pie-players/pie-item-player@0.3.30
  - @pie-players/pie-assessment-toolkit@0.3.30
  - @pie-players/pie-context@0.3.30
  - @pie-players/pie-tool-annotation-toolbar@0.3.30
  - @pie-players/pie-tool-calculator-desmos@0.3.30
  - @pie-players/pie-tool-text-to-speech@0.3.30
  - @pie-players/pie-tool-tts-inline@0.3.30
  - @pie-players/pie-toolbars@0.3.30

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.29
  - @pie-players/pie-context@0.3.29
  - @pie-players/pie-item-player@0.3.29
  - @pie-players/pie-players-shared@0.3.29
  - @pie-players/pie-tool-annotation-toolbar@0.3.29
  - @pie-players/pie-tool-calculator-desmos@0.3.29
  - @pie-players/pie-tool-text-to-speech@0.3.29
  - @pie-players/pie-tool-tts-inline@0.3.29
  - @pie-players/pie-toolbars@0.3.29

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.28
  - @pie-players/pie-context@0.3.28
  - @pie-players/pie-item-player@0.3.28
  - @pie-players/pie-players-shared@0.3.28
  - @pie-players/pie-tool-annotation-toolbar@0.3.28
  - @pie-players/pie-tool-calculator-desmos@0.3.28
  - @pie-players/pie-tool-text-to-speech@0.3.28
  - @pie-players/pie-tool-tts-inline@0.3.28
  - @pie-players/pie-toolbars@0.3.28

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.27
  - @pie-players/pie-context@0.3.27
  - @pie-players/pie-item-player@0.3.27
  - @pie-players/pie-players-shared@0.3.27
  - @pie-players/pie-tool-annotation-toolbar@0.3.27
  - @pie-players/pie-tool-calculator-desmos@0.3.27
  - @pie-players/pie-tool-text-to-speech@0.3.27
  - @pie-players/pie-tool-tts-inline@0.3.27
  - @pie-players/pie-toolbars@0.3.27

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.26
  - @pie-players/pie-context@0.3.26
  - @pie-players/pie-item-player@0.3.26
  - @pie-players/pie-players-shared@0.3.26
  - @pie-players/pie-tool-annotation-toolbar@0.3.26
  - @pie-players/pie-tool-calculator-desmos@0.3.26
  - @pie-players/pie-tool-text-to-speech@0.3.26
  - @pie-players/pie-tool-tts-inline@0.3.26
  - @pie-players/pie-toolbars@0.3.26

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.25
  - @pie-players/pie-context@0.3.25
  - @pie-players/pie-item-player@0.3.25
  - @pie-players/pie-players-shared@0.3.25
  - @pie-players/pie-tool-annotation-toolbar@0.3.25
  - @pie-players/pie-tool-calculator-desmos@0.3.25
  - @pie-players/pie-tool-text-to-speech@0.3.25
  - @pie-players/pie-tool-tts-inline@0.3.25
  - @pie-players/pie-toolbars@0.3.25

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.25
  - @pie-players/pie-context@0.3.25
  - @pie-players/pie-item-player@0.3.25
  - @pie-players/pie-players-shared@0.3.25
  - @pie-players/pie-tool-annotation-toolbar@0.3.25
  - @pie-players/pie-tool-calculator-desmos@0.3.25
  - @pie-players/pie-tool-text-to-speech@0.3.25
  - @pie-players/pie-tool-tts-inline@0.3.25
  - @pie-players/pie-toolbars@0.3.25

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.24
  - @pie-players/pie-context@0.3.24
  - @pie-players/pie-item-player@0.3.24
  - @pie-players/pie-players-shared@0.3.24
  - @pie-players/pie-tool-annotation-toolbar@0.3.24
  - @pie-players/pie-tool-calculator-desmos@0.3.24
  - @pie-players/pie-tool-text-to-speech@0.3.24
  - @pie-players/pie-tool-tts-inline@0.3.24
  - @pie-players/pie-toolbars@0.3.24

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.23
  - @pie-players/pie-context@0.3.23
  - @pie-players/pie-item-player@0.3.23
  - @pie-players/pie-players-shared@0.3.23
  - @pie-players/pie-tool-annotation-toolbar@0.3.23
  - @pie-players/pie-tool-calculator-desmos@0.3.23
  - @pie-players/pie-tool-text-to-speech@0.3.23
  - @pie-players/pie-tool-tts-inline@0.3.23
  - @pie-players/pie-toolbars@0.3.23

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.22
  - @pie-players/pie-context@0.3.22
  - @pie-players/pie-item-player@0.3.22
  - @pie-players/pie-players-shared@0.3.22
  - @pie-players/pie-tool-annotation-toolbar@0.3.22
  - @pie-players/pie-tool-calculator-desmos@0.3.22
  - @pie-players/pie-tool-text-to-speech@0.3.22
  - @pie-players/pie-tool-tts-inline@0.3.22
  - @pie-players/pie-toolbars@0.3.22

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.21
  - @pie-players/pie-context@0.3.21
  - @pie-players/pie-item-player@0.3.21
  - @pie-players/pie-players-shared@0.3.21
  - @pie-players/pie-tool-annotation-toolbar@0.3.21
  - @pie-players/pie-tool-calculator-desmos@0.3.21
  - @pie-players/pie-tool-text-to-speech@0.3.21
  - @pie-players/pie-tool-tts-inline@0.3.21
  - @pie-players/pie-toolbars@0.3.21

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.20
  - @pie-players/pie-context@0.3.20
  - @pie-players/pie-item-player@0.3.20
  - @pie-players/pie-players-shared@0.3.20
  - @pie-players/pie-tool-annotation-toolbar@0.3.20
  - @pie-players/pie-tool-calculator-desmos@0.3.20
  - @pie-players/pie-tool-text-to-speech@0.3.20
  - @pie-players/pie-tool-tts-inline@0.3.20
  - @pie-players/pie-toolbars@0.3.20

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.19
  - @pie-players/pie-context@0.3.19
  - @pie-players/pie-item-player@0.3.19
  - @pie-players/pie-players-shared@0.3.19
  - @pie-players/pie-tool-annotation-toolbar@0.3.19
  - @pie-players/pie-tool-calculator-desmos@0.3.19
  - @pie-players/pie-tool-text-to-speech@0.3.19
  - @pie-players/pie-tool-tts-inline@0.3.19
  - @pie-players/pie-toolbars@0.3.19

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.18
  - @pie-players/pie-context@0.3.18
  - @pie-players/pie-item-player@0.3.18
  - @pie-players/pie-players-shared@0.3.18
  - @pie-players/pie-tool-annotation-toolbar@0.3.18
  - @pie-players/pie-tool-calculator-desmos@0.3.18
  - @pie-players/pie-tool-text-to-speech@0.3.18
  - @pie-players/pie-tool-tts-inline@0.3.18
  - @pie-players/pie-toolbars@0.3.18

## 0.3.17

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.17
  - @pie-players/pie-context@0.3.17
  - @pie-players/pie-item-player@0.3.17
  - @pie-players/pie-players-shared@0.3.17
  - @pie-players/pie-tool-annotation-toolbar@0.3.17
  - @pie-players/pie-tool-calculator-desmos@0.3.17
  - @pie-players/pie-tool-text-to-speech@0.3.17
  - @pie-players/pie-tool-tts-inline@0.3.17
  - @pie-players/pie-toolbars@0.3.17

## 0.3.16

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.16
  - @pie-players/pie-context@0.3.16
  - @pie-players/pie-item-player@0.3.16
  - @pie-players/pie-players-shared@0.3.16
  - @pie-players/pie-tool-annotation-toolbar@0.3.16
  - @pie-players/pie-tool-calculator-desmos@0.3.16
  - @pie-players/pie-tool-text-to-speech@0.3.16
  - @pie-players/pie-tool-tts-inline@0.3.16
  - @pie-players/pie-toolbars@0.3.16

## 0.3.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.15
  - @pie-players/pie-context@0.3.15
  - @pie-players/pie-item-player@0.3.15
  - @pie-players/pie-players-shared@0.3.15
  - @pie-players/pie-tool-annotation-toolbar@0.3.15
  - @pie-players/pie-tool-calculator-desmos@0.3.15
  - @pie-players/pie-tool-text-to-speech@0.3.15
  - @pie-players/pie-tool-tts-inline@0.3.15
  - @pie-players/pie-toolbars@0.3.15

## 0.3.14

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.14
  - @pie-players/pie-context@0.3.14
  - @pie-players/pie-item-player@0.3.14
  - @pie-players/pie-players-shared@0.3.14
  - @pie-players/pie-tool-annotation-toolbar@0.3.14
  - @pie-players/pie-tool-calculator-desmos@0.3.14
  - @pie-players/pie-tool-text-to-speech@0.3.14
  - @pie-players/pie-tool-tts-inline@0.3.14
  - @pie-players/pie-toolbars@0.3.14

## 0.3.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.13
  - @pie-players/pie-context@0.3.13
  - @pie-players/pie-item-player@0.3.13
  - @pie-players/pie-players-shared@0.3.13
  - @pie-players/pie-tool-annotation-toolbar@0.3.13
  - @pie-players/pie-tool-calculator-desmos@0.3.13
  - @pie-players/pie-tool-text-to-speech@0.3.13
  - @pie-players/pie-tool-tts-inline@0.3.13
  - @pie-players/pie-toolbars@0.3.13

## 0.3.12

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.12
  - @pie-players/pie-context@0.3.12
  - @pie-players/pie-item-player@0.3.12
  - @pie-players/pie-players-shared@0.3.12
  - @pie-players/pie-tool-annotation-toolbar@0.3.12
  - @pie-players/pie-tool-calculator-desmos@0.3.12
  - @pie-players/pie-tool-text-to-speech@0.3.12
  - @pie-players/pie-tool-tts-inline@0.3.12
  - @pie-players/pie-toolbars@0.3.12

## 0.3.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.11
  - @pie-players/pie-context@0.3.11
  - @pie-players/pie-item-player@0.3.11
  - @pie-players/pie-players-shared@0.3.11
  - @pie-players/pie-tool-annotation-toolbar@0.3.11
  - @pie-players/pie-tool-calculator-desmos@0.3.11
  - @pie-players/pie-tool-text-to-speech@0.3.11
  - @pie-players/pie-tool-tts-inline@0.3.11
  - @pie-players/pie-toolbars@0.3.11

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.10
  - @pie-players/pie-context@0.3.10
  - @pie-players/pie-item-player@0.3.10
  - @pie-players/pie-players-shared@0.3.10
  - @pie-players/pie-tool-annotation-toolbar@0.3.10
  - @pie-players/pie-tool-calculator-desmos@0.3.10
  - @pie-players/pie-tool-text-to-speech@0.3.10
  - @pie-players/pie-tool-tts-inline@0.3.10
  - @pie-players/pie-toolbars@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.9
  - @pie-players/pie-context@0.3.9
  - @pie-players/pie-item-player@0.3.9
  - @pie-players/pie-players-shared@0.3.9
  - @pie-players/pie-tool-annotation-toolbar@0.3.9
  - @pie-players/pie-tool-calculator-desmos@0.3.9
  - @pie-players/pie-tool-text-to-speech@0.3.9
  - @pie-players/pie-tool-tts-inline@0.3.9
  - @pie-players/pie-toolbars@0.3.9

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.10
  - @pie-players/pie-context@0.3.10
  - @pie-players/pie-item-player@0.3.10
  - @pie-players/pie-players-shared@0.3.10
  - @pie-players/pie-tool-annotation-toolbar@0.3.10
  - @pie-players/pie-tool-calculator-desmos@0.3.10
  - @pie-players/pie-tool-text-to-speech@0.3.10
  - @pie-players/pie-tool-tts-inline@0.3.10
  - @pie-players/pie-toolbars@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.9
  - @pie-players/pie-context@0.3.9
  - @pie-players/pie-item-player@0.3.9
  - @pie-players/pie-players-shared@0.3.9
  - @pie-players/pie-tool-annotation-toolbar@0.3.9
  - @pie-players/pie-tool-text-to-speech@0.3.9
  - @pie-players/pie-tool-tts-inline@0.3.9
  - @pie-players/pie-toolbars@0.3.9

## 0.3.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.8
  - @pie-players/pie-context@0.3.8
  - @pie-players/pie-item-player@0.3.8
  - @pie-players/pie-players-shared@0.3.8
  - @pie-players/pie-tool-annotation-toolbar@0.3.8
  - @pie-players/pie-toolbars@0.3.8

## 0.3.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.7
  - @pie-players/pie-context@0.3.7
  - @pie-players/pie-item-player@0.3.7
  - @pie-players/pie-players-shared@0.3.7
  - @pie-players/pie-tool-annotation-toolbar@0.3.7
  - @pie-players/pie-toolbars@0.3.7

## 0.3.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.6
  - @pie-players/pie-context@0.3.6
  - @pie-players/pie-item-player@0.3.6
  - @pie-players/pie-players-shared@0.3.6
  - @pie-players/pie-tool-annotation-toolbar@0.3.6
  - @pie-players/pie-toolbars@0.3.6

## 0.3.5

### Patch Changes

- Publish a patch release for all publishable pie-players packages.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.5
  - @pie-players/pie-context@0.3.5
  - @pie-players/pie-item-player@0.3.5
  - @pie-players/pie-players-shared@0.3.5
  - @pie-players/pie-toolbars@0.3.5
  - @pie-players/pie-tool-annotation-toolbar@0.3.5

## 0.3.4

### Patch Changes

- Patch release for the lockstep package train with toolkit architecture hardening, stricter runtime validation, and a section-player vertical layout regression fix covered by e2e.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.4
  - @pie-players/pie-tool-annotation-toolbar@0.3.4
  - @pie-players/pie-toolbars@0.3.4
  - @pie-players/pie-context@0.3.4
  - @pie-players/pie-item-player@0.3.4
  - @pie-players/pie-players-shared@0.3.4

## 0.3.3

### Patch Changes

- Prepare a patch release for the latest framework fixes, math-rendering hardening, and packaging safety improvements.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.3
  - @pie-players/pie-context@0.3.3
  - @pie-players/pie-item-player@0.3.3
  - @pie-players/pie-players-shared@0.3.3
  - @pie-players/pie-tool-annotation-toolbar@0.3.3
  - @pie-players/pie-toolbars@0.3.3

## 0.3.2

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.2
  - @pie-players/pie-tool-annotation-toolbar@0.3.2
  - @pie-players/pie-toolbars@0.3.2
  - @pie-players/pie-context@0.3.2
  - @pie-players/pie-item-player@0.3.2
  - @pie-players/pie-players-shared@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.1
  - @pie-players/pie-tool-annotation-toolbar@0.3.1
  - @pie-players/pie-toolbars@0.3.1
  - @pie-players/pie-context@0.3.1
  - @pie-players/pie-item-player@0.3.1
  - @pie-players/pie-players-shared@0.3.1

## 0.3.0

### Minor Changes

- Adopt monorepo-wide fixed versioning and establish the first lockstep release train at 0.3.0.

### Patch Changes

- 9385ce0: Release all publishable packages in the repository.

  This intentionally triggers a full patch release sweep across all non-private workspace packages.

- Updated dependencies
- Updated dependencies [9385ce0]
  - @pie-players/pie-assessment-toolkit@0.3.0
  - @pie-players/pie-context@0.3.0
  - @pie-players/pie-item-player@0.3.0
  - @pie-players/pie-players-shared@0.3.0
  - @pie-players/pie-toolbars@0.3.0
  - @pie-players/pie-tool-annotation-toolbar@0.3.0
  - @pie-players/pie-tool-answer-eliminator@0.3.0
  - @pie-players/pie-tool-calculator@0.3.0
  - @pie-players/pie-tool-theme@0.3.0
  - @pie-players/pie-tool-graph@0.3.0
  - @pie-players/pie-tool-line-reader@0.3.0
  - @pie-players/pie-tool-periodic-table@0.3.0
  - @pie-players/pie-tool-protractor@0.3.0
  - @pie-players/pie-tool-ruler@0.3.0
  - @pie-players/pie-tool-text-to-speech@0.3.0
  - @pie-players/tts-client-server@0.3.0

## 0.2.13

### Patch Changes

- beffcc0: Release all publishable packages.
- Updated dependencies [beffcc0]
  - @pie-players/pie-assessment-toolkit@0.2.10
  - @pie-players/pie-context@0.1.2
  - @pie-players/pie-item-player@0.1.1
  - @pie-players/pie-players-shared@0.2.6
  - @pie-players/pie-tool-answer-eliminator@0.2.10
  - @pie-players/pie-tool-calculator@0.1.10
  - @pie-players/pie-tool-graph@0.1.10
  - @pie-players/pie-tool-line-reader@0.1.10
  - @pie-players/pie-tool-periodic-table@0.1.10
  - @pie-players/pie-tool-protractor@0.1.10
  - @pie-players/pie-tool-ruler@0.1.10
  - @pie-players/pie-tool-text-to-speech@0.1.10
  - @pie-players/pie-tool-theme@0.1.10
  - @pie-players/pie-toolbars@0.1.1
  - @pie-players/tts-client-server@0.2.5

## 0.2.12

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
- Updated dependencies [71a9581]
  - @pie-players/pie-assessment-toolkit@0.2.9
  - @pie-players/pie-context@0.1.1
  - @pie-players/pie-esm-player@0.2.6
  - @pie-players/pie-iife-player@0.2.6
  - @pie-players/pie-players-shared@0.2.5
  - @pie-players/pie-section-tools-toolbar@0.2.10
  - @pie-players/pie-tool-answer-eliminator@0.2.9
  - @pie-players/pie-tool-calculator@0.1.9
  - @pie-players/pie-tool-calculator-inline@0.1.6
  - @pie-players/pie-tool-tts-inline@0.1.6
  - @pie-players/tts-client-server@0.2.4
