# @pie-players/pie-default-tool-loaders

## 0.3.67

### Patch Changes

- 61d6aa0: Print resolves accessibility catalogs, so an alternate representation reaches paper. `<pie-print>` takes an `accessibility` config carrying the learner's profile.

  Print renders from the item model alone, so an alternate carried as a catalog card reached paper only where some element happened to render it from a legacy model field. With the transcript moved onto a card and rendered by the toolkit, print was the last consumer of `model.audioTranscript` — and braille, simplified-language and extended-description all arrive the same way.

  ```js
  player.config = {
    item,
    options: { role: "student" },
    accessibility: {
      personalNeedsProfile: { supports: ["transcript"] },
      // district blocks and test-administration overrides, when a program has them
      settings,
      // this item's required/restricted supports
      itemSettings,
    },
  };
  ```

  Three things worth knowing about it:

  - **A print job is one learner with one profile, decided once**, so print has no coordinator and nothing to toggle. It asks the same question the section player asks continuously — given this item and this profile, which alternates are in play — through the same policy engine, the same catalog resolver, and the grant-AND-content rule now shared as `resolveContentCapabilities` in `@pie-players/pie-assessment-toolkit/tools/internal`. A second reader for the one-shot case would be two renderers disagreeing about the same card.
  - **Policy answers that rule in three states, not two.** A host gate is not the absence of a grant: `resolvesWithoutGrant` lets a capability answer from the content when nobody was granted anything, so a host that switched the capability off has to be distinguishable from silence or the content would reopen it. The rule owns the scan across a capability's support ids, the gate-only probe of its tool id (a host gate names capabilities, and a block must not double as a grant), and denial's precedence over both a grant and the content exception — so a renderer supplies one `policyFor(featureId)` and cannot drift on any of it.
  - **An alternate the item declares as authored presentation prints with no `accessibility` config at all.** An item family designed to be delivered with its transcript on screen is not an accommodation, and print resolves unconditionally for that reason. An accommodation card with no profile supplied still prints nothing.
  - **Print opens the in-flow host slot and not the docked-media one.** That is a property of paper rather than a preference: a signed alternate is a video, and on paper a video is a blank rectangle. Every alternate that can be read in order reaches print by declaring the slot, with no change in print.

  The capability's accessible name is rendered as a visible label above its content and pointed at with `aria-labelledby`. Paper has no accessibility tree, and an unlabelled block of prose above an item reads as part of the item.

  The default capability set is `CONTENT_ALTERNATE_REGISTRATIONS` from `@pie-players/pie-default-tool-loaders` — the packaged capabilities that carry an authored alternate and render it as a region, pinned against the packaged composition in both directions so an alternate added there cannot quietly fail to reach print. A deployment composing its own set passes `accessibility.registrations`.

- Updated dependencies [b264ab2]
- Updated dependencies [73d2be4]
- Updated dependencies [fe9b4f0]
- Updated dependencies [61d6aa0]
  - @pie-players/pie-players-shared@0.3.67
  - @pie-players/pie-tool-answer-eliminator@0.3.67
  - @pie-players/pie-assessment-toolkit@0.3.67
  - @pie-players/pie-tool-annotation-toolbar@0.3.67
  - @pie-players/pie-tool-calculator-desmos@0.3.67
  - @pie-players/pie-tool-theme@0.3.67
  - @pie-players/pie-tool-graph@0.3.67
  - @pie-players/pie-tool-line-reader@0.3.67
  - @pie-players/pie-tool-periodic-table@0.3.67
  - @pie-players/pie-tool-protractor@0.3.67
  - @pie-players/pie-tool-ruler@0.3.67
  - @pie-players/pie-tool-tts-inline@0.3.67

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

- 5e6fcde: Author the packaged capability set through one validated composition so its
  registrations, element tags, lazy loaders, placement/order projections and
  explicit universal-support policy cannot drift independently. Existing host
  exports, registry overrides, opt-in loader behavior and fail-soft `toolIds`
  selection remain unchanged.
- 5f133be: The audio transcript is a packaged capability rendering into a new `content-lead` host surface. No element and no host names a transcript.

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

- Updated dependencies [556c422]
- Updated dependencies [2a741c6]
- Updated dependencies [5e6fcde]
- Updated dependencies [2bcd9fa]
- Updated dependencies [1e0c10f]
- Updated dependencies [2bcd9fa]
- Updated dependencies [e8a6f0e]
- Updated dependencies [08f77f5]
- Updated dependencies [2bcd9fa]
- Updated dependencies [1f29de7]
- Updated dependencies [5e6fcde]
- Updated dependencies [5f133be]
- Updated dependencies [2a741c6]
- Updated dependencies [9a183cf]
  - @pie-players/pie-assessment-toolkit@0.3.66
  - @pie-players/pie-players-shared@0.3.66
  - @pie-players/pie-tool-tts-inline@0.3.66
  - @pie-players/pie-tool-periodic-table@0.3.66
  - @pie-players/pie-tool-calculator-desmos@0.3.66
  - @pie-players/pie-tool-theme@0.3.66
  - @pie-players/pie-tool-annotation-toolbar@0.3.66
  - @pie-players/pie-tool-answer-eliminator@0.3.66
  - @pie-players/pie-tool-graph@0.3.66
  - @pie-players/pie-tool-line-reader@0.3.66
  - @pie-players/pie-tool-protractor@0.3.66
  - @pie-players/pie-tool-ruler@0.3.66

## 0.3.65

### Patch Changes

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

- Updated dependencies [c16c77c]
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
  - @pie-players/pie-tool-answer-eliminator@0.3.65
  - @pie-players/pie-assessment-toolkit@0.3.65
  - @pie-players/pie-players-shared@0.3.65
  - @pie-players/pie-tool-theme@0.3.65
  - @pie-players/pie-tool-annotation-toolbar@0.3.65
  - @pie-players/pie-tool-calculator-desmos@0.3.65
  - @pie-players/pie-tool-graph@0.3.65
  - @pie-players/pie-tool-line-reader@0.3.65
  - @pie-players/pie-tool-periodic-table@0.3.65
  - @pie-players/pie-tool-protractor@0.3.65
  - @pie-players/pie-tool-ruler@0.3.65
  - @pie-players/pie-tool-tts-inline@0.3.65

## 0.3.64

### Patch Changes

- Updated dependencies [dc44392]
  - @pie-players/pie-tool-line-reader@0.3.64
  - @pie-players/pie-tool-annotation-toolbar@0.3.64
  - @pie-players/pie-tool-answer-eliminator@0.3.64
  - @pie-players/pie-tool-calculator-desmos@0.3.64
  - @pie-players/pie-tool-theme@0.3.64
  - @pie-players/pie-tool-graph@0.3.64
  - @pie-players/pie-tool-periodic-table@0.3.64
  - @pie-players/pie-tool-protractor@0.3.64
  - @pie-players/pie-tool-ruler@0.3.64
  - @pie-players/pie-tool-tts-inline@0.3.64

## 0.3.63

### Patch Changes

- Updated dependencies [b960bae]
  - @pie-players/pie-tool-line-reader@0.3.63
  - @pie-players/pie-tool-annotation-toolbar@0.3.63
  - @pie-players/pie-tool-answer-eliminator@0.3.63
  - @pie-players/pie-tool-calculator-desmos@0.3.63
  - @pie-players/pie-tool-theme@0.3.63
  - @pie-players/pie-tool-graph@0.3.63
  - @pie-players/pie-tool-periodic-table@0.3.63
  - @pie-players/pie-tool-protractor@0.3.63
  - @pie-players/pie-tool-ruler@0.3.63
  - @pie-players/pie-tool-tts-inline@0.3.63

## 0.3.62

### Patch Changes

- Updated dependencies [c73c995]
- Updated dependencies [507b56f]
- Updated dependencies [c810459]
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.62
  - @pie-players/pie-tool-tts-inline@0.3.62
  - @pie-players/pie-tool-answer-eliminator@0.3.62
  - @pie-players/pie-tool-calculator-desmos@0.3.62
  - @pie-players/pie-tool-theme@0.3.62
  - @pie-players/pie-tool-graph@0.3.62
  - @pie-players/pie-tool-line-reader@0.3.62
  - @pie-players/pie-tool-periodic-table@0.3.62
  - @pie-players/pie-tool-protractor@0.3.62
  - @pie-players/pie-tool-ruler@0.3.62

## 0.3.61

### Patch Changes

- @pie-players/pie-tool-annotation-toolbar@0.3.61
- @pie-players/pie-tool-answer-eliminator@0.3.61
- @pie-players/pie-tool-calculator-desmos@0.3.61
- @pie-players/pie-tool-theme@0.3.61
- @pie-players/pie-tool-graph@0.3.61
- @pie-players/pie-tool-line-reader@0.3.61
- @pie-players/pie-tool-periodic-table@0.3.61
- @pie-players/pie-tool-protractor@0.3.61
- @pie-players/pie-tool-ruler@0.3.61
- @pie-players/pie-tool-tts-inline@0.3.61

## 0.3.60

### Patch Changes

- @pie-players/pie-tool-annotation-toolbar@0.3.60
- @pie-players/pie-tool-answer-eliminator@0.3.60
- @pie-players/pie-tool-calculator-desmos@0.3.60
- @pie-players/pie-tool-theme@0.3.60
- @pie-players/pie-tool-graph@0.3.60
- @pie-players/pie-tool-line-reader@0.3.60
- @pie-players/pie-tool-periodic-table@0.3.60
- @pie-players/pie-tool-protractor@0.3.60
- @pie-players/pie-tool-ruler@0.3.60
- @pie-players/pie-tool-tts-inline@0.3.60

## 0.3.59

### Patch Changes

- Updated dependencies
  - @pie-players/pie-tool-tts-inline@0.3.59
  - @pie-players/pie-tool-annotation-toolbar@0.3.59
  - @pie-players/pie-tool-answer-eliminator@0.3.59
  - @pie-players/pie-tool-calculator-desmos@0.3.59
  - @pie-players/pie-tool-theme@0.3.59
  - @pie-players/pie-tool-graph@0.3.59
  - @pie-players/pie-tool-line-reader@0.3.59
  - @pie-players/pie-tool-periodic-table@0.3.59
  - @pie-players/pie-tool-protractor@0.3.59
  - @pie-players/pie-tool-ruler@0.3.59

## 0.3.58

### Patch Changes

- @pie-players/pie-tool-annotation-toolbar@0.3.58
- @pie-players/pie-tool-answer-eliminator@0.3.58
- @pie-players/pie-tool-calculator-desmos@0.3.58
- @pie-players/pie-tool-theme@0.3.58
- @pie-players/pie-tool-graph@0.3.58
- @pie-players/pie-tool-line-reader@0.3.58
- @pie-players/pie-tool-periodic-table@0.3.58
- @pie-players/pie-tool-protractor@0.3.58
- @pie-players/pie-tool-ruler@0.3.58
- @pie-players/pie-tool-tts-inline@0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.57
  - @pie-players/pie-tool-answer-eliminator@0.3.57
  - @pie-players/pie-tool-calculator-desmos@0.3.57
  - @pie-players/pie-tool-graph@0.3.57
  - @pie-players/pie-tool-line-reader@0.3.57
  - @pie-players/pie-tool-periodic-table@0.3.57
  - @pie-players/pie-tool-protractor@0.3.57
  - @pie-players/pie-tool-ruler@0.3.57
  - @pie-players/pie-tool-theme@0.3.57
  - @pie-players/pie-tool-tts-inline@0.3.57

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.56
  - @pie-players/pie-tool-answer-eliminator@0.3.56
  - @pie-players/pie-tool-calculator-desmos@0.3.56
  - @pie-players/pie-tool-graph@0.3.56
  - @pie-players/pie-tool-line-reader@0.3.56
  - @pie-players/pie-tool-periodic-table@0.3.56
  - @pie-players/pie-tool-protractor@0.3.56
  - @pie-players/pie-tool-ruler@0.3.56
  - @pie-players/pie-tool-theme@0.3.56
  - @pie-players/pie-tool-tts-inline@0.3.56

## 0.3.55

### Patch Changes

- @pie-players/pie-tool-annotation-toolbar@0.3.55
- @pie-players/pie-tool-answer-eliminator@0.3.55
- @pie-players/pie-tool-calculator-desmos@0.3.55
- @pie-players/pie-tool-theme@0.3.55
- @pie-players/pie-tool-graph@0.3.55
- @pie-players/pie-tool-line-reader@0.3.55
- @pie-players/pie-tool-periodic-table@0.3.55
- @pie-players/pie-tool-protractor@0.3.55
- @pie-players/pie-tool-ruler@0.3.55
- @pie-players/pie-tool-tts-inline@0.3.55

## 0.3.54

### Patch Changes

- Updated dependencies [bead424]
  - @pie-players/pie-tool-tts-inline@0.3.54
  - @pie-players/pie-tool-annotation-toolbar@0.3.54
  - @pie-players/pie-tool-answer-eliminator@0.3.54
  - @pie-players/pie-tool-calculator-desmos@0.3.54
  - @pie-players/pie-tool-theme@0.3.54
  - @pie-players/pie-tool-graph@0.3.54
  - @pie-players/pie-tool-line-reader@0.3.54
  - @pie-players/pie-tool-periodic-table@0.3.54
  - @pie-players/pie-tool-protractor@0.3.54
  - @pie-players/pie-tool-ruler@0.3.54

## 0.3.53

### Patch Changes

- Updated dependencies [ee6c081]
- Updated dependencies [20fc985]
  - @pie-players/pie-tool-tts-inline@0.3.53
  - @pie-players/pie-tool-theme@0.3.53
  - @pie-players/pie-tool-annotation-toolbar@0.3.53
  - @pie-players/pie-tool-answer-eliminator@0.3.53
  - @pie-players/pie-tool-calculator-desmos@0.3.53
  - @pie-players/pie-tool-graph@0.3.53
  - @pie-players/pie-tool-line-reader@0.3.53
  - @pie-players/pie-tool-periodic-table@0.3.53
  - @pie-players/pie-tool-protractor@0.3.53
  - @pie-players/pie-tool-ruler@0.3.53

## 0.3.52

### Patch Changes

- Updated dependencies [905080d]
  - @pie-players/pie-tool-tts-inline@0.3.52
  - @pie-players/pie-tool-annotation-toolbar@0.3.52
  - @pie-players/pie-tool-answer-eliminator@0.3.52
  - @pie-players/pie-tool-calculator-desmos@0.3.52
  - @pie-players/pie-tool-theme@0.3.52
  - @pie-players/pie-tool-graph@0.3.52
  - @pie-players/pie-tool-line-reader@0.3.52
  - @pie-players/pie-tool-periodic-table@0.3.52
  - @pie-players/pie-tool-protractor@0.3.52
  - @pie-players/pie-tool-ruler@0.3.52

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.51
  - @pie-players/pie-tool-answer-eliminator@0.3.51
  - @pie-players/pie-tool-calculator-desmos@0.3.51
  - @pie-players/pie-tool-graph@0.3.51
  - @pie-players/pie-tool-line-reader@0.3.51
  - @pie-players/pie-tool-periodic-table@0.3.51
  - @pie-players/pie-tool-protractor@0.3.51
  - @pie-players/pie-tool-ruler@0.3.51
  - @pie-players/pie-tool-theme@0.3.51
  - @pie-players/pie-tool-tts-inline@0.3.51

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.50
  - @pie-players/pie-tool-answer-eliminator@0.3.50
  - @pie-players/pie-tool-calculator-desmos@0.3.50
  - @pie-players/pie-tool-graph@0.3.50
  - @pie-players/pie-tool-line-reader@0.3.50
  - @pie-players/pie-tool-periodic-table@0.3.50
  - @pie-players/pie-tool-protractor@0.3.50
  - @pie-players/pie-tool-ruler@0.3.50
  - @pie-players/pie-tool-theme@0.3.50
  - @pie-players/pie-tool-tts-inline@0.3.50

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.49
  - @pie-players/pie-tool-answer-eliminator@0.3.49
  - @pie-players/pie-tool-calculator-desmos@0.3.49
  - @pie-players/pie-tool-graph@0.3.49
  - @pie-players/pie-tool-line-reader@0.3.49
  - @pie-players/pie-tool-periodic-table@0.3.49
  - @pie-players/pie-tool-protractor@0.3.49
  - @pie-players/pie-tool-ruler@0.3.49
  - @pie-players/pie-tool-text-to-speech@0.3.49
  - @pie-players/pie-tool-theme@0.3.49

## 0.3.48

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.48
  - @pie-players/pie-tool-answer-eliminator@0.3.48
  - @pie-players/pie-tool-calculator-desmos@0.3.48
  - @pie-players/pie-tool-graph@0.3.48
  - @pie-players/pie-tool-line-reader@0.3.48
  - @pie-players/pie-tool-periodic-table@0.3.48
  - @pie-players/pie-tool-protractor@0.3.48
  - @pie-players/pie-tool-ruler@0.3.48
  - @pie-players/pie-tool-text-to-speech@0.3.48
  - @pie-players/pie-tool-theme@0.3.48

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.47
  - @pie-players/pie-tool-answer-eliminator@0.3.47
  - @pie-players/pie-tool-calculator-desmos@0.3.47
  - @pie-players/pie-tool-graph@0.3.47
  - @pie-players/pie-tool-line-reader@0.3.47
  - @pie-players/pie-tool-periodic-table@0.3.47
  - @pie-players/pie-tool-protractor@0.3.47
  - @pie-players/pie-tool-ruler@0.3.47
  - @pie-players/pie-tool-text-to-speech@0.3.47
  - @pie-players/pie-tool-theme@0.3.47

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.46
  - @pie-players/pie-tool-answer-eliminator@0.3.46
  - @pie-players/pie-tool-calculator-desmos@0.3.46
  - @pie-players/pie-tool-graph@0.3.46
  - @pie-players/pie-tool-line-reader@0.3.46
  - @pie-players/pie-tool-periodic-table@0.3.46
  - @pie-players/pie-tool-protractor@0.3.46
  - @pie-players/pie-tool-ruler@0.3.46
  - @pie-players/pie-tool-text-to-speech@0.3.46
  - @pie-players/pie-tool-theme@0.3.46

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.45
  - @pie-players/pie-tool-answer-eliminator@0.3.45
  - @pie-players/pie-tool-calculator-desmos@0.3.45
  - @pie-players/pie-tool-graph@0.3.45
  - @pie-players/pie-tool-line-reader@0.3.45
  - @pie-players/pie-tool-periodic-table@0.3.45
  - @pie-players/pie-tool-protractor@0.3.45
  - @pie-players/pie-tool-ruler@0.3.45
  - @pie-players/pie-tool-text-to-speech@0.3.45
  - @pie-players/pie-tool-theme@0.3.45

## 0.3.44

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.44
  - @pie-players/pie-tool-answer-eliminator@0.3.44
  - @pie-players/pie-tool-calculator-desmos@0.3.44
  - @pie-players/pie-tool-graph@0.3.44
  - @pie-players/pie-tool-line-reader@0.3.44
  - @pie-players/pie-tool-periodic-table@0.3.44
  - @pie-players/pie-tool-protractor@0.3.44
  - @pie-players/pie-tool-ruler@0.3.44
  - @pie-players/pie-tool-text-to-speech@0.3.44
  - @pie-players/pie-tool-theme@0.3.44

## 0.3.42

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.42
  - @pie-players/pie-tool-answer-eliminator@0.3.42
  - @pie-players/pie-tool-calculator-desmos@0.3.42
  - @pie-players/pie-tool-graph@0.3.42
  - @pie-players/pie-tool-line-reader@0.3.42
  - @pie-players/pie-tool-periodic-table@0.3.42
  - @pie-players/pie-tool-protractor@0.3.42
  - @pie-players/pie-tool-ruler@0.3.42
  - @pie-players/pie-tool-text-to-speech@0.3.42
  - @pie-players/pie-tool-theme@0.3.42

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.41
  - @pie-players/pie-tool-answer-eliminator@0.3.41
  - @pie-players/pie-tool-calculator-desmos@0.3.41
  - @pie-players/pie-tool-graph@0.3.41
  - @pie-players/pie-tool-line-reader@0.3.41
  - @pie-players/pie-tool-periodic-table@0.3.41
  - @pie-players/pie-tool-protractor@0.3.41
  - @pie-players/pie-tool-ruler@0.3.41
  - @pie-players/pie-tool-text-to-speech@0.3.41
  - @pie-players/pie-tool-theme@0.3.41

## 0.3.40

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.40
  - @pie-players/pie-tool-answer-eliminator@0.3.40
  - @pie-players/pie-tool-calculator-desmos@0.3.40
  - @pie-players/pie-tool-graph@0.3.40
  - @pie-players/pie-tool-line-reader@0.3.40
  - @pie-players/pie-tool-periodic-table@0.3.40
  - @pie-players/pie-tool-protractor@0.3.40
  - @pie-players/pie-tool-ruler@0.3.40
  - @pie-players/pie-tool-text-to-speech@0.3.40
  - @pie-players/pie-tool-theme@0.3.40

## 0.3.39

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.39
  - @pie-players/pie-tool-answer-eliminator@0.3.39
  - @pie-players/pie-tool-calculator-desmos@0.3.39
  - @pie-players/pie-tool-graph@0.3.39
  - @pie-players/pie-tool-line-reader@0.3.39
  - @pie-players/pie-tool-periodic-table@0.3.39
  - @pie-players/pie-tool-protractor@0.3.39
  - @pie-players/pie-tool-ruler@0.3.39
  - @pie-players/pie-tool-text-to-speech@0.3.39
  - @pie-players/pie-tool-theme@0.3.39

## 0.3.38

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.38
  - @pie-players/pie-tool-answer-eliminator@0.3.38
  - @pie-players/pie-tool-calculator-desmos@0.3.38
  - @pie-players/pie-tool-graph@0.3.38
  - @pie-players/pie-tool-line-reader@0.3.38
  - @pie-players/pie-tool-periodic-table@0.3.38
  - @pie-players/pie-tool-protractor@0.3.38
  - @pie-players/pie-tool-ruler@0.3.38
  - @pie-players/pie-tool-text-to-speech@0.3.38
  - @pie-players/pie-tool-theme@0.3.38

## 0.3.37

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.37
  - @pie-players/pie-tool-answer-eliminator@0.3.37
  - @pie-players/pie-tool-calculator-desmos@0.3.37
  - @pie-players/pie-tool-graph@0.3.37
  - @pie-players/pie-tool-line-reader@0.3.37
  - @pie-players/pie-tool-periodic-table@0.3.37
  - @pie-players/pie-tool-protractor@0.3.37
  - @pie-players/pie-tool-ruler@0.3.37
  - @pie-players/pie-tool-text-to-speech@0.3.37
  - @pie-players/pie-tool-theme@0.3.37

## 0.3.36

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.36
  - @pie-players/pie-tool-answer-eliminator@0.3.36
  - @pie-players/pie-tool-calculator-desmos@0.3.36
  - @pie-players/pie-tool-graph@0.3.36
  - @pie-players/pie-tool-line-reader@0.3.36
  - @pie-players/pie-tool-periodic-table@0.3.36
  - @pie-players/pie-tool-protractor@0.3.36
  - @pie-players/pie-tool-ruler@0.3.36
  - @pie-players/pie-tool-text-to-speech@0.3.36
  - @pie-players/pie-tool-theme@0.3.36

## 0.3.35

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.35
  - @pie-players/pie-tool-answer-eliminator@0.3.35
  - @pie-players/pie-tool-calculator-desmos@0.3.35
  - @pie-players/pie-tool-graph@0.3.35
  - @pie-players/pie-tool-line-reader@0.3.35
  - @pie-players/pie-tool-periodic-table@0.3.35
  - @pie-players/pie-tool-protractor@0.3.35
  - @pie-players/pie-tool-ruler@0.3.35
  - @pie-players/pie-tool-text-to-speech@0.3.35
  - @pie-players/pie-tool-theme@0.3.35

## 0.3.34

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.34
  - @pie-players/pie-tool-answer-eliminator@0.3.34
  - @pie-players/pie-tool-calculator-desmos@0.3.34
  - @pie-players/pie-tool-graph@0.3.34
  - @pie-players/pie-tool-line-reader@0.3.34
  - @pie-players/pie-tool-periodic-table@0.3.34
  - @pie-players/pie-tool-protractor@0.3.34
  - @pie-players/pie-tool-ruler@0.3.34
  - @pie-players/pie-tool-text-to-speech@0.3.34
  - @pie-players/pie-tool-theme@0.3.34

## 0.3.33

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.33
  - @pie-players/pie-tool-answer-eliminator@0.3.33
  - @pie-players/pie-tool-calculator-desmos@0.3.33
  - @pie-players/pie-tool-graph@0.3.33
  - @pie-players/pie-tool-line-reader@0.3.33
  - @pie-players/pie-tool-periodic-table@0.3.33
  - @pie-players/pie-tool-protractor@0.3.33
  - @pie-players/pie-tool-ruler@0.3.33
  - @pie-players/pie-tool-text-to-speech@0.3.33
  - @pie-players/pie-tool-theme@0.3.33

## 0.3.32

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.32
  - @pie-players/pie-tool-answer-eliminator@0.3.32
  - @pie-players/pie-tool-calculator-desmos@0.3.32
  - @pie-players/pie-tool-graph@0.3.32
  - @pie-players/pie-tool-line-reader@0.3.32
  - @pie-players/pie-tool-periodic-table@0.3.32
  - @pie-players/pie-tool-protractor@0.3.32
  - @pie-players/pie-tool-ruler@0.3.32
  - @pie-players/pie-tool-text-to-speech@0.3.32
  - @pie-players/pie-tool-theme@0.3.32

## 0.3.31

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.31
  - @pie-players/pie-tool-answer-eliminator@0.3.31
  - @pie-players/pie-tool-calculator-desmos@0.3.31
  - @pie-players/pie-tool-graph@0.3.31
  - @pie-players/pie-tool-line-reader@0.3.31
  - @pie-players/pie-tool-periodic-table@0.3.31
  - @pie-players/pie-tool-protractor@0.3.31
  - @pie-players/pie-tool-ruler@0.3.31
  - @pie-players/pie-tool-text-to-speech@0.3.31
  - @pie-players/pie-tool-theme@0.3.31

## 0.3.30

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.30
  - @pie-players/pie-tool-answer-eliminator@0.3.30
  - @pie-players/pie-tool-calculator-desmos@0.3.30
  - @pie-players/pie-tool-graph@0.3.30
  - @pie-players/pie-tool-line-reader@0.3.30
  - @pie-players/pie-tool-periodic-table@0.3.30
  - @pie-players/pie-tool-protractor@0.3.30
  - @pie-players/pie-tool-ruler@0.3.30
  - @pie-players/pie-tool-text-to-speech@0.3.30
  - @pie-players/pie-tool-theme@0.3.30

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.29
  - @pie-players/pie-tool-answer-eliminator@0.3.29
  - @pie-players/pie-tool-calculator-desmos@0.3.29
  - @pie-players/pie-tool-graph@0.3.29
  - @pie-players/pie-tool-line-reader@0.3.29
  - @pie-players/pie-tool-periodic-table@0.3.29
  - @pie-players/pie-tool-protractor@0.3.29
  - @pie-players/pie-tool-ruler@0.3.29
  - @pie-players/pie-tool-text-to-speech@0.3.29
  - @pie-players/pie-tool-theme@0.3.29

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.28
  - @pie-players/pie-tool-answer-eliminator@0.3.28
  - @pie-players/pie-tool-calculator-desmos@0.3.28
  - @pie-players/pie-tool-graph@0.3.28
  - @pie-players/pie-tool-line-reader@0.3.28
  - @pie-players/pie-tool-periodic-table@0.3.28
  - @pie-players/pie-tool-protractor@0.3.28
  - @pie-players/pie-tool-ruler@0.3.28
  - @pie-players/pie-tool-text-to-speech@0.3.28
  - @pie-players/pie-tool-theme@0.3.28

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.27
  - @pie-players/pie-tool-answer-eliminator@0.3.27
  - @pie-players/pie-tool-calculator-desmos@0.3.27
  - @pie-players/pie-tool-graph@0.3.27
  - @pie-players/pie-tool-line-reader@0.3.27
  - @pie-players/pie-tool-periodic-table@0.3.27
  - @pie-players/pie-tool-protractor@0.3.27
  - @pie-players/pie-tool-ruler@0.3.27
  - @pie-players/pie-tool-text-to-speech@0.3.27
  - @pie-players/pie-tool-theme@0.3.27

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.26
  - @pie-players/pie-tool-answer-eliminator@0.3.26
  - @pie-players/pie-tool-calculator-desmos@0.3.26
  - @pie-players/pie-tool-graph@0.3.26
  - @pie-players/pie-tool-line-reader@0.3.26
  - @pie-players/pie-tool-periodic-table@0.3.26
  - @pie-players/pie-tool-protractor@0.3.26
  - @pie-players/pie-tool-ruler@0.3.26
  - @pie-players/pie-tool-text-to-speech@0.3.26
  - @pie-players/pie-tool-theme@0.3.26

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.25
  - @pie-players/pie-tool-answer-eliminator@0.3.25
  - @pie-players/pie-tool-calculator-desmos@0.3.25
  - @pie-players/pie-tool-graph@0.3.25
  - @pie-players/pie-tool-line-reader@0.3.25
  - @pie-players/pie-tool-periodic-table@0.3.25
  - @pie-players/pie-tool-protractor@0.3.25
  - @pie-players/pie-tool-ruler@0.3.25
  - @pie-players/pie-tool-text-to-speech@0.3.25
  - @pie-players/pie-tool-theme@0.3.25

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.25
  - @pie-players/pie-tool-answer-eliminator@0.3.25
  - @pie-players/pie-tool-calculator-desmos@0.3.25
  - @pie-players/pie-tool-graph@0.3.25
  - @pie-players/pie-tool-line-reader@0.3.25
  - @pie-players/pie-tool-periodic-table@0.3.25
  - @pie-players/pie-tool-protractor@0.3.25
  - @pie-players/pie-tool-ruler@0.3.25
  - @pie-players/pie-tool-text-to-speech@0.3.25
  - @pie-players/pie-tool-theme@0.3.25

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.24
  - @pie-players/pie-tool-answer-eliminator@0.3.24
  - @pie-players/pie-tool-calculator-desmos@0.3.24
  - @pie-players/pie-tool-graph@0.3.24
  - @pie-players/pie-tool-line-reader@0.3.24
  - @pie-players/pie-tool-periodic-table@0.3.24
  - @pie-players/pie-tool-protractor@0.3.24
  - @pie-players/pie-tool-ruler@0.3.24
  - @pie-players/pie-tool-text-to-speech@0.3.24
  - @pie-players/pie-tool-theme@0.3.24

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.23
  - @pie-players/pie-tool-answer-eliminator@0.3.23
  - @pie-players/pie-tool-calculator-desmos@0.3.23
  - @pie-players/pie-tool-graph@0.3.23
  - @pie-players/pie-tool-line-reader@0.3.23
  - @pie-players/pie-tool-periodic-table@0.3.23
  - @pie-players/pie-tool-protractor@0.3.23
  - @pie-players/pie-tool-ruler@0.3.23
  - @pie-players/pie-tool-text-to-speech@0.3.23
  - @pie-players/pie-tool-theme@0.3.23

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.22
  - @pie-players/pie-tool-answer-eliminator@0.3.22
  - @pie-players/pie-tool-calculator-desmos@0.3.22
  - @pie-players/pie-tool-graph@0.3.22
  - @pie-players/pie-tool-line-reader@0.3.22
  - @pie-players/pie-tool-periodic-table@0.3.22
  - @pie-players/pie-tool-protractor@0.3.22
  - @pie-players/pie-tool-ruler@0.3.22
  - @pie-players/pie-tool-text-to-speech@0.3.22
  - @pie-players/pie-tool-theme@0.3.22

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.21
  - @pie-players/pie-tool-answer-eliminator@0.3.21
  - @pie-players/pie-tool-calculator-desmos@0.3.21
  - @pie-players/pie-tool-graph@0.3.21
  - @pie-players/pie-tool-line-reader@0.3.21
  - @pie-players/pie-tool-periodic-table@0.3.21
  - @pie-players/pie-tool-protractor@0.3.21
  - @pie-players/pie-tool-ruler@0.3.21
  - @pie-players/pie-tool-text-to-speech@0.3.21
  - @pie-players/pie-tool-theme@0.3.21

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.20
  - @pie-players/pie-tool-answer-eliminator@0.3.20
  - @pie-players/pie-tool-calculator-desmos@0.3.20
  - @pie-players/pie-tool-graph@0.3.20
  - @pie-players/pie-tool-line-reader@0.3.20
  - @pie-players/pie-tool-periodic-table@0.3.20
  - @pie-players/pie-tool-protractor@0.3.20
  - @pie-players/pie-tool-ruler@0.3.20
  - @pie-players/pie-tool-text-to-speech@0.3.20
  - @pie-players/pie-tool-theme@0.3.20

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.19
  - @pie-players/pie-tool-answer-eliminator@0.3.19
  - @pie-players/pie-tool-calculator-desmos@0.3.19
  - @pie-players/pie-tool-graph@0.3.19
  - @pie-players/pie-tool-line-reader@0.3.19
  - @pie-players/pie-tool-periodic-table@0.3.19
  - @pie-players/pie-tool-protractor@0.3.19
  - @pie-players/pie-tool-ruler@0.3.19
  - @pie-players/pie-tool-text-to-speech@0.3.19
  - @pie-players/pie-tool-theme@0.3.19

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.18
  - @pie-players/pie-tool-answer-eliminator@0.3.18
  - @pie-players/pie-tool-calculator-desmos@0.3.18
  - @pie-players/pie-tool-graph@0.3.18
  - @pie-players/pie-tool-line-reader@0.3.18
  - @pie-players/pie-tool-periodic-table@0.3.18
  - @pie-players/pie-tool-protractor@0.3.18
  - @pie-players/pie-tool-ruler@0.3.18
  - @pie-players/pie-tool-text-to-speech@0.3.18
  - @pie-players/pie-tool-theme@0.3.18

## 0.3.17

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.17
  - @pie-players/pie-tool-answer-eliminator@0.3.17
  - @pie-players/pie-tool-calculator-desmos@0.3.17
  - @pie-players/pie-tool-graph@0.3.17
  - @pie-players/pie-tool-line-reader@0.3.17
  - @pie-players/pie-tool-periodic-table@0.3.17
  - @pie-players/pie-tool-protractor@0.3.17
  - @pie-players/pie-tool-ruler@0.3.17
  - @pie-players/pie-tool-text-to-speech@0.3.17
  - @pie-players/pie-tool-theme@0.3.17

## 0.3.16

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.16
  - @pie-players/pie-tool-answer-eliminator@0.3.16
  - @pie-players/pie-tool-calculator-desmos@0.3.16
  - @pie-players/pie-tool-graph@0.3.16
  - @pie-players/pie-tool-line-reader@0.3.16
  - @pie-players/pie-tool-periodic-table@0.3.16
  - @pie-players/pie-tool-protractor@0.3.16
  - @pie-players/pie-tool-ruler@0.3.16
  - @pie-players/pie-tool-text-to-speech@0.3.16
  - @pie-players/pie-tool-theme@0.3.16

## 0.3.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.15
  - @pie-players/pie-tool-answer-eliminator@0.3.15
  - @pie-players/pie-tool-calculator-desmos@0.3.15
  - @pie-players/pie-tool-graph@0.3.15
  - @pie-players/pie-tool-line-reader@0.3.15
  - @pie-players/pie-tool-periodic-table@0.3.15
  - @pie-players/pie-tool-protractor@0.3.15
  - @pie-players/pie-tool-ruler@0.3.15
  - @pie-players/pie-tool-text-to-speech@0.3.15
  - @pie-players/pie-tool-theme@0.3.15

## 0.3.14

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.14
  - @pie-players/pie-tool-answer-eliminator@0.3.14
  - @pie-players/pie-tool-calculator-desmos@0.3.14
  - @pie-players/pie-tool-graph@0.3.14
  - @pie-players/pie-tool-line-reader@0.3.14
  - @pie-players/pie-tool-periodic-table@0.3.14
  - @pie-players/pie-tool-protractor@0.3.14
  - @pie-players/pie-tool-ruler@0.3.14
  - @pie-players/pie-tool-text-to-speech@0.3.14
  - @pie-players/pie-tool-theme@0.3.14

## 0.3.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.13
  - @pie-players/pie-tool-answer-eliminator@0.3.13
  - @pie-players/pie-tool-calculator-desmos@0.3.13
  - @pie-players/pie-tool-graph@0.3.13
  - @pie-players/pie-tool-line-reader@0.3.13
  - @pie-players/pie-tool-periodic-table@0.3.13
  - @pie-players/pie-tool-protractor@0.3.13
  - @pie-players/pie-tool-ruler@0.3.13
  - @pie-players/pie-tool-text-to-speech@0.3.13
  - @pie-players/pie-tool-theme@0.3.13

## 0.3.12

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.12
  - @pie-players/pie-tool-answer-eliminator@0.3.12
  - @pie-players/pie-tool-calculator-desmos@0.3.12
  - @pie-players/pie-tool-graph@0.3.12
  - @pie-players/pie-tool-line-reader@0.3.12
  - @pie-players/pie-tool-periodic-table@0.3.12
  - @pie-players/pie-tool-protractor@0.3.12
  - @pie-players/pie-tool-ruler@0.3.12
  - @pie-players/pie-tool-text-to-speech@0.3.12
  - @pie-players/pie-tool-theme@0.3.12

## 0.3.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.11
  - @pie-players/pie-tool-answer-eliminator@0.3.11
  - @pie-players/pie-tool-calculator-desmos@0.3.11
  - @pie-players/pie-tool-graph@0.3.11
  - @pie-players/pie-tool-line-reader@0.3.11
  - @pie-players/pie-tool-periodic-table@0.3.11
  - @pie-players/pie-tool-protractor@0.3.11
  - @pie-players/pie-tool-ruler@0.3.11
  - @pie-players/pie-tool-text-to-speech@0.3.11
  - @pie-players/pie-tool-theme@0.3.11

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.10
  - @pie-players/pie-tool-answer-eliminator@0.3.10
  - @pie-players/pie-tool-calculator-desmos@0.3.10
  - @pie-players/pie-tool-graph@0.3.10
  - @pie-players/pie-tool-line-reader@0.3.10
  - @pie-players/pie-tool-periodic-table@0.3.10
  - @pie-players/pie-tool-protractor@0.3.10
  - @pie-players/pie-tool-ruler@0.3.10
  - @pie-players/pie-tool-text-to-speech@0.3.10
  - @pie-players/pie-tool-theme@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.9
  - @pie-players/pie-tool-answer-eliminator@0.3.9
  - @pie-players/pie-tool-calculator-desmos@0.3.9
  - @pie-players/pie-tool-graph@0.3.9
  - @pie-players/pie-tool-line-reader@0.3.9
  - @pie-players/pie-tool-periodic-table@0.3.9
  - @pie-players/pie-tool-protractor@0.3.9
  - @pie-players/pie-tool-ruler@0.3.9
  - @pie-players/pie-tool-text-to-speech@0.3.9
  - @pie-players/pie-tool-theme@0.3.9

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.10
  - @pie-players/pie-tool-answer-eliminator@0.3.10
  - @pie-players/pie-tool-calculator-desmos@0.3.10
  - @pie-players/pie-tool-graph@0.3.10
  - @pie-players/pie-tool-line-reader@0.3.10
  - @pie-players/pie-tool-periodic-table@0.3.10
  - @pie-players/pie-tool-protractor@0.3.10
  - @pie-players/pie-tool-ruler@0.3.10
  - @pie-players/pie-tool-text-to-speech@0.3.10
  - @pie-players/pie-tool-theme@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.9
  - @pie-players/pie-tool-answer-eliminator@0.3.9
  - @pie-players/pie-tool-calculator-desmos@0.3.9
  - @pie-players/pie-tool-graph@0.3.9
  - @pie-players/pie-tool-line-reader@0.3.9
  - @pie-players/pie-tool-periodic-table@0.3.9
  - @pie-players/pie-tool-protractor@0.3.9
  - @pie-players/pie-tool-ruler@0.3.9
  - @pie-players/pie-tool-text-to-speech@0.3.9
  - @pie-players/pie-tool-theme@0.3.9

## 0.3.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.8
  - @pie-players/pie-tool-answer-eliminator@0.3.8
  - @pie-players/pie-tool-calculator-desmos@0.3.8
  - @pie-players/pie-tool-graph@0.3.8
  - @pie-players/pie-tool-line-reader@0.3.8
  - @pie-players/pie-tool-periodic-table@0.3.8
  - @pie-players/pie-tool-protractor@0.3.8
  - @pie-players/pie-tool-ruler@0.3.8
  - @pie-players/pie-tool-text-to-speech@0.3.8
  - @pie-players/pie-tool-theme@0.3.8

## 0.3.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.7
  - @pie-players/pie-tool-answer-eliminator@0.3.7
  - @pie-players/pie-tool-calculator-desmos@0.3.7
  - @pie-players/pie-tool-graph@0.3.7
  - @pie-players/pie-tool-line-reader@0.3.7
  - @pie-players/pie-tool-periodic-table@0.3.7
  - @pie-players/pie-tool-protractor@0.3.7
  - @pie-players/pie-tool-ruler@0.3.7
  - @pie-players/pie-tool-text-to-speech@0.3.7
  - @pie-players/pie-tool-theme@0.3.7

## 0.3.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.6
  - @pie-players/pie-tool-answer-eliminator@0.3.6
  - @pie-players/pie-tool-calculator-desmos@0.3.6
  - @pie-players/pie-tool-graph@0.3.6
  - @pie-players/pie-tool-line-reader@0.3.6
  - @pie-players/pie-tool-periodic-table@0.3.6
  - @pie-players/pie-tool-protractor@0.3.6
  - @pie-players/pie-tool-ruler@0.3.6
  - @pie-players/pie-tool-text-to-speech@0.3.6
  - @pie-players/pie-tool-theme@0.3.6

## 0.3.5

### Patch Changes

- Publish a patch release for all publishable pie-players packages.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.5
  - @pie-players/pie-tool-answer-eliminator@0.3.5
  - @pie-players/pie-tool-calculator-desmos@0.3.5
  - @pie-players/pie-tool-theme@0.3.5
  - @pie-players/pie-tool-graph@0.3.5
  - @pie-players/pie-tool-line-reader@0.3.5
  - @pie-players/pie-tool-periodic-table@0.3.5
  - @pie-players/pie-tool-protractor@0.3.5
  - @pie-players/pie-tool-ruler@0.3.5
  - @pie-players/pie-tool-text-to-speech@0.3.5

## 0.3.4

### Patch Changes

- @pie-players/pie-tool-annotation-toolbar@0.3.4
- @pie-players/pie-tool-answer-eliminator@0.3.4
- @pie-players/pie-tool-calculator-desmos@0.3.4
- @pie-players/pie-tool-theme@0.3.4
- @pie-players/pie-tool-graph@0.3.4
- @pie-players/pie-tool-line-reader@0.3.4
- @pie-players/pie-tool-periodic-table@0.3.4
- @pie-players/pie-tool-protractor@0.3.4
- @pie-players/pie-tool-ruler@0.3.4
- @pie-players/pie-tool-text-to-speech@0.3.4

## 0.3.3

### Patch Changes

- Prepare a patch release for the latest framework fixes, math-rendering hardening, and packaging safety improvements.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.3
  - @pie-players/pie-tool-answer-eliminator@0.3.3
  - @pie-players/pie-tool-calculator@0.3.3
  - @pie-players/pie-tool-graph@0.3.3
  - @pie-players/pie-tool-line-reader@0.3.3
  - @pie-players/pie-tool-periodic-table@0.3.3
  - @pie-players/pie-tool-protractor@0.3.3
  - @pie-players/pie-tool-ruler@0.3.3
  - @pie-players/pie-tool-text-to-speech@0.3.3
  - @pie-players/pie-tool-theme@0.3.3

## 0.3.2

### Patch Changes

- @pie-players/pie-tool-annotation-toolbar@0.3.2
- @pie-players/pie-tool-answer-eliminator@0.3.2
- @pie-players/pie-tool-calculator@0.3.2
- @pie-players/pie-tool-theme@0.3.2
- @pie-players/pie-tool-graph@0.3.2
- @pie-players/pie-tool-line-reader@0.3.2
- @pie-players/pie-tool-periodic-table@0.3.2
- @pie-players/pie-tool-protractor@0.3.2
- @pie-players/pie-tool-ruler@0.3.2
- @pie-players/pie-tool-text-to-speech@0.3.2

## 0.3.1

### Patch Changes

- @pie-players/pie-tool-annotation-toolbar@0.3.1
- @pie-players/pie-tool-answer-eliminator@0.3.1
- @pie-players/pie-tool-calculator@0.3.1
- @pie-players/pie-tool-theme@0.3.1
- @pie-players/pie-tool-graph@0.3.1
- @pie-players/pie-tool-line-reader@0.3.1
- @pie-players/pie-tool-periodic-table@0.3.1
- @pie-players/pie-tool-protractor@0.3.1
- @pie-players/pie-tool-ruler@0.3.1
- @pie-players/pie-tool-text-to-speech@0.3.1

## 0.3.0

### Minor Changes

- Adopt monorepo-wide fixed versioning and establish the first lockstep release train at 0.3.0.

### Patch Changes

- 9385ce0: Release all publishable packages in the repository.

  This intentionally triggers a full patch release sweep across all non-private workspace packages.

- Updated dependencies
- Updated dependencies [9385ce0]
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

## 0.1.2

### Patch Changes

- beffcc0: Release all publishable packages.
- Updated dependencies [beffcc0]
  - @pie-players/pie-tool-annotation-toolbar@0.1.10
  - @pie-players/pie-tool-answer-eliminator@0.2.10
  - @pie-players/pie-tool-calculator@0.1.10
  - @pie-players/pie-tool-graph@0.1.10
  - @pie-players/pie-tool-line-reader@0.1.10
  - @pie-players/pie-tool-periodic-table@0.1.10
  - @pie-players/pie-tool-protractor@0.1.10
  - @pie-players/pie-tool-ruler@0.1.10
  - @pie-players/pie-tool-text-to-speech@0.1.10
  - @pie-players/pie-tool-theme@0.1.10

## 0.1.1

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
- Updated dependencies [71a9581]
  - @pie-players/pie-tool-annotation-toolbar@0.1.9
  - @pie-players/pie-tool-answer-eliminator@0.2.9
  - @pie-players/pie-tool-calculator@0.1.9
  - @pie-players/pie-tool-color-scheme@0.1.9
  - @pie-players/pie-tool-graph@0.1.9
  - @pie-players/pie-tool-line-reader@0.1.9
  - @pie-players/pie-tool-periodic-table@0.1.9
  - @pie-players/pie-tool-protractor@0.1.9
  - @pie-players/pie-tool-ruler@0.1.9
  - @pie-players/pie-tool-text-to-speech@0.1.9
