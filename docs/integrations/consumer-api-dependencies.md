# Consumer API dependencies

A scratch pad of which `@pie-players` surfaces downstream hosts actually touch,
so a proposed change can be checked against real usage before it ships. It
answers one question: *if I change this, who breaks?*

This is not a contract. The contract is the code and the files cited per row.
The pad records observed usage at a point in time and goes stale; refresh it as
described at the end.

Consumers are identified by integration shape, not by repository, product, or
ticket. This repository is public and the hosts are not, so nothing here names
them, quotes their code, or records their endpoints, config keys, tenants, or
business logic. Keep it that way when editing. The label-to-checkout mapping
lives per-machine in the gitignored `.claude/consumer-checkouts.local.json`; the
`consumer-dependency-audit` skill reads it, and asks for anything missing.

Last verified against consumer checkouts and this repo's `develop` line:
**2026-08-19** for every Host R row, re-derived from that checkout and checked
against `origin/develop` at `@pie-players` 0.3.68. Host V and Host A rows carry
**2026-08-16**, scoped to the i18n surfaces described below, and their earlier
verification before that.

The Host R refresh replaced rows that had passed from unverified to wrong. Its
theme fork is gone: it declares no `--pie-*` value, imports `tokens.css`, and
drives one document-scoped `<pie-theme>` whose resolver supplies every scheme
token. So is its registry `override` chain, its diagnostic-code branch, and the
`listPieColorSchemes()` migration debt. `disposeSectionController`,
`pie-stage-change`, `ToolRegistry.getAllTools`, `decideFeaturePolicy`, a
ten-property `pie-item-player` surface, five debugger custom-element prop sets
and a host-served dictionary wire contract are new. Each section below carries
its own detail.

A duplication sweep checked four public surfaces — the toolkit's
`DesmosCalculatorProvider`, the two TTS config shapes, `AuthoringValidationResult`,
and the `highlighter` capability id — against all three checkouts on 2026-08-18,
and recorded them below. That was a targeted lookup rather than a re-derivation, so
it does not advance the verification date; every other row still carries its
earlier one.

Content stylesheet delivery was re-checked against all three checkouts on
2026-08-19: the installing code shipped in the `0.3.61` tarball even though its
changelog entry sits under `0.3.62`, so `0.3.61` is the threshold a host is
above or below; Host A has since dropped its build-config `components.css`
entry and its dead `pie-theme-daisyui` dependency, moving it out of the
duplicate-load state into the healthy one; and Host A and Host R both now
resolve `^0.3.68` rather than
the ranges previously recorded. This was a targeted correction of that one
surface, not a full re-derivation, so it does not advance the verification
date either.

The Tool Surface Host refactor updated the in-repo contract notes without a new
consumer-checkout refresh at the time. It preserves the client-facing
section-player tag hierarchy and CSS hooks recorded below. The additive
`ToolRegistry.onRegistryChange` method and `FrameworkErrorKind: "tool-surface"`
member are called by no host — re-derived for Host R on 2026-08-19, and still
absent there. `register` keeps its signature and Host R is now its only caller;
`override` and unregister have no caller in any checkout.

The owner-aware catalog refactor was assessed against the recorded rows rather
than a checkout. Host A's inline TTS still uses the same `data-catalog-idref`
lookup, scoped context, direct resolver path, and fallback behavior. No recorded
host imports the removed catalog-collection helper or constructs
`ToolContentDependencyContext`; those are capability authoring surfaces. Root
`ToolkitCoordinator`, resolver, registry, runtime, and custom-element signatures
observed below remain unchanged.

The theming pass that routed the content stylesheet, the vendored NDS button
palette and the remaining tool chrome through canonical tokens was assessed
against the recorded rows, not against a fresh consumer-checkout refresh, and
does not advance the verification date. It changes values behind existing token
names; no token name, selector, `dist` filename, custom-element tag, attribute
or prop type changed, and content-style delivery is untouched. Host A keeps
owning the tool-shell header through
`--pie-section-player-card-header-background`, which the change only reads as
before. The surfaces it newly makes theme-sensitive — `--pie-text`,
`--pie-white`, `--pie-background-dark`, `--pie-primary`, `--pie-border`,
`--pie-border-dark`, `--pie-button-active-bg`, `--pie-button-focus-outline` —
are not in Host A's set list, so they resolve from the active theme there. See
the two sections below for what a host sees.

Three fixes assessed against the recorded rows rather than a fresh checkout
refresh, and none advances the verification date. `tools.policy.blocked` now
decides feature-scoped capabilities as well as placed ones, which is additive: no
recorded host lists a capability there, and it is what a host writes to decline
the default-granted audio transcript without adopting the composition package —
the alternative was constructing a registry, which only Host R does. The card
title selector moves from `h2` to `:is(h1, h2, h3, h4, h5, h6)` at identical
specificity, so a host rule that overrides the title still wins; the default DOM
is unchanged, and the fix only shows for a host that drives
`base-heading-level`, which none does today. The eliminated-choice dim moves from
`.pie-answer-eliminator-eliminated-fallback` to
`[data-pie-answer-eliminated="true"]`, so it reaches the CSS Highlight API path
too. Hosts A and V both load `components.css`; neither styles those hooks and the
answer eliminator is placed in neither delivery.

The dictionary capabilities and the selection door onto them reach one consumer,
found on the Host R re-derivation: that host serves a dictionary endpoint in the
shape `pie-tool-dictionary` reads, so the lookup wire contract is API to it. See
**Host-served endpoint contracts** below. Neither client-facing checkout mentions
either capability.

Host V depends on the item player and the theme only, neither of which the change
touches. Host A places one capability at item scope plus read-aloud when its
profile asks; it supplies no section-level placement, and core's placement default
is empty, so the two new capabilities cannot appear there — and it does not depend
on the selection gateway package at all, so the gateway's new host-supplied action
list and its post-action dismissal latch are unreachable for it. The four additive
`ToolkitCoordinator` request methods and the three new type exports are called by
no recorded host; Host R holds a coordinator instance rather than implementing the
interface, so widening it is not a break there either.

A review pass over the same work narrowed the coordinator surface and changed three
defaults, none of which reaches a recorded host. The four request methods became
optional on the coordinator interface, which only widens what a host-supplied
coordinator may be. Request resolution now falls back off section scope to any
level hosting the capability, which can only find a target where none was found
before; no recorded host places either new capability, and the fallback cannot
redirect a request that already resolved. Endpoint lookups now carry the session
cookie instead of omitting credentials, and refuse plain `http:` picture URLs — both
inside the two new packages, which no recorded host depends on. The shared
term-lookup module those packages now use is a new subpath on
`pie-players-shared`; existing entry points are untouched.

Desmos calculator configuration ownership moved to the adapter package, checked
against all three checkouts as a targeted lookup rather than a re-derivation, so
it does not advance the verification date. `DesmosCalculatorConfig` left
`@pie-players/pie-calculator` and the toolkit's `./tools/client` subpath, the
`desmos` field left the base `CalculatorProviderConfig`, and all of it now lives
on `@pie-players/pie-calculator-desmos` alongside a new
`DesmosCalculatorProviderConfig`. `CalculatorProvider` stays un-parameterized and
its `initialize` gained an optional `CalculatorProviderInit`, matching
`ITTSProvider` in `pie-tts`. No checkout imports any
calculator type: both hosts that show a calculator declare their own
`CalculatorType` union, and the one offering Desmos configures it through the
auth-fetcher runtime key alone. The runtime shape
`{ restrictedMode, desmos: { … } }` is unchanged, so the delivered calculator is
untouched.

The open-source Cortex calculator is additive and was assessed against the
recorded calculator rows rather than a fresh consumer-checkout refresh, so it
does not advance the verification date. It adds three packages, the
`calculator-cortex` selection id, `CortexToolProvider`, and two provider-specific
custom-element tags. Its concrete provider configuration additionally exposes
package-owned message overrides, direction control, and six graph-series theme
hooks; these are additive surfaces on the same new package. No recorded host
names that id or imports those packages.
The existing generic `pie-tool-calculator` tag, `calculator` tool id, attributes,
properties, provider-neutral calculator contracts, and no-config Desmos default
remain unchanged. Ownership of the generic tag's registration moves from the
Desmos-named package to the shared calculator package; the Desmos package keeps a
compatibility entry that imports that same guarded registration, so the runtime
surface observed by Host A and Host R does not change.

Each tool package's root type entry now describes what its root runtime entry
provides. `insertTypesEntry` derives that entry from the bundle entry — a
`.svelte` component — and overwrites the `index.d.ts` emitted from `index.ts`, so
every package whose bundle entry is a component published a root entry that
ignored its own `index.ts`. Where `index.ts` re-exported types they now ship:
`pie-tool-dictionary`, `pie-tool-picture-dictionary` and
`pie-tool-calculator-desmos`. The dictionary pair carries the host-served lookup
contract recorded above, which is why one host declares that shape locally and
another declares a narrower `CalculatorType` than PIE defines. Additive there: no
name changed and nothing could have imported these before, since they were never
in a published tarball. Where `index.ts` re-exported a *value* the re-export came
out instead — `pie-tool-answer-eliminator` named `AdapterRegistry` at its root,
which the bundle does not export, so shipping that type would have type-checked
and then been undefined at run time. Its `./adapters/adapter-registry` subpath is
unchanged and no consumer reaches either route.

One residual difference is worth a manual check rather than a claim. Focusable
collection for a trapped floating panel now descends into open shadow roots and
now excludes `tabindex="-1"`, which the flat selector previously matched through
its `button` clause. Host A's one shell-hosted capability renders in light DOM, so
the shadow half is a no-op for it; the `tabindex="-1"` half depends on the
third-party DOM inside that panel, which this repository stubs in tests and which
was not measured against the real vendor bundle. If that DOM carries such
controls, the panel's internal tab cycle drops those stops — matching what the
browser does with them anyway. One tab-through of that panel before release
settles it.

Chrome i18n adoption **was** checked against all three checkouts, and advances the
verification date below. It reaches consumers three ways, all additive: a new
optional `locale` attribute and prop on `pie-item-player` and the four
section-player layout elements; new optional `nameKey` / `descriptionKey` on
`ToolRegistration` alongside the still-required `name` / `description`; and new
optional `i18n` / `locale` members on the toolkit runtime context, `ToolbarContext`
and `ToolSurfaceServices`. Nothing was renamed, retyped, or removed from those
surfaces, and the graceful default is `en-US` rather than the browser's locale, so
a host that passes no `locale` keeps English. The adoption commit also held every
English value byte-identical, so that a text change would be visible as a text
change rather than arriving inside the refactor.

That hold was released by a follow-up, and it is the only part of this work that
changes what a host renders today: sixteen strings were reworded and all nine
toolbar button accessible names were re-formed against WCAG 2.5.3, so English
output is no longer byte-identical with no `locale` supplied. Both `nl-NL` values
moved with them. **Host A** is the only affected consumer — it drives live
delivery with the toolbar placed — and **Host R** renders the same buttons.
Grepping all three checkouts for the retired strings returns nothing outside
`node_modules` and build caches: no host asserts, styles or otherwise depends on
any of them, and none selects a tool button by accessible name. The exposure is
therefore screen-reader output only, and it improves. Assessed against the changed
strings rather than a full re-derivation, so it does not advance the verification
date.

The one non-additive change is `@pie-players/pie-players-shared/i18n`, whose
`SimpleI18n` gained `plural()` in place of `tn()` and lost
`BUNDLED_TRANSLATIONS` / `loadTranslations` and two Svelte composables. A grep of
all three checkouts for that specifier, for `SimpleI18n`, `I18nService`,
`useI18nStandalone`, `ToolRegistration` and `nameKey` returns nothing outside
build caches and a vendored third-party calculator bundle: the layer was
published with no call sites anywhere, which is what made replacing it rather
than versioning it the right move. No host passes `locale` to a `pie-*` element
either.

## Consumer profiles

| Label | Stack | Depth | Breakage cost |
| --- | --- | --- | --- |
| **Host V** | Vue 3 + Vite | One item at a time, read-only instructor rendering, behind a host feature flag; migrating off `@pie-framework/pie-player-components` | High — external client-facing |
| **Host A** | Angular + webpack | Full fixed-form delivery: one layout CE, the toolkit coordinator via `toolkit-ready`, session persistence, TTS, calculator, PNP | Highest — external client-facing, drives live delivery |
| **Host R** | SvelteKit reference/QA app | Nearly the whole suite, and the only consumer of the **programmatic** API: it constructs `ToolkitCoordinator` itself, drives the composition layer, reads the theme token registry, and runs the Node-side TTS providers | Low to fix, high to notice — internally controlled, but it is the first place a regression surfaces |

Packages consumed:

- **Host V** — `pie-item-player`, `pie-theme`.
- **Host A** — `pie-section-player`, `pie-assessment-toolkit`, `pie-theme`,
  `pie-calculator-desmos`, `pie-tool-calculator-desmos`,
  `pie-tool-text-to-speech`, `tts-client-server`, `tts-server-polly`, two
  section-player debugger tools.
- **Host R** — 29 declared `@pie-players` packages. Imported: the toolkit,
  `pie-default-tool-loaders`, `pie-players-shared` and its `types` subpath, two
  `pie-section-player/components/*-element` subpaths, `pie-theme` plus its
  `tokens.css` and `token-registry.json` subpaths, eleven `pie-tool-*`, four
  `section-player-tools-*` debuggers plus `section-player-tools-tts-settings`,
  and `tts-server-core` / `-google` / `-polly` / `-sc`. It loads
  `pie-item-player` from a CDN by version rather than as a dependency.
  Four declared packages are imported nowhere in its source —
  `pie-calculator-desmos`, `pie-tool-text-to-speech`,
  `pie-section-player-tools-shared`, `tts-client-server` — so their ranges
  resolve without their surfaces being consumed. Two more tool packages, both
  dictionaries, reach it transitively as dependencies of
  `pie-default-tool-loaders`, whose packaged registry dynamically imports them.

Host V pins an exact patch (`0.3.53` at last read), so it upgrades
deliberately. Host A and Host R both use caret ranges on the `0.3.x` line
(both `^0.3.68` at last read, and uniform across all 29 of Host R's), so
**every published patch reaches them on their next install** — a lockstep patch
that changes behavior lands in live delivery without a code change on their
side.

Host R is not client-facing and is ours to fix, so its rows are not a reason to
avoid a change. They are a reason to expect the change to show up there first,
and to fix it there in the same push.

## Package entrypoints in use

| Specifier | Consumers | Note |
| --- | --- | --- |
| `@pie-players/pie-item-player` | V | Dynamic `import()`, registration by side effect. R loads the same file from a CDN by version instead |
| `@pie-players/pie-theme` | A, R | Bare specifier → `dist/index.js`, which calls `definePieTheme()` at module scope. R imports it for that side effect alone and calls `definePieTheme` nowhere |
| `@pie-players/pie-theme/theme-element` | V | Does **not** self-register; the host calls `definePieTheme()` itself |
| `@pie-players/pie-theme/components.css` | V | Imported as text and re-injected under `@scope`, see below |
| `@pie-players/pie-theme/tokens.css` | R | Imported unlayered so tokens are present in the first paint, ahead of the theme element upgrading |
| `@pie-players/pie-theme/token-registry.json` | R | Default import, cast to `PieThemeTokenRegistry`; the entry fields it reads are listed under theme tokens below |
| `@pie-players/pie-section-player/components/section-player-splitpane-element` | A, R | |
| `@pie-players/pie-section-player/components/section-player-vertical-element` | R | |
| `@pie-players/pie-assessment-toolkit` | R | Root entry, for values and types both |
| `@pie-players/pie-default-tool-loaders` | R | |
| `@pie-players/pie-players-shared` | R | Instrumentation providers |
| `@pie-players/pie-players-shared/types` | R | `AssessmentSection`, `AssessmentEntity`, `RubricBlock`, `PersonalNeedsProfile` |
| `@pie-players/pie-tool-*` (11 packages) | R | Ten bare side-effect imports, each self-registering at import time; `pie-tool-sign-language` is imported for its named `signLanguageRegistration` instead, because signing sits outside the packaged set |
| `@pie-players/pie-section-player-tools-*` (5 packages) | A (2), R (5) | Bare side-effect imports; R uses four debuggers plus the TTS settings panel |
| `@pie-players/tts-server-core` / `-google` / `-polly` / `-sc` | R | Node side, in SvelteKit server routes |

The self-registration asymmetry between `pie-theme` and
`pie-theme/theme-element` is load-bearing in both directions: V depends on
`theme-element` staying side-effect-free, A and R depend on the index entry
keeping its module-scope `definePieTheme()` call. Moving the call, or adding one
to `theme-element`, breaks one of them.

Tool packages are consumed as bare side-effect imports on the strength of
registering themselves. A tool that starts requiring an explicit registration
call disappears silently from Host R rather than failing to build.

## Custom-element surface

### `pie-item-player` (Hosts V, R)

Host V sets properties imperatively: `config`, `env`, `addCorrectResponse`,
`baseHeadingLevel`. Attributes are never used. No events are consumed — the host
is render-only.

`env` is the sharp edge. The host sets
`{ mode, role, "@pie-element": { lockChoiceOrder: true } }`. `Env` in
`packages/players-shared/src/types/index.ts` declares only
`mode` / `role` / `partialScoring?` and has no index signature, so the extra
namespace is untyped but forwarded verbatim to every element controller. The
invariant to preserve is **pass-through**: do not filter, whitelist, or
reconstruct `env` down to its declared keys.

`mode` is only ever `"view"`; the host maps its own `preview` onto it and uses
`role: "student"` to suppress rationale, because the item player has no
`preview` mode.

Host R drives a wider surface than Host V — ten properties across four preview
routes: `config`, `env`, `session`, `render-stimulus`, `allowed-resize`,
`add-correct-response`, `show-bottom-border`, `hosted`, `bundleEndpoints`,
`strategy`. All ten exist on `origin/develop`. Two of them are the reason this
matters more than the count suggests: `session` is the only observed use of that
property anywhere, and `strategy` the only observed use of the loader-strategy
selector.

That surface arrives over a CDN path rather than a dependency, at a version the
route computes, with `latest` as the fallback on two of the four routes. So
Host R is not on its caret range for the item player at all: it can be rendering
a much older build than the rest of the suite, or a floating newest one, and a
property removed here breaks it only once the CDN serves the version that removed
it. There is no install step to catch it and no build error when it happens.

### `pie-section-player-splitpane` and `-vertical` (Hosts A, R)

Object properties: `runtime`, `section`, `hooks` (A), `toolRegistry` (R).

Attributes both hosts pass: `assessment-id`, `section-id`, `attempt-id`,
`show-toolbar`, `toolbar-position`, `iife-bundle-host`.

Host A additionally: `debug`, `narrow-layout-breakpoint`,
`split-pane-initial-passage-width`, `nds-icons`. Host R passes none of those
four, so a change to one of them is a Host A question alone. Neither host passes
`locale`, `base-heading-level`, `tool-config-strictness`, the two
`content-max-width-*` attributes, either remaining `split-pane-*` attribute, the
three `*HostButtons` object props, or `policies`.

Method: `waitForSectionController(timeoutMs)` (A, off a
`document.querySelector` handle) and the zero-argument `getSectionController()`
(R, off the event's `currentTarget`). Both overloads are live.

Events: `toolkit-ready`, read as `event.detail.coordinator`. A listens with
`addEventListener`; R uses the Svelte 5 `ontoolkit-ready` attribute form. R also
takes `pie-stage-change`, filtered on `detail.stage === "engine-ready"`, as the
signal that the zero-arg `getSectionController()` will answer — so the stage
vocabulary is API and `engine-ready` in particular is the gate a host waits on.

`show-toolbar` is declared `type: "String"`. A sets the attribute to the literal
string `"false"`; R sets `{true}` on its demo and playground mounts and `"false"`
on its preview mount, so both forms are live within one host as well as across
two. Retyping it to `Boolean` inverts A's intent, since attribute presence would
then read as `true`. Same trap for `debug` and any other `type: "String"`
attribute a host sets to `"false"`.

Host R also sets a class of its own on the layout element, toggled by a policy
decision. Class attributes on the layout host must therefore survive to the
rendered element rather than being reconstructed.

The vertical layout is exercised only by Host R, which is exactly why a
splitpane-only change that skips it stays invisible until someone opens the
reference app.

### `pie-theme` (all three)

Attributes used: `theme`, `scope`. V uses `theme="light" scope="self"`; A uses
`theme="light" scope="document"`. `observedAttributes` also carries `provider`,
`scheme`, and `variables`; V's local typings declare all five.

Host R mounts exactly one `<pie-theme scope="document">`, with no attributes in
the markup, and writes `theme`, `scheme` and `provider` onto the element from a
single store after mount. What it depends on is not visible in that markup:
`scope="document"` must keep resolving its target to the root element and writing
every `--pie-*` value there as an inline style, because the host's own chrome
reads those values off the root (see theme tokens below). It also depends on the
element resolving to light and stamping `data-theme="light"` before the store
runs, since that is what its pre-paint token seed is matched against.

The document-owner handoff is not a constraint that host imposes. Its source
records the opposite belief — that a per-route document-scoped host would leave
stale inline values on the root across client-side navigation, hence one app-wide
host — but `disconnectedCallback` clears the previous target for document scope
too, applying a surviving owner's state or restoring the baseline. So the
last-writer-wins owner map and its disconnect path are free to change; only the
target resolution and the inline-style write are load-bearing here.

Neither V nor A uses `theme="auto"`. Both deliberately force light so an
OS-dark-mode user does not get dark-rendered content inside a light-only host
UI. R is the only consumer that exercises scheme switching at all.

No client-facing host uses the programmatic scheme catalog, custom-scheme
registration, raw base/palette constants, or the theme picker's `schemes` /
`schemeCatalog` inputs. Host A's stylesheet-only path still requires its live
token names, literal CSS filenames, and unlayered override leverage. Host V still
requires explicit-light behavior and a side-effect-free `theme-element`
entrypoint.

Host R is on the snapshot return shape: it reads `listPieColorSchemes().schemes`
and maps each descriptor's `id` and `name` into its picker, so every registered
scheme reaches that picker without a host edit. It calls neither
`resolvePieTheme()` nor `observePieColorSchemes()`. The migration debt this pad
carried against that call is discharged.

### Internal layout CEs as style selectors (Host A)

The host reaches into the player's light DOM with Angular `::ng-deep` rules
targeting these tag names:

- `pie-section-player-splitpane` — sets CSS custom properties, restores `<p>`
  margins, and hosts a large block of authored-content class rules
- `pie-section-player-item-card` — background override
- `pie-section-player-passage-card` — background override

These tags are structural API to this host even though they are not entrypoints
in the section-player `exports` map. Renaming them, or moving a card out from
under the splitpane element, changes rendering there silently — no build error,
no runtime error.

Host R styles the two layout hosts through `:global()` in two files and is
similarly exposed by the tag names, but only for flex sizing and overflow — it
sets no custom property and reaches no card. It styles no internal card tag at
all, so the two card tags are Host A's constraint alone.

### Debugger and settings panel CEs (Host R only)

Five packaged panels, mounted as custom elements with object and string props
set from Svelte. The prop names are API and none is exercised by any other
consumer:

- event debugger — `toolkitCoordinator`, `sectionId`, `attemptId`, `maxEvents`,
  `maxEventsByLevel`, `persistenceScope`, `persistencePanelId`, plus a `close`
  DOM event the host listens for to hide the panel
- session debugger — `toolkitCoordinator`, `sectionId`, `attemptId`
- instrumentation debugger — `maxRecords`, `maxRecordsByKind`,
  `persistenceScope`, `persistencePanelId`
- PNP debugger — mounted with no props at all, so it depends on the panel
  reaching the runtime context on its own; the six props it declares are unused
- TTS settings — `toolkitCoordinator`, `storageKey`, `customProviders`, and an
  `onclose` callback prop

`customProviders` is the sharp one. Its entries are duck-typed rather than
imported: `{ id, label, description, mode: "adapter", checkAvailability({
apiEndpoint, state }) }`, returning `{ available, message }`. Nothing in this
repository types what the host passes, so a change to the member names or to the
`checkAvailability` argument shape is a silent no-op there — the panel loses a
provider row and reports nothing.

## Programmatic API (Host R only)

The deepest coupling in the set, and the one no client-facing host has. From
`@pie-players/pie-assessment-toolkit`:

- `new ToolkitCoordinator(config)` — constructed by the host in six places, not
  obtained from `toolkit-ready`. Config keys used: `assessmentId`,
  `toolConfigStrictness`, `tools`, `toolRegistry`, `toolContextResolvers`. Every
  call site pins itself with `satisfies ConstructorParameters<…>[0]`, so a
  constructor-signature change is a type error there rather than a silent
  misconfiguration. `hooks` is no longer passed to the constructor.
- `coordinator.setHooks({ onFrameworkError })`, with the handler reading the
  framework-error model as an opaque value
- `coordinator.updateAssessment(entity)` — driven off a `$effect`, so it is
  called repeatedly with a fresh entity carrying the same id; the method has to
  stay idempotent under that
- `coordinator.onPolicyChange(cb)`
- `coordinator.decideFeaturePolicy(featureId)`, guarded by a `typeof … ===
  'function'` check because the member is optional. The host reads `granted` and
  `reason` off the decision and renders `reason` to a person, so it is
  user-visible text, not diagnostics
- `coordinator.getSectionController({ sectionId, attemptId })` → `persist()`
- `coordinator.disposeSectionController({ sectionId, attemptId,
  clearPersistence, persistBeforeDispose })` — awaited, in five places, as the
  host's session-reset path. Both boolean options are set explicitly and in both
  polarities, so neither may become implied by the other
- `coordinator.subscribeSectionLifecycleEvents({ eventTypes, listener })`, with
  `eventTypes` narrowed to `section-loading-complete`,
  `section-items-complete-changed`, `section-error`. Wrapped in a `try` because
  the method throws before a section cohort exists — the host relies on that
  documented throw rather than on a return value
- `createToolsConfig({ source, strictness, toolRegistry, tools })` →
  `{ config, diagnostics }`
- Diagnostic shape `{ code, severity, path, message }`. The host branches on
  `severity === 'error'` and renders `path` and `message`; it declares the shape
  locally rather than importing `ToolConfigDiagnostic`, and it no longer
  constructs a diagnostic or reads any `code` value. Diagnostic **codes are no
  longer API to any consumer**; `severity`, `path` and `message` are
- Types imported: `ToolRegistry`, `ToolConfigStrictness`,
  `ToolkitCoordinatorApi`, `ToolkitCoordinatorHooks`, `ToolContextResolver`,
  `ToolContextResolverMap`. `CanonicalToolsConfig`, `ToolConfigDiagnostic` and
  `ToolkitCoordinatorConfig` are no longer imported — the config type is taken
  structurally through `ReturnType<typeof createToolsConfig>['config']`, which
  couples the host to the function's return type instead of to the type name.

From `@pie-players/pie-default-tool-loaders`:

- `createPackagedToolRegistry()` and `createPackagedToolRegistry({
  toolModuleLoaders })`, the latter passed `DEFAULT_TOOL_MODULE_LOADERS`
- `registry.register(registration)`, for `signLanguageRegistration` from
  `pie-tool-sign-language` — the only registration call in any checkout, made
  explicitly because signing is deliberately outside the packaged set
- `registry.getAllTools()` → `ToolRegistration[]`, read for `toolId` and
  `supportedLevels` to compute an all-levels placement. `supportedLevels` stays
  load-bearing, but as a filter input rather than something the host rewrites
- `registry.get(toolId)` and `registry.override(...)` are **no longer called**.
  The `protractor` / `lineReader` / `ruler` promotion to `section` level that
  used to run through `override` is gone; those three now reach the section level
  through the packaged registry's own `supportedLevels`. No consumer exercises
  `override` or unregister semantics
- `ToolRegistry.onRegistryChange(listener)` is called by no consumer.
  Section-player uses it internally so live registration changes reconcile
  without a host-forced rerender
- `createUniversalPersonalNeedsProfile()`, spread and then extended with support
  ids the host grants, so the returned profile must stay a plain object with a
  `supports` array rather than becoming frozen or class-based

From `@pie-players/pie-players-shared`: `CompositeInstrumentationProvider`,
`NewRelicInstrumentationProvider`, `DebugPanelInstrumentationProvider`. The
composite is constructed with the other two as an array, driven through
`initialize()`, and then handed to the section player as
`runtime.player.loaderConfig.instrumentationProvider` — so the constructed
instance has to satisfy whatever that runtime slot accepts, and the composite's
array-of-providers constructor argument is API rather than a convenience.

From `@pie-players/pie-theme`: `listPieColorSchemes()`,
`listPieThemeProviders()`, `resolveProviderVariables()`, and the token-registry
JSON with four of its five exported types (`PieThemeTokenRegistry`,
`PieThemeTokenRegistryEntry`, `PieThemeTokenScope`, `PieThemeTokenStatus`; not
`PieThemeSchemeParticipation`).

Two of those three go further than a call. `listPieThemeProviders()` is read for
each adapter's `id` and its `canRead(target)` predicate, and the host takes the
**first adapter in registration order whose `canRead` accepts the target** as the
provider name it reports — it re-implements the element's own auto-selection.
Registration order in that array is therefore observable behavior, not an
implementation detail. `resolveProviderVariables({ target, provider })` is read
for its key count, which the host displays next to that name specifically so the
two disagreeing becomes visible; returning a differently-keyed object silently
changes a number a reviewer is trusting.

Node-side, in server routes: `new GoogleCloudTTSProvider()` with
`GoogleCloudTTSConfig`, `new SchoolCityServerProvider()`, `PollyServerProvider`,
each driven through `initialize(config)` behind a memoized accessor, and
`TTSError` / `TTSErrorCode` — the host maps the `INVALID_REQUEST`,
`TEXT_TOO_LONG`, `AUTHENTICATION_ERROR`, and `RATE_LIMIT_EXCEEDED` members onto
HTTP status codes in two separate route helpers, so those **enum member names are
API**.

## Events and coordinator callbacks

| Name | Route | Consumers | Use |
| --- | --- | --- | --- |
| `toolkit-ready` | DOM event on the layout CE | A, R | Captures `detail.coordinator`. R compares it against the coordinator it constructed itself and warns on a mismatch, so identity is checked, not just presence |
| `pie-stage-change` | DOM event on the layout CE | R | Filtered on `detail.stage === "engine-ready"`, then calls the zero-arg `getSectionController()` off `currentTarget`. The stage vocabulary and this transition's timing are both API |
| `item-session-data-changed` | `subscribeItemEvents` | A | Response capture → store dispatch → autosave |
| `content-loaded` | `subscribeItemEvents` | A | Per-item and `contentKind === "rubric"` load tracking; cancels a load-timeout watchdog |
| `section-loading-complete` | `subscribeSectionLifecycleEvents` | A, R | A subscribes with an empty handler; R logs it |
| `section-items-complete-changed` | `subscribeSectionLifecycleEvents` | A, R | A subscribes with no handler body; R logs it |
| `section-error` | `subscribeSectionLifecycleEvents` | A, R | Fatal for A: exits the delivery session. R logs it |
| `item-session-changed` | DOM, bubbling and composed | A, R | `document`-level listener → snapshot + persist. R adds two listeners per route in the **capture** phase, so it depends on the event reaching `document` during capture as well as bubble |

The `content-loaded` payload fields Host A reads are `itemId` and `contentKind`.
It counts distinct `itemId`s against the section's expected item list and treats
equality as "section loaded". Emitting `content-loaded` more than once per item,
or for an item outside the section, would leave the count short or overshoot;
either way the host's watchdog fires and ends the session.

`item-session-changed` reaches `document` because it is dispatched through
`dispatchCrossBoundaryEvent` in
`packages/assessment-toolkit/src/runtime/tool-host-contract.ts`, whose default
init is `bubbles: true, composed: true`. Dropping those defaults silently
disconnects that host listener — now in two hosts rather than one.

The `item-session-data-changed` payload is destructured as
`event.session.data[0]`, with `event.complete` read through an
`event.detail.complete` fallback. Reshaping the item event payload — nesting the
session, making `data` lazy, or emitting an empty `data` array — breaks response
capture rather than degrading it.

## Controller and coordinator methods

Reached via `coordinator.getSectionController({ sectionId, attemptId })`,
`waitForSectionController(5000)`, or the CE's zero-arg
`getSectionController()`:

- `persist()` — A on section switch and on every session change; R after
  demo interactions, guarded by a `!controller?.persist` presence check and
  wrapped so a rejected promise is caught rather than surfaced
- `hydrate()` — A only, after `toolkit-ready`, with a retry loop while the
  method is absent
- `getSession()` — A only, snapshot before switching sections
- `applySession(session, { mode: "replace" })` — A only, resume, with a
  hand-built `{ currentItemIndex, visitedItemIdentifiers, itemSessions }`
  payload

`persist()` is the only controller method Host R calls. `hydrate`, `getSession`
and `applySession` are Host A's alone, so the session-resume path has exactly one
consumer and no reference implementation in the internally controlled host.

Also consumed off the coordinator by Host A:
`subscribeItemEvents({ eventTypes, listener })` and
`subscribeSectionLifecycleEvents({ eventTypes, listener })`, both returning an
unsubscribe function; `ttsService.stop()`; and
`toolCoordinator.getVisibleTools()` / `toolCoordinator.hideTool(id)`.

Host A filters `getVisibleTools()` by `id.startsWith("calculator:")` to hide
open calculators on navigation. Tool-id prefixes are therefore observable API.

`applySession` keys `itemSessions` by the bare `item.id`, not by the QTI
identifier or the versioned item id. Host A maintains an explicit translation
between the three id forms because the session map and the emitted session
events use the bare form. Changing which id form appears in either place breaks
resume and response routing at once.

Every host guards these methods with optional-call syntax, so a method that
disappears degrades to a silent no-op — persist and hydrate stop happening with
no error surfaced. Removing one will not fail loudly downstream.

## Runtime configuration keys

Host A builds a `runtime` object with:

- `assessmentId`
- `player.hosted: true`
- `tools.providers.calculator.provider.runtime.authFetcher` — async function
  returning the Desmos auth payload
- `tools.providers.textToSpeech` — `enabled`, `backend: "server"`,
  `serverProvider: "custom"`, `transportMode: "custom"`,
  `endpointMode: "rootPost"`, `endpointValidationMode: "none"`, `apiEndpoint`,
  `lang_id`, `speedRate`, `cache`, `includeAuthOnAssetFetch`
- `tools.placement.item` and `tools.placement.passage` — arrays of
  `"calculator"` / `"textToSpeech"`
- `toolContextResolvers.calculator` — host resolver returning
  `{ visible, reason?, params: { calculatorType, availableTypes } }`

Every one of these keys is live in production delivery. The custom TTS transport
combination in particular (`transportMode: "custom"` +
`endpointMode: "rootPost"` + `endpointValidationMode: "none"`) is a
deliberately unvalidated path; treat it as a supported configuration, not as a
loophole to tighten.

Host R sets the same eleven-key TTS provider config, the same three-part
unvalidated transport combination among them, and adds a twelfth key —
`providerOptions`, an opaque object forwarded to the provider. So that path has
two consumers rather than one, and the internally controlled one is where a
tightening would surface first. `providerOptions` itself has one consumer and no
type constraint on the host side.

Host R builds a larger `runtime` than Host A and a different one from what this
pad previously recorded:

- `assessmentId`
- `playerType` — `"iife"` / `"esm"` / `"preloaded"`, selected by a control, so
  all three branches are exercised there and nowhere else
- `lazyInit: true`
- `tools` — a `createToolsConfig` output, not a literal
- `toolContextResolvers` — a host resolver map for `calculator`, built from
  item metadata
- `player.loaderConfig` — `trackPageActions` plus the constructed
  `instrumentationProvider`
- `env` — `{ mode: "gather" | "evaluate", role: "student" | "instructor" }`
- `coordinator` — the host-constructed `ToolkitCoordinator` instance, passed
  **through the runtime object**, which is how a host-supplied coordinator
  reaches the engine

`toolRegistry` stays a separate element property rather than a runtime key,
because the layout shell rather than the engine consumes it.

Two of these are single-consumer surfaces with no client-facing backstop.
`env` on the section-player runtime is exercised only here — Host V passes `env`
to the item player instead, and Host A passes none — and it is the only place the
`gather` and `evaluate` modes appear in any checkout. `runtime.coordinator` is
likewise Host R's alone; Host A takes its coordinator off `toolkit-ready` and
supplies none.

Host R is also the only host that feeds the player a `createToolsConfig` output
rather than a hand-written literal, so it is the only one that would notice the
canonical config type and the CE's expected `tools` shape drifting apart. It
sets `toolConfigStrictness: 'error'` at every one of its six coordinator call
sites and passes `strictness: 'error'` to `createToolsConfig` — no longer `'off'`
— so a diagnostic this repository promotes to `error` severity now blocks that
host's render behind an error panel instead of logging.

## Hooks

Host A passes `hooks.cardTitleFormatter`, a function reading `context.kind`
(`"item"` / `"passage"`), `context.itemIndex`, `context.defaultTitle`, and
`context.passage?.name`. It renumbers questions across sections, so the
formatter is the only thing producing correct question numbers in that delivery.
Changing the context shape, or calling the formatter for a new `kind` without a
`defaultTitle`, produces wrong or blank card titles.

Host R sets `onFrameworkError` through `coordinator.setHooks` instead of on the
element.

## Theme tokens set by hosts

Host A sets these on `:root`, on a host theme attribute selector, or on the
splitpane element, several with `!important`:

`--pie-section-player-card-header-background`,
`--pie-section-player-tab-active-background`, `--pie-tts-word-highlight`,
`--pie-tts-sentence-highlight`, `--pie-tts-line-highlight`,
`--pie-tts-word-underline`, `--pie-tts-word-shadow`, `--pie-background`,
`--pie-button-bg`, `--pie-button-background-color`, `--pie-button-color`,
`--pie-button-border`, `--pie-border`.

All of the above resolve to real tokens in this repo. Two do not and are inert
on the host side: `--pie-tts-word-color` and `--pie-tts-word-hightlight` (a
typo the host keeps "for compatibility"). Renaming or dropping any of the live
ones changes that delivery's appearance with no build signal.

Host A also relies on being able to *win* against player styles at equal
specificity from outside, including with `!important`. Moving any of these
tokens behind a cascade layer, or resolving them at build time, removes that
lever.

Authored-content classes and player chrome now read the canonical families
rather than the literals they used to pin, so a host that sets a theme and none
of these tokens gets theme-driven values where it previously got fixed ones.
That is the intent — the literals were unreachable — but it is a rendering
change without a build signal, the same class of surface as the rest of this
section.

Host R takes the opposite approach: it sets no `@pie-players` token value
anywhere, and instead reads the token registry and inspects computed values at
runtime. It depends on token *names and metadata* staying addressable rather than
on any particular value. (Three `--pie-*`-shaped declarations do survive in it,
against a legacy selector and matching no token this repository defines; see the
consumer-side defects below.)

It imports `tokens.css` but **not** `color-schemes.css`, and that is now the
correct configuration rather than a gap. It activates a scheme by writing
`scheme` on its one `<pie-theme scope="document">`, which resolves the scheme and
writes every variable as an inline style on the root element; inline styles beat
any stylesheet, so importing `color-schemes.css` would add dead CSS and a
stale-override risk. Upstream scheme changes reach that host on its next version
bump with no edit on its side. `--pie-fixed-hue-collapse` is supplied along with
the rest — it is `canonical-semantic`, `required` for every scheme, and defined
in the resolver rather than in a stylesheet, so a host on the element path cannot
miss it. The hand-carried scheme fork this pad recorded, and the fixed-hue hazard
that followed from it, are both gone.

One `[data-color-scheme]` rule remains in that host and is **not** a token fork:
it reads eleven `--pie-*` names — `--pie-background`,
`--pie-secondary-background`, `--pie-dropdown-background`, `--pie-text`,
`--pie-primary`, `--pie-secondary`, `--pie-tertiary`, `--pie-border`,
`--pie-correct`, `--pie-missing`, `--pie-incorrect` — and maps them onto the
host's own palette slots, so an active scheme owns the host's chrome and not only
the item pane. All eleven exist here and all ten built-in schemes set every one
of them. This inverts the usual direction of exposure: the token *values* are
what that host consumes, and a change to any of the eleven repaints an entire
host UI rather than a player region. The gate on the attribute is load-bearing
for the host, because the base light theme ships `--pie-background` as
`rgba(255,255,255,0)` — deliberately, so PIE content reveals its host surface —
and aliasing a host background slot to a transparent value would strip the chrome
of a background on every unschemed page.

The runtime inspector adds two further dependencies. From `token-registry.json`
it reads six of the nine entry fields — `name`, `owner`, `scope`, `status`,
`category`, `fallbackPolicy` — and groups by `category` rather than by name,
specifically so a token added here appears there without a host edit; it ignores
`schemeParticipation`, `definedIn` and `documentedIn`. Separately it hard-codes
twenty token names in a contrast-pair list, which is the one place that host does
pin names: `--pie-text`, `--pie-background`, `--pie-secondary-background`,
`--pie-dropdown-background`, `--pie-primary`, `--pie-border`, `--pie-border-dark`,
`--pie-correct`, `--pie-incorrect`, `--pie-missing`, `--pie-button-color`,
`--pie-button-bg`, `--pie-button-hover-color`, `--pie-button-hover-bg`,
`--pie-button-border`, `--pie-button-focus-outline`, and the four
`--pie-section-player-tab-*` tokens. Renaming one drops a contrast row silently.

## Direct `dist` path references

Host A lists three stylesheets in its build config by literal path:

```
node_modules/@pie-players/pie-theme/dist/tokens.css
node_modules/@pie-players/pie-theme/dist/color-schemes.css
node_modules/@pie-players/pie-theme/dist/font-sizes.css
```

These bypass the package `exports` map. All three are also exported under their
bare names, so the `exports` map alone is not enough to protect this host —
**the `dist` filenames themselves are API here**. Renaming, splitting, or
merging any of those three files breaks that build. `components.css` was a
fourth entry here until Host A dropped it in favor of letting `pie-item-player`
install that stylesheet itself; see Content stylesheet delivery below.

`font-sizes.css` is bundled but not activated. Every rule in it is scoped under a
`data-font-size` attribute, and no host sets that attribute anywhere in its
source — so all three currently take only its `:root { --pie-font-scale: 1 }`
default, and its rules match nothing. So the file's *rules* are safe to change
while its *filename* is not — the inverse of the rest of this section, where the
values are the fragile half. The first host to set the attribute inherits whatever
those rules then say, with no build signal, and Host A and Host R both take patch
releases on caret ranges.

Host R additionally hard-codes the CDN path
`@pie-players/pie-item-player@<version>/dist/pie-item-player.js` on four preview
routes, so that filename is API too. It matches the package's `exports` map
target on `origin/develop`, but the CDN path bypasses the map, so renaming the
`dist` entry file breaks those routes even if the bare specifier keeps resolving.
Two of the four routes fall back to `latest` when no version is supplied, so a
rename lands there as soon as it publishes, with no install and no build.

## Content stylesheet delivery

The most fragile shared surface, because it changed underneath the hosts.

`packages/item-player/src/pie-item-player.ts` inlines
`@pie-players/pie-theme/components.css?raw` and installs it into
`document.head` at import time via `installContentStyles`
(`packages/players-shared/src/ui/content-styles.ts`). That shipped in
the **0.3.61** tarball, under `14666b3`, and is documented under **0.3.62**.
The two disagree because 0.3.61 was published with the changeset held back, so
item-player's 0.3.61 changelog shows only a lockstep dependency bump while that
release's tree already contained the installing code. Version comparisons here
use 0.3.61 as the threshold; a host reading only the changelog will over-pin
to 0.3.62. `auditContentStyles` warns once per page when the host also loads
its own copy, or when the host opts out and then loads nothing. The opt-out is
`data-pie-content-styles="host"` on `<html>`.

Consequences per host:

- **Host V** pins `0.3.53`, before the fix, and works around its absence by
  importing the stylesheet text from `pie-theme` and re-injecting it wrapped in
  `@scope (.item-content)`. The scoping is deliberate: `components.css` carries
  bare `h1`–`h6`, `table`, `th`, `#stimulus`, `#item`, `.table`, and
  `.text-center` selectors that bleed onto a surrounding host UI if applied
  document-globally. On upgrading to 0.3.61 or later that host gets a *second,
  unscoped* copy installed by the player, reintroducing exactly the bleed it
  scoped around, plus the duplicate warning. It needs the opt-out attribute at
  the same time as the version bump.
- **Host A** dropped its build-config `components.css` entry and now cedes
  ownership to the player entirely: no opt-out attribute, no stylesheet import
  of its own, so it is in the healthy configuration.
- **Host R** imports no copy of its own either, so it is also in the healthy
  configuration. Re-derived: it references `components.css` only in a comment
  recording that importing it there made the stylesheet load twice.

Host V is the only host still in the duplicate-risk state, and it enters that
state the moment it bumps to `0.3.61` or later without the opt-out. Any further
change to how content styles are delivered has to account for it and for the
opt-out attribute the other two now rely on implicitly by absence.

Three rules were removed from it outright: a `#stimulus` / `#item` pair of
50%-wide left floats, a `.lrn_feature h3` margin override and
`.lrn_width_auto.table`. The float pair is the one to check against a host — it
laid out two global ids as columns, so a host page carrying either id got the
layout whether or not it wanted it, and the recorded rows show no host relying on
that. The `lrn_` pair styled a third-party product's markup. Also gone from the
heading reset is `font-weight: 500`, so authored headings render at the browser's
weight; hosts V and A both load this stylesheet and will see that.

Separately from delivery, the stylesheet's own colours now resolve through
canonical tokens. For a host on the base light theme the values are the ones it
already rendered, with one visible exception: legacy `kds-*` table headers take
`--pie-background-dark`, so their fill lightens from `#d3d3d3` to `#ecedf1`.
Hosts V and A both load a copy of this stylesheet and neither sets `--pie-text`
or `--pie-white`, so both see it on upgrade.

## Host-served endpoint contracts

A surface class the other two hosts do not have. PIE ships no dictionary
endpoint — `pie-tool-dictionary` posts to a path the host configures — so the
wire shape is a contract this repository defines and a host implements.

Host R implements it. Its dictionary route serves the shape the packaged panel
reads, keyed exactly as `pie-tool-dictionary` expects: request `{ keyword,
language?, max? }`, response carrying results under `entries`, each entry
requiring `word` and taking definitions under `senses`. It also distinguishes an
empty result from an unsupported language and from an upstream failure, because
the panel words those three differently to a learner.

Renaming `entries` or `senses`, or moving the request keys, therefore breaks a
*host-implemented endpoint* rather than host code — no build error and no type
error anywhere, on either side. The same applies to `pie-players-shared`'s
`tools/term-lookup` response reader, which is where those key names live; that
host imports the subpath nowhere but depends on its parsing behavior entirely.

Nothing exercises this end to end today: that host's forked placement preset
never places the dictionary capability (see the consumer-side defects below), so
the endpoint is ahead of its own wiring. A contract break would sit undetected
until the capability is placed.

## Change-risk quick reference

Grouped by who breaks, not by how hard the change is. Host R is ours and
refactoring it is expected, so a surface only it touches is not a constraint —
change it and fix Host R in the same push.

**Silent breakage in a client-facing host (V or A). Coordinate before shipping.**

- Renaming `pie-section-player-splitpane`, `pie-section-player-item-card`, or
  `pie-section-player-passage-card`, or moving a card out from under the
  splitpane element
- Renaming or dropping any `--pie-*` token listed above
- Renaming any of the three `pie-theme/dist/*.css` files Host A lists by
  literal path
- Changing `bubbles` / `composed` defaults on cross-boundary events
- Reshaping `content-loaded` or `item-session-data-changed` payloads, or their
  emission cardinality
- Removing a controller method that hosts call with optional-call syntax
- Filtering unknown keys out of `env`
- Changing which item-id form appears in session maps or session events
- Retyping `show-toolbar` or `debug` to `Boolean`, or dropping either the string
  or the boolean form of `show-toolbar`
- Moving `definePieTheme()` between the `pie-theme` index and `theme-element`
- Layering generated theme CSS, resolving Host A's tokens at build time, or
  otherwise preventing its outside `!important` declarations from winning
- Changing how content styles are delivered, without accounting for Host V's
  pinned-version workaround and the opt-out attribute Host A and Host R now
  rely on implicitly by not setting it

**Host R only. Change freely; land the internally controlled host fix in the
same push.** Its checkout was available for the 2026-08-19 refresh, so these are
re-derived rather than remembered.

- `pie-section-player-vertical`, and anything in `default-tool-loaders` — except
  the `annotationToolbar` capability id, which Host R names in seven places, in
  tool config objects and in its own placement lists
- Requiring an explicit registration call from a `pie-tool-*` package that
  currently self-registers on import
- Renaming a `TTSErrorCode` member
- Changing `supportedLevels`, or the `ToolRegistry.getAllTools` and `register`
  signatures
- `ToolkitCoordinator` constructor, `createToolsConfig`, `setHooks`,
  `updateAssessment`, `onPolicyChange`, `decideFeaturePolicy`,
  `disposeSectionController`
- The `granted` and `reason` fields on `FeaturePolicyDecision` — `reason` is
  rendered to a person there, so its wording is user-visible in that host
- `subscribeSectionLifecycleEvents` throwing before a section cohort exists;
  Host R catches that throw rather than checking a precondition
- `pie-stage-change`'s stage vocabulary, and the `engine-ready` transition
  arriving before the zero-arg `getSectionController()` can answer
- The theme token registry — six of its nine entry fields and four of its five
  types — the provider-adapter `id` / `canRead` shape, the registration order
  that adapter list is returned in, `resolveProviderVariables`' key set, and the
  `tts-server-*` provider classes
- The `ColorSchemeSnapshot` return of `listPieColorSchemes()` and the `id` /
  `name` fields on its descriptors
- `dist/pie-item-player.js` as a CDN filename, and the ten `pie-item-player`
  properties that host sets — including `session` and `strategy`, which no other
  consumer touches
- `runtime.coordinator`, `runtime.playerType`, `runtime.lazyInit`,
  `runtime.player.loaderConfig`, and `env` on the section-player runtime
- The five debugger and settings panel CE prop sets, and the duck-typed
  `customProviders` entry shape
- `providerOptions` on the TTS provider config
- The dictionary lookup wire contract. It breaks a host-served *endpoint*, so no
  typecheck spans the boundary; the shape is now importable, though —
  `DictionaryLookupRequest` / `DictionaryLookupResult` reach consumers from
  `pie-tool-dictionary` as of the declaration-emit fix below, and their picture
  equivalents from `pie-tool-picture-dictionary`

The coordinator constructor and `createToolsConfig` are pinned with `satisfies`
in Host R, so signature changes there surface as type errors on its next
typecheck rather than at runtime. The rest of this list does not: `env`,
`runtime.coordinator`, the CE prop sets and `customProviders` are all untyped at
the boundary, the dictionary contract crosses an HTTP endpoint no typecheck can
span even now that its shape ships, and the `pie-item-player` properties arrive
over a CDN with no typecheck at all.

**Nobody. No coordination needed.**

- The assessment player, the print player, the tabbed section layout, the
  toolbars package, and `pie-context` — no consumer imports any of them
- Attributes and props on the layout elements not listed above, including the
  additive `locale` attribute on `pie-item-player` and the section-player layouts
- `@pie-players/pie-players-shared/i18n` in any form — the pre-adoption layer had
  no call site in any checkout, so its replacement breaks nobody
- Additive optional members on `ToolRegistration`, `ToolbarContext`,
  `ToolSurfaceServices` and the toolkit runtime context
- `theme="auto"` behavior, and `variables` on `pie-theme`
- The additive `ToolRegistry.onRegistryChange` observer and recoverable
  `tool-surface` framework-warning kind; no recorded host calls or branches on
  either surface
- Tool ids outside the `calculator:` prefix
- `DesmosCalculatorConfig` under its old owners, and the `desmos` field on the base
  `CalculatorProviderConfig`. Both are now on the Desmos adapter package. No
  checkout imports a calculator type at all, so the move is a source break with no
  source to break
- `Calculator` and `CalculatorProvider` as interfaces to implement, and the
  additive optional argument on `CalculatorProvider.initialize`. Every implementor
  is a package in this repository
- `DesmosCalculatorProvider` on the toolkit's `./tools/client` subpath. Both hosts
  that offer a Desmos calculator take the tool package as a side-effect import and
  reach the provider through the calculator package instead; one of them serves the
  proxy endpoint that only the calculator package's provider supports. Nothing
  imports the toolkit's copy
- `TTSToolConfig` and `TTSRuntimeSettings` as names, and the fields on which the
  two differ. The one host that configures server TTS sets eleven keys, all of them
  in the intersection of the two shapes, so folding them into one owner is
  invisible there
- `AuthoringValidationResult`. Re-derived on 2026-08-19: the one
  `validateModels()` call in any checkout is on a legacy `pie-author` element from
  the predecessor package, not on anything this repository ships. No consumer
  reaches the type at all
- The `highlighter` capability id. The one host that places annotation highlighting
  names `annotationToolbar`; no checkout mentions `highlighter`, or the PNP support
  ids that grant it
- `ToolConfigDiagnostic` as a name, and every diagnostic `code` value. The one
  host that read a code no longer does — it declares the diagnostic shape locally
  and branches on `severity` alone. `severity`, `path` and `message` stay live
- `ToolRegistry.override` and unregister semantics. No consumer calls either; the
  one host that did has moved to `getAllTools` plus `register`
- `resolvePieTheme()` and `observePieColorSchemes()`, and the `description` /
  `kind` / `preview` fields on a scheme descriptor
- The four `--pie-section-player-tab-*` token *values*. They are named in one
  host's contrast list, but they resolve inside a section-player component rather
  than on the root element, so that host reads them as empty either way — the
  names are API there, the values reach nobody

## Consumer-side defects worth reporting upstream

Recorded here because they shape what "breaking" means, not as work for this
repo.

- Host A registers a `document`-level listener for `section-loading-complete`.
  That name exists only as a coordinator callback event type, never as a DOM
  event, so the handler — which re-applies a session snapshot after content
  registration — never runs.
- Host A subscribes to `section-loading-complete` and
  `section-items-complete-changed` through the coordinator with handler bodies
  that do nothing.
- Host V's local type declaration for `pie-item-player` lists `env.mode` values
  the host never passes and omits several properties the element supports.
- Host A declares a local two-member `CalculatorType` where PIE defines three. Its
  content tags name only those two, so `graphing` is unreachable through its
  resolver rather than merely missing from the type.
- Host R declares the dictionary response shape locally rather than importing it.
  Both forks existed because the packaged types were declared but never shipped;
  the declaration-emit fix gives each an import to replace it.
- Host R declares its own local copy of the preferred tool-placement preset rather
  than importing the packaged `SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT`, so a
  capability added to or removed from the packaged preset never reaches it. The
  fork is now four capabilities behind at section level — the two dictionaries and
  their Spanish variants — which is why that host serves a dictionary endpoint
  and never shows a dictionary panel. Its item and passage lists still match. The
  last surviving instance of the forking pattern its colour schemes used to share.
- Host R declares four `@pie-players` packages it imports nowhere:
  `pie-calculator-desmos`, `pie-tool-text-to-speech`,
  `pie-section-player-tools-shared`, `tts-client-server`. The first two are
  reachable through the packaged registry without being declared, so the
  declarations are redundant rather than load-bearing — but they make its
  dependency list overstate what it consumes, which is what made the previous
  entrypoint rows wrong in the other direction.
- Host R sets `--pie-padding`, `--pie-spacing` and `--pie-gap` on a legacy
  `pie-player` tag from the predecessor package. None of the three is a
  `@pie-players` token — they are absent from `tokens.css` and from the registry —
  and the tag is not one this repository ships. Three dead declarations against a
  dead selector, and the only `--pie-*` values that host declares at all.
- Host R's contrast inspector reads the four `--pie-section-player-tab-*` tokens
  off the root element. They are `component-public` and resolve inside a
  section-player component, so those four rows measure an empty value regardless
  of theme. Four of its twenty contrast rows are therefore always uninformative.

## Refresh procedure

Follow
[`consumer-api-dependencies-maintenance.md`](./consumer-api-dependencies-maintenance.md).
It owns the full procedure for every harness and for doing it by hand: the
redaction rule, how consumer checkout paths resolve — including asking the
developer for any that cannot be found — and the rules for rewriting the risk
groups. In Claude Code the `consumer-dependency-audit` skill and command trigger
it automatically.

The shape of it, for orientation. Re-derive rather than trust the rows. For each
consumer checkout:

1. `grep -rn "@pie-players" <checkout>` outside `node_modules` and lockfiles —
   gives the entrypoint set and the version range.
2. Grep the same tree for `pie-` tag names, `--pie-` custom properties, and
   `::ng-deep` / `:deep` / `:global` / `@scope` blocks — gives the CE and CSS
   surface.
3. Extract named imports per specifier, not just the specifier list. Host R's
   surface is mostly module API, and a specifier-only inventory hides it.
4. Read the component that mounts the player end to end. Coordinator,
   controller, runtime, and hook usage is concentrated there and does not grep
   well.
5. Verify each claimed surface still exists in this repo **on a mainline ref**,
   not just in the installed package — the two have already diverged once.
   Several rows above exist only because a grep came back empty.

Update the "last verified" date whenever you do this, and delete rows you could
not confirm rather than leaving them to rot.
