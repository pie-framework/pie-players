# @pie-players/pie-section-player-tools-pnp-debugger

## 0.3.69

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.69
  - @pie-players/pie-players-shared@0.3.69
  - @pie-players/pie-section-player-tools-shared@0.3.69
  - @pie-players/pie-theme@0.3.69

## 0.3.68

### Patch Changes

- 951c222: Put the debug and inspection panels on the `--pie-*` contract.
  
  Every panel read DaisyUI's own `--color-*` slots — `--color-base-100`,
  `--color-base-200`, `--color-base-300`, `--color-base-content`, `--color-primary`
  and the state slots. That is the supported flow reversed: DaisyUI is meant to feed
  `--pie-*` through pie-theme's provider, and a component reading the slots directly
  follows the host's DaisyUI palette, or its own light literals where the host has
  none, but never the colour scheme the tester selected. Inspecting a section under
  White on Black meant a white panel over a dark page. Several surfaces were mixed
  toward `white` explicitly, so they stayed light however the slot resolved.
  
  Panel surfaces are now `--pie-text` on `--pie-background-dark`, the pair the
  contract certifies for a recessed surface. Not `--pie-background`, which is what
  `--color-base-100` maps to: a floating panel needs an opaque surface, and the light
  Base Theme sets `--pie-background` to `rgba(255, 255, 255, 0)` so a host's own
  backdrop shows through. Panel chrome — headers, buttons, tabs, table headers, code
  blocks — takes the `--pie-button-*` family, with `--pie-button-active-bg` kept
  paired with `--pie-button-color` since that is the only ink certified against it.
  
  Selected and destructive states moved from tinted fills to the boundary, so labels
  sit on a certified pair: `--pie-incorrect` for destructive, `--pie-missing` for
  warning, `--pie-tertiary` for informational, each of which clears 4.5:1 against the
  page on every scheme and so passes the 3:1 a boundary owes. Two literals stay by
  design and are documented where they sit: drop shadows, and the TTS modal's scrim,
  which recedes the page behind it and would wash it out if it followed an ink that
  inverts to white under a dark scheme.
  
  A source guard holds the boundary — no panel may read a DaisyUI slot or paint a
  colour with no `--pie-*` token — and a Playwright case checks that the tokens
  resolve to something legible once a panel is mounted in a themed page. Its
  load-bearing assertion is that the surface differs between a light and a dark
  scheme: the contrast ratios passed on the old version too, because the panel was
  white on both.
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
- 54742db: A second full-codebase review turned up more drift, duplication, and interface
  problems than the first sweep caught, concentrated in the TTS provider stack and
  the debugger-tool family. No public surface changes; behaviour fixes are called
  out explicitly.
  
  **TTS rate and pitch.** Polly and Google both advertised `supportsRate` /
  `supportsPitch` while never reading `request.rate` / `request.pitch` — a caller
  asking for a different speech rate got normal-speed audio with no error.
  `BaseTTSProvider.applyProsody` / `buildProsodyAttrs` now wrap plain-text requests
  in an SSML `<prosody>` envelope on both providers; already-SSML input is left
  alone. `pitch` follows this repo's existing 0-2 multiplier convention (the TTS
  settings UI's `normalizePitch`), converted to SSML's relative percentage form.
  
  **SchoolCity speech-mark timing.** `tts-client-server`'s custom-transport parser
  reimplemented SchoolCity's JSONL wire format from scratch, with none of the
  offset/time-unit corrections `SchoolCityServerProvider` applies — reproducing the
  mistiming bug that correction was built to fix. `normalizeSpeechMarks` moves to
  `tts-server-core` so both share one implementation.
  
  **TTS error-mapping granularity.** Polly collapsed every AWS SDK error to
  `PROVIDER_ERROR`; SchoolCity did the same for every HTTP failure. Both now map
  to `TEXT_TOO_LONG` / `INVALID_REQUEST` / `RATE_LIMIT_EXCEEDED` /
  `AUTHENTICATION_ERROR` where the underlying exception name or HTTP status
  says so, matching the granularity Google already had. A documented consumer maps
  these four `TTSErrorCode` members onto HTTP responses, so Polly's
  `TextLengthExceededException` reaching `TEXT_TOO_LONG` is newly correct handling
  on a path that previously always fell through to a generic error.
  
  **Rate-to-speedRate bucketing.** `SchoolCityServerProvider` and
  `ServerTTSProvider` each bucketed a numeric rate into `slow`/`medium`/`fast`
  with different thresholds, disagreeing for rate 1.1-1.49.
  `resolveSpeedRateBucket` in `tts-server-core` is now the one implementation,
  on the server's deliberate 0.95-1.5 tolerance band.
  
  **Shadow-DOM-blind theme lookup.** `tool-color-scheme`'s host lookup called
  `closest('pie-theme')` from inside its own open shadow root, which
  `Element.closest()` can never cross — on any page with more than one
  independently-scoped `<pie-theme>` it silently always picked the wrong one.
  `resolvePieThemeHost` in `pie-theme` walks out through each shadow root's host
  to find the real ancestor. The same change adds `applyPieColorScheme` as the one
  canonical "resolve host, set scheme, persist" sequence, replacing both
  `tool-color-scheme`'s own copy and `apps/section-demos`' independently-drifted
  version.
  
  **Debugger-panel subscription lifecycle.** `EventPanel` and `SectionSessionPanel`
  each reimplemented the same subscribe/detach/resubscribe scaffolding;
  `SectionSessionPanel`'s read and wrote reactive state directly inside a tracked
  `$effect` body instead of wrapping it in `untrack()`, and its lifecycle handler
  always resubscribed instead of distinguishing the disposed and same-target cases
  `EventPanel` already handled. `createSectionControllerSubscriptionManager` in
  `section-player-tools-shared` is now shared by both. The same change wires
  `persistence-scope` / `persistence-panel-id` through for `PnpPanel` and
  `SectionSessionPanel`, which had neither despite `SharedFloatingPanel` supporting
  layout persistence and two sibling debuggers already exposing it.
  
  **Pointer-drag tracking.** `tool-line-reader` and `tool-text-to-speech` each
  hand-rolled identical pointer-capture drag-position tracking.
  `createPointerDragController` in `players-shared/ui` covers the shared position
  math; `tool-line-reader`'s separate resize handling stays where it is.
  
  **Custom-element registration.** `pie-print` bypassed its own package's guarded
  registry and called Lit's `@customElement` decorator directly, which throws an
  uncaught `NotSupportedError` on double-bundling where every other player
  no-ops. It now goes through the same guard. `defineCustomElementSafely`
  (players-shared) and print-player's registry also shared the same
  duplicate-define handling with different collision coverage; consolidated into
  one implementation, which incidentally fixes a latent bug where an
  already-registered tag not tracked locally hit a doomed wrapped-subclass retry
  instead of short-circuiting.
  
  **Everything else.** `coerceBooleanLike` had three different, disagreeing
  implementations across `section-player` and `assessment-player` for the same
  attribute-coercion job; unified in `players-shared`. `sanitize-item-markup` and
  `sanitize-svg-icon`'s DOMPurify forbid-lists had drifted despite a comment
  claiming parity; now share one list. `AssessmentPlayerDefaultElement` swallowed
  TTS teardown errors in empty catch blocks instead of reporting them through
  `ToolkitCoordinator.reportFrameworkError`. `item-player`'s `"player-error"` event
  now has an exported constant matching the pattern `section-player` and
  `assessment-player` already use (no wire-value change).
- Updated dependencies [2d8ce6a]
- Updated dependencies [27284f8]
- Updated dependencies [e94b097]
- Updated dependencies [951c222]
- Updated dependencies [67a3d7e]
- Updated dependencies [d68c01b]
- Updated dependencies [3f5e968]
- Updated dependencies [27284f8]
- Updated dependencies [67f286c]
- Updated dependencies [55016b5]
- Updated dependencies [89688fc]
- Updated dependencies [fc71c91]
- Updated dependencies [e94b097]
- Updated dependencies [00b8a71]
- Updated dependencies [6e1e053]
- Updated dependencies [e94b097]
- Updated dependencies [7c9fb28]
- Updated dependencies [979e643]
- Updated dependencies [1d9f2d3]
- Updated dependencies [c9e3404]
- Updated dependencies [e94b097]
- Updated dependencies [27284f8]
- Updated dependencies [9d3c500]
- Updated dependencies [5a13755]
- Updated dependencies [e0f1134]
- Updated dependencies [54742db]
- Updated dependencies [f61c7c7]
- Updated dependencies [0dc9c96]
- Updated dependencies [cb11691]
- Updated dependencies [4f0cb3f]
- Updated dependencies [e94b097]
  - @pie-players/pie-players-shared@0.3.68
  - @pie-players/pie-assessment-toolkit@0.3.68
  - @pie-players/pie-section-player-tools-shared@0.3.68
  - @pie-players/pie-theme@0.3.68

## 0.3.67

### Patch Changes

- Updated dependencies [73d2be4]
- Updated dependencies [73d2be4]
- Updated dependencies [fe9b4f0]
- Updated dependencies [61d6aa0]
  - @pie-players/pie-theme@0.3.67
  - @pie-players/pie-assessment-toolkit@0.3.67
  - @pie-players/pie-section-player-tools-shared@0.3.67

## 0.3.66

### Patch Changes

- 9a183cf: A feature decision reports whether an assessment was bound, so a host that never bound one is distinguishable from a profile that grants nothing.

  Both produced `Feature "X" not configured at any level`. The first is a wiring gap and the second is a correct denial, and a deployment that forgot to supply a profile therefore looked exactly like a student who was properly declined — which is how it went unnoticed that Quiz Engine's fixed player, which takes a coordinator from `toolkit-ready` and configures tools through it but never calls `updateAssessment`, cannot deliver signing or a transcript at all.

  ## `FeaturePolicyDecision.assessmentBound`

  The engine already held the discriminant and threw it away: `decideFeature` passes the assessment to `PnpPolicySource.resolveFeature` as `undefined` whether the host bound nothing or bound something silent, so the source cannot tell and the engine can. A denial with nothing bound now carries its own reason in place of the six-level one.

  `granted`, `action`, `rule` and `precedence` are unchanged. Fail-closed is the correct behaviour and stays: an accommodation requires a documented need, and an absent profile documents nothing. Naming a seventh rule was the alternative and would have described a precedence level that does not exist — nothing fired, which is the point.

  `assessmentBound: false` is not a synonym for denied. An item ref carrying `requiredTools` mandates a feature at precedence 4 with no assessment in sight, and there the source's own reason survives. Read it alongside `granted`.

  A bound assessment carrying no profile material is deliberately `true`. A test that grants nobody an accommodation is legitimate configuration; never binding one cannot be, since there is nothing to deliver.

  ## One report per coordinator

  `decideFeaturePolicy` warns the first time it is asked about a feature with nothing bound, naming `updateAssessment` and the three fields policy reads. A feature policy is consulted once per capability per card, so a per-decision warning would bury itself; it is never re-armed, because binding an assessment later is the fix rather than a new occurrence.

  ## PNP debugger

  The panel reads the binding from `getPolicyInputs()` — which it previously narrowed to `pnpEnforcement` alone — and shows a card above the determination when nothing is bound, saying that the accommodations below are declined for want of a profile rather than by a verdict. A coordinator that exposes no inputs leaves it unstated: "cannot tell" must not read as "nothing is bound".

- Updated dependencies [556c422]
- Updated dependencies [2a741c6]
- Updated dependencies [5e6fcde]
- Updated dependencies [e8a6f0e]
- Updated dependencies [2bcd9fa]
- Updated dependencies [6bbfae1]
- Updated dependencies [1e0c10f]
- Updated dependencies [2bcd9fa]
- Updated dependencies [2bcd9fa]
- Updated dependencies [e8a6f0e]
- Updated dependencies [a4beb70]
- Updated dependencies [1f29de7]
- Updated dependencies [5e6fcde]
- Updated dependencies [5f133be]
- Updated dependencies [9a183cf]
  - @pie-players/pie-assessment-toolkit@0.3.66
  - @pie-players/pie-theme@0.3.66
  - @pie-players/pie-section-player-tools-shared@0.3.66

## 0.3.65

### Patch Changes

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
- Updated dependencies [c4c3aca]
- Updated dependencies [2b015a9]
- Updated dependencies [411b2cd]
- Updated dependencies [f0d5802]
- Updated dependencies [f588924]
- Updated dependencies [3f6e33a]
- Updated dependencies [3972f16]
- Updated dependencies [5183654]
- Updated dependencies [c59396b]
  - @pie-players/pie-theme@0.3.65
  - @pie-players/pie-assessment-toolkit@0.3.65
  - @pie-players/pie-section-player-tools-shared@0.3.65

## 0.3.64

### Patch Changes

- Updated dependencies [82118ce]
- Updated dependencies [9b2f37d]
- Updated dependencies [acee584]
- Updated dependencies [9b2f37d]
- Updated dependencies [5749bc1]
- Updated dependencies [dc44392]
- Updated dependencies [82edb28]
- Updated dependencies [a5241b9]
- Updated dependencies [0dcec2e]
- Updated dependencies [acee584]
- Updated dependencies [25511d7]
- Updated dependencies [bbcabc0]
- Updated dependencies [30baec4]
  - @pie-players/pie-assessment-toolkit@0.3.64
  - @pie-players/pie-theme@0.3.64
  - @pie-players/pie-section-player-tools-shared@0.3.64

## 0.3.63

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.63
- @pie-players/pie-section-player-tools-shared@0.3.63
- @pie-players/pie-theme@0.3.63

## 0.3.62

### Patch Changes

- 99929d8: Move debugger panel styling out of the shared content stylesheet and into the panels that own it.

  `components.css` carried a `SECTION PLAYER DEBUGGER OVERLAYS` block styling the PNP
  and session debugger panels. That file is for authored-content classes no component
  owns, so panel-private rules did not belong in it, and the split was already
  inconsistent: each panel defined most of its own classes locally and left a handful
  behind.

  Those rules now live in each panel's own `<style>` block. The two classes applied by
  `SharedFloatingPanel` rather than by the panel template — the panel root and
  `__content-shell` — are wrapped in `:global()`, since Svelte would otherwise scope
  them to the panel component and they would match nothing.

  Of the 37 classes in the removed block, 14 were referenced nowhere at all
  (`__header*`, `__title`, `__icon-button`, `__icon-xs`, `__resize-*`) — leftovers from
  before `SharedFloatingPanel` renamed those parts to `pie-shared-floating-panel__*`.
  They were deleted rather than relocated.

  Five panels also dropped a `@pie-players/pie-theme/components.css` import that never
  did anything: these packages build with Vite in library mode, so the import was
  extracted to a `dist` CSS file that the built JS never referenced and that no
  `exports` entry exposed — the same defect fixed for `PieItemPlayer.svelte`. Each
  package now ships one fewer dead file.

  If you import `@pie-players/pie-theme/components.css` directly and relied on the
  `pie-section-player-tools-{pnp,session}-debugger*` classes it used to define, they are
  no longer there; they ship with their panel packages instead.

- Updated dependencies [c73c995]
- Updated dependencies [c73c995]
- Updated dependencies [507b56f]
- Updated dependencies [14666b3]
- Updated dependencies [99929d8]
- Updated dependencies [a1edde5]
- Updated dependencies [7864f66]
- Updated dependencies [3b4e461]
- Updated dependencies [7605500]
- Updated dependencies [c810459]
  - @pie-players/pie-assessment-toolkit@0.3.62
  - @pie-players/pie-theme@0.3.62
  - @pie-players/pie-section-player-tools-shared@0.3.62

## 0.3.61

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.61
- @pie-players/pie-section-player-tools-shared@0.3.61
- @pie-players/pie-theme@0.3.61

## 0.3.60

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.60
- @pie-players/pie-section-player-tools-shared@0.3.60
- @pie-players/pie-theme@0.3.60

## 0.3.59

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.59
  - @pie-players/pie-section-player-tools-shared@0.3.59
  - @pie-players/pie-theme@0.3.59

## 0.3.58

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.58
- @pie-players/pie-section-player-tools-shared@0.3.58
- @pie-players/pie-theme@0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.57
  - @pie-players/pie-section-player-tools-shared@0.3.57
  - @pie-players/pie-theme@0.3.57

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.56
  - @pie-players/pie-section-player-tools-shared@0.3.56
  - @pie-players/pie-theme@0.3.56

## 0.3.55

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.55
- @pie-players/pie-section-player-tools-shared@0.3.55
- @pie-players/pie-theme@0.3.55

## 0.3.54

### Patch Changes

- Updated dependencies [bead424]
  - @pie-players/pie-assessment-toolkit@0.3.54
  - @pie-players/pie-section-player-tools-shared@0.3.54
  - @pie-players/pie-theme@0.3.54

## 0.3.53

### Patch Changes

- Updated dependencies [ee6c081]
  - @pie-players/pie-theme@0.3.53
  - @pie-players/pie-section-player-tools-shared@0.3.53
  - @pie-players/pie-assessment-toolkit@0.3.53

## 0.3.52

### Patch Changes

- Updated dependencies [905080d]
  - @pie-players/pie-assessment-toolkit@0.3.52
  - @pie-players/pie-section-player-tools-shared@0.3.52
  - @pie-players/pie-theme@0.3.52

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.51
  - @pie-players/pie-section-player-tools-shared@0.3.51
  - @pie-players/pie-theme@0.3.51

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.50
  - @pie-players/pie-section-player-tools-shared@0.3.50
  - @pie-players/pie-theme@0.3.50

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.49
  - @pie-players/pie-section-player-tools-shared@0.3.49
  - @pie-players/pie-theme@0.3.49

## 0.3.48

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.48
  - @pie-players/pie-section-player-tools-shared@0.3.48
  - @pie-players/pie-theme@0.3.48

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.47
  - @pie-players/pie-section-player-tools-shared@0.3.47
  - @pie-players/pie-theme@0.3.47

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.46
  - @pie-players/pie-section-player-tools-shared@0.3.46
  - @pie-players/pie-theme@0.3.46

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
- Updated dependencies [fd140a3]
  - @pie-players/pie-assessment-toolkit@0.3.45
  - @pie-players/pie-section-player-tools-shared@0.3.45
  - @pie-players/pie-theme@0.3.45

## 0.3.44

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.44
  - @pie-players/pie-section-player-tools-shared@0.3.44
  - @pie-players/pie-theme@0.3.44

## 0.3.42

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [6496dda]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.42
  - @pie-players/pie-section-player-tools-shared@0.3.42
  - @pie-players/pie-theme@0.3.42

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.41
  - @pie-players/pie-section-player-tools-shared@0.3.41
  - @pie-players/pie-theme@0.3.41

## 0.3.40

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.40
  - @pie-players/pie-section-player-tools-shared@0.3.40
  - @pie-players/pie-theme@0.3.40

## 0.3.39

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0072fad]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.39
  - @pie-players/pie-section-player-tools-shared@0.3.39
  - @pie-players/pie-theme@0.3.39

## 0.3.38

### Patch Changes

- ef29724: Rename generic QTI policy APIs and diagnostics to PNP/profile terminology, including the built-in policy source, default enforcement helpers, provenance tags, and required-tool diagnostics.

  Enhance the editable PNP debugger and section demos so hosts can exercise all available tools and PNP/profile enforcement behavior end-to-end.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [ef29724]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.38
  - @pie-players/pie-section-player-tools-shared@0.3.38
  - @pie-players/pie-theme@0.3.38

## 0.3.37

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [2818f93]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.37
  - @pie-players/pie-section-player-tools-shared@0.3.37
  - @pie-players/pie-theme@0.3.37

## 0.3.36

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [9ef211c]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.36
  - @pie-players/pie-section-player-tools-shared@0.3.36
  - @pie-players/pie-theme@0.3.36

## 0.3.35

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [286418e]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.35
  - @pie-players/pie-section-player-tools-shared@0.3.35
  - @pie-players/pie-theme@0.3.35

## 0.3.34

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [af850c0]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.34
  - @pie-players/pie-section-player-tools-shared@0.3.34
  - @pie-players/pie-theme@0.3.34

## 0.3.33

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [70612af]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.33
  - @pie-players/pie-section-player-tools-shared@0.3.33
  - @pie-players/pie-theme@0.3.33

## 0.3.32

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0355143]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.32
  - @pie-players/pie-section-player-tools-shared@0.3.32
  - @pie-players/pie-theme@0.3.32

## 0.3.31

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [26dbea3]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.31
  - @pie-players/pie-section-player-tools-shared@0.3.31
  - @pie-players/pie-theme@0.3.31

## 0.3.30

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.30
  - @pie-players/pie-section-player-tools-shared@0.3.30
  - @pie-players/pie-theme@0.3.30

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.29
  - @pie-players/pie-section-player-tools-shared@0.3.29
  - @pie-players/pie-theme@0.3.29

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.28
  - @pie-players/pie-section-player-tools-shared@0.3.28
  - @pie-players/pie-theme@0.3.28

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.27
  - @pie-players/pie-section-player-tools-shared@0.3.27
  - @pie-players/pie-theme@0.3.27

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.26
  - @pie-players/pie-section-player-tools-shared@0.3.26
  - @pie-players/pie-theme@0.3.26

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.25
  - @pie-players/pie-section-player-tools-shared@0.3.25
  - @pie-players/pie-theme@0.3.25

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.25
  - @pie-players/pie-section-player-tools-shared@0.3.25
  - @pie-players/pie-theme@0.3.25

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.24
  - @pie-players/pie-section-player-tools-shared@0.3.24
  - @pie-players/pie-theme@0.3.24

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.23
  - @pie-players/pie-section-player-tools-shared@0.3.23
  - @pie-players/pie-theme@0.3.23

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.22
  - @pie-players/pie-section-player-tools-shared@0.3.22
  - @pie-players/pie-theme@0.3.22

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.21
  - @pie-players/pie-section-player-tools-shared@0.3.21
  - @pie-players/pie-theme@0.3.21

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.20
  - @pie-players/pie-section-player-tools-shared@0.3.20
  - @pie-players/pie-theme@0.3.20

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.19
  - @pie-players/pie-section-player-tools-shared@0.3.19
  - @pie-players/pie-theme@0.3.19

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.18
  - @pie-players/pie-section-player-tools-shared@0.3.18
  - @pie-players/pie-theme@0.3.18

## 0.3.17

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.17
  - @pie-players/pie-section-player-tools-shared@0.3.17
  - @pie-players/pie-theme@0.3.17

## 0.3.16

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.16
  - @pie-players/pie-section-player-tools-shared@0.3.16
  - @pie-players/pie-theme@0.3.16

## 0.3.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.15
  - @pie-players/pie-section-player-tools-shared@0.3.15
  - @pie-players/pie-theme@0.3.15

## 0.3.14

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.14
  - @pie-players/pie-section-player-tools-shared@0.3.14
  - @pie-players/pie-theme@0.3.14

## 0.3.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.13
  - @pie-players/pie-section-player-tools-shared@0.3.13
  - @pie-players/pie-theme@0.3.13

## 0.3.12

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.12
  - @pie-players/pie-section-player-tools-shared@0.3.12
  - @pie-players/pie-theme@0.3.12

## 0.3.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.11
  - @pie-players/pie-section-player-tools-shared@0.3.11
  - @pie-players/pie-theme@0.3.11

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.10
  - @pie-players/pie-section-player-tools-shared@0.3.10
  - @pie-players/pie-theme@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.9
  - @pie-players/pie-section-player-tools-shared@0.3.9
  - @pie-players/pie-theme@0.3.9

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.10
  - @pie-players/pie-section-player-tools-shared@0.3.10
  - @pie-players/pie-theme@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.9
  - @pie-players/pie-section-player-tools-shared@0.3.9
  - @pie-players/pie-theme@0.3.9

## 0.3.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.8
  - @pie-players/pie-section-player-tools-shared@0.3.8
  - @pie-players/pie-theme@0.3.8

## 0.3.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.7
  - @pie-players/pie-section-player-tools-shared@0.3.7
  - @pie-players/pie-theme@0.3.7

## 0.3.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.6
  - @pie-players/pie-section-player-tools-shared@0.3.6
  - @pie-players/pie-theme@0.3.6

## 0.3.5

### Patch Changes

- Publish a patch release for all publishable pie-players packages.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.5
  - @pie-players/pie-section-player-tools-shared@0.3.5
  - @pie-players/pie-theme@0.3.5

## 0.3.4

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.4
  - @pie-players/pie-section-player-tools-shared@0.3.4
  - @pie-players/pie-theme@0.3.4

## 0.3.3

### Patch Changes

- Prepare a patch release for the latest framework fixes, math-rendering hardening, and packaging safety improvements.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.3
  - @pie-players/pie-theme@0.3.3

## 0.3.2

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.2
  - @pie-players/pie-theme@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.1
  - @pie-players/pie-theme@0.3.1

## 0.3.0

### Minor Changes

- Adopt monorepo-wide fixed versioning and establish the first lockstep release train at 0.3.0.

### Patch Changes

- 9385ce0: Release all publishable packages in the repository.

  This intentionally triggers a full patch release sweep across all non-private workspace packages.

- Updated dependencies
- Updated dependencies [9385ce0]
  - @pie-players/pie-assessment-toolkit@0.3.0
  - @pie-players/pie-theme@0.3.0

## 0.1.2

### Patch Changes

- beffcc0: Release all publishable packages.
- Updated dependencies [beffcc0]
  - @pie-players/pie-assessment-toolkit@0.2.10
  - @pie-players/pie-theme@0.1.2

## 0.1.1

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
- Updated dependencies [71a9581]
  - @pie-players/pie-assessment-toolkit@0.2.9
