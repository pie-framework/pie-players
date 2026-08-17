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
**2026-08-16**, scoped to the i18n surfaces described below; every other row
carries its earlier verification.

The canonical theming implementation updated these notes without performing a
new full refresh and therefore did not advance that verification date. The Host
R checkout was unavailable for the focused work; its existing rows remain prior
observations rather than newly verified claims. The removed mainline-divergence
warning was checked against this repository: the token-registry change is now in
the current line and its package export is present here.

The Tool Surface Host refactor likewise updated the in-repo contract notes
without a new consumer-checkout refresh. It preserves the client-facing
section-player tag hierarchy and CSS hooks recorded below. The additive
`ToolRegistry.onRegistryChange` method and `FrameworkErrorKind: "tool-surface"`
member are not used by any previously observed host; existing `register`,
`override`, unregister, and player setup calls keep their signatures. Host R was
unavailable as noted above, so this is a statement about the recorded rows, not
a fresh external audit.

The owner-aware catalog refactor was assessed against the same recorded rows,
not against unavailable consumer checkouts. Host A's inline TTS still uses the
same `data-catalog-idref` lookup, scoped context, direct resolver path, and
fallback behavior. No recorded host imports the removed catalog-collection
helper or constructs `ToolContentDependencyContext`; those are capability
authoring surfaces. Root `ToolkitCoordinator`, resolver, registry, runtime, and
custom-element signatures observed below remain unchanged.

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
  section-player debugger tools. Its `package.json` still declares
  `pie-theme-daisyui`, which no longer exists upstream and which it never
  imported; the range resolves to the last published version until it is dropped.
- **Host R** — all of the above plus `pie-players-shared`,
  `pie-default-tool-loaders`, every `pie-tool-*` in the suite, all five
  `section-player-tools-*` debuggers, `tts-server-core`, `tts-server-google`,
  `tts-server-sc`. It loads `pie-item-player` from a CDN by version rather
  than as a dependency.

Host V pins an exact patch (`0.3.53` at last read), so it upgrades
deliberately. Host A and Host R both use caret ranges on the `0.3.x` line
(`^0.3.59` and `^0.3.65`), so **every published patch reaches them on their
next install** — a lockstep patch that changes behavior lands in live delivery
without a code change on their side.

Host R is not client-facing and is ours to fix, so its rows are not a reason to
avoid a change. They are a reason to expect the change to show up there first,
and to fix it there in the same push.

## Package entrypoints in use

| Specifier | Consumers | Note |
| --- | --- | --- |
| `@pie-players/pie-item-player` | V | Dynamic `import()`, registration by side effect. R loads the same file from a CDN by version instead |
| `@pie-players/pie-theme` | A, R | Bare specifier → `dist/index.js`, which calls `definePieTheme()` at module scope |
| `@pie-players/pie-theme/theme-element` | V | Does **not** self-register; the host calls `definePieTheme()` itself |
| `@pie-players/pie-theme/components.css` | V | Imported as text and re-injected under `@scope`, see below |
| `@pie-players/pie-theme/tokens.css` | R | |
| `@pie-players/pie-theme/token-registry.json` | R | Previously observed; not re-derived during the focused theming update |
| `@pie-players/pie-section-player/components/section-player-splitpane-element` | A, R | |
| `@pie-players/pie-section-player/components/section-player-vertical-element` | R | |
| `@pie-players/pie-assessment-toolkit` | R | Root entry, for values and types both |
| `@pie-players/pie-default-tool-loaders` | R | |
| `@pie-players/pie-players-shared` | R | Instrumentation providers |
| `@pie-players/pie-players-shared/types` | R | `AssessmentSection`, `AssessmentEntity`, `RubricBlock`, `PersonalNeedsProfile` |
| `@pie-players/pie-tool-*` (13 packages) | R | Bare side-effect imports; each self-registers at import time |
| `@pie-players/pie-section-player-tools-*` (5 packages) | A (2), R (5) | Bare side-effect imports |
| `@pie-players/tts-server-core` / `-google` / `-sc` | R | Node side, in SvelteKit server routes |

The self-registration asymmetry between `pie-theme` and
`pie-theme/theme-element` is load-bearing in both directions: V depends on
`theme-element` staying side-effect-free, A and R depend on the index entry
keeping its module-scope `definePieTheme()` call. Moving the call, or adding one
to `theme-element`, breaks one of them.

Tool packages are consumed as bare side-effect imports on the strength of
registering themselves. A tool that starts requiring an explicit registration
call disappears silently from Host R rather than failing to build.

## Custom-element surface

### `pie-item-player` (Host V)

Properties set imperatively on the element: `config`, `env`,
`addCorrectResponse`, `baseHeadingLevel`. Attributes are never used. No events
are consumed — the host is render-only.

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

### `pie-section-player-splitpane` and `-vertical` (Hosts A, R)

Object properties: `runtime`, `section`, `hooks` (A), `toolRegistry` (R).

Attributes and props across both hosts: `assessment-id`, `section-id`,
`attempt-id`, `show-toolbar`, `toolbar-position`, `debug`,
`narrow-layout-breakpoint`, `split-pane-initial-passage-width`, `nds-icons`,
`iife-bundle-host`.

Method: `waitForSectionController(timeoutMs)` (A, off a
`document.querySelector` handle) and the zero-argument `getSectionController()`
(R, off the event's `currentTarget`). Both overloads are live.

Event: `toolkit-ready`, read as `event.detail.coordinator`. A listens with
`addEventListener`; R uses the Svelte 5 `ontoolkit-ready` attribute form.

`show-toolbar` is declared `type: "String"`, and the two hosts pass it
differently: A sets the attribute to the literal string `"false"`, R sets the
property to boolean `true`. Both must keep working. Retyping it to `Boolean`
inverts A's intent, since attribute presence would then read as `true`. Same
trap for `debug` and any other `type: "String"` attribute a host sets to
`"false"`.

The vertical layout is exercised only by Host R, which is exactly why a
splitpane-only change that skips it stays invisible until someone opens the
reference app.

### `pie-theme` (all three)

Attributes used: `theme`, `scope`. V uses `theme="light" scope="self"`; A uses
`theme="light" scope="document"`. `observedAttributes` also carries `provider`,
`scheme`, and `variables`; R drives `provider` and `scheme` programmatically
through the theme module API rather than as markup, and V's local typings
declare all five.

Neither V nor A uses `theme="auto"`. Both deliberately force light so an
OS-dark-mode user does not get dark-rendered content inside a light-only host
UI. R is the only consumer that exercises scheme switching at all.

For the canonical theme change, no client-facing host was recorded using the
programmatic scheme catalog, custom-scheme registration, raw base/palette
constants, or the theme picker's `schemes` / `schemeCatalog` inputs. Host A's
stylesheet-only path still requires its live token names, literal CSS filenames,
and unlayered override leverage. Host V still requires explicit-light behavior
and a side-effect-free `theme-element` entrypoint. Host R's observed
`listPieColorSchemes()` call must migrate to the new snapshot return shape when
that internally controlled checkout is available; it does not constrain the
interface in the meantime.

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
no runtime error. Host R styles the two layout hosts through `:global()` and is
similarly exposed.

## Programmatic API (Host R only)

The deepest coupling in the set, and the one no client-facing host has. From
`@pie-players/pie-assessment-toolkit`:

- `new ToolkitCoordinator(config)` — constructed by the host, not obtained from
  `toolkit-ready`. Config keys used: `assessmentId`, `toolRegistry`,
  `toolConfigStrictness`, `tools`, `hooks`, `toolContextResolvers`. The host
  pins its call site with `satisfies ConstructorParameters<…>[0]`, so a
  constructor-signature change is a type error there rather than a silent
  misconfiguration.
- `coordinator.setHooks({ onFrameworkError })`
- `coordinator.updateAssessment(entity)`
- `coordinator.onPolicyChange(cb)`
- `coordinator.decideFeaturePolicy(...)`
- `coordinator.getSectionController({ sectionId, attemptId })` → `persist()`
- `coordinator.subscribeSectionLifecycleEvents({ … })`
- `createToolsConfig({ source, strictness, toolRegistry, tools })` →
  `{ config, diagnostics }`
- Diagnostic shape `{ code, severity, path, message }`, with the host branching
  on `severity === 'error'` and constructing a diagnostic of its own with the
  code string `tools.invalidProviderValidation`. Diagnostic **codes are API**
  here.
- Types: `CanonicalToolsConfig`, `ToolRegistry`, `ToolConfigDiagnostic`,
  `ToolConfigStrictness`, `ToolkitCoordinatorApi`,
  `ToolkitCoordinatorConfig`, `ToolkitCoordinatorHooks`,
  `ToolContextResolver`, `ToolContextResolverMap`.

From `@pie-players/pie-default-tool-loaders`:

- `createPackagedToolRegistry()` and `createPackagedToolRegistry(options)`
- `registry.get(toolId)` → registration, then `registry.override({ …registration,
  supportedLevels: [...] })`. The host promotes `protractor`, `lineReader`, and
  `ruler` to the `section` level this way, so `supportedLevels` and the
  `override` semantics are load-bearing, not decorative.
- `ToolRegistry.onRegistryChange(listener)` is additive and was not present at
  the last consumer observation. Section-player uses it internally so live
  registration changes reconcile without a host-forced rerender; existing Host
  R override order and replacement semantics remain unchanged.
- `DEFAULT_TOOL_MODULE_LOADERS`
- `createUniversalPersonalNeedsProfile()`
- `signLanguageRegistration` from `pie-tool-sign-language`, registered
  explicitly because signing is deliberately outside the packaged set.

From `@pie-players/pie-players-shared`: `CompositeInstrumentationProvider`,
`NewRelicInstrumentationProvider`, `DebugPanelInstrumentationProvider`, all
constructed with `new` and driven through `initialize()`.

From `@pie-players/pie-theme`: `listPieColorSchemes()`,
`listPieThemeProviders()`, `resolveProviderVariables()`, and the token-registry
JSON plus its four types.

Node-side, in server routes: `new GoogleCloudTTSProvider()` with
`GoogleCloudTTSConfig`, `new SchoolCityServerProvider()`, `PollyServerProvider`,
and `TTSError` / `TTSErrorCode` — the host maps the `INVALID_REQUEST`,
`TEXT_TOO_LONG`, `AUTHENTICATION_ERROR`, and `RATE_LIMIT_EXCEEDED` members onto
HTTP status codes, so those **enum member names are API**.

## Events and coordinator callbacks

| Name | Route | Consumers | Use |
| --- | --- | --- | --- |
| `toolkit-ready` | DOM event on the layout CE | A, R | Captures `detail.coordinator` |
| `item-session-data-changed` | `subscribeItemEvents` | A | Response capture → store dispatch → autosave |
| `content-loaded` | `subscribeItemEvents` | A | Per-item and `contentKind === "rubric"` load tracking; cancels a load-timeout watchdog |
| `section-loading-complete` | `subscribeSectionLifecycleEvents` | A, R | A subscribes with an empty handler; R uses it |
| `section-items-complete-changed` | `subscribeSectionLifecycleEvents` | A | Subscribed, no handler body |
| `section-error` | `subscribeSectionLifecycleEvents` | A | Fatal: exits the delivery session |
| `item-session-changed` | DOM, bubbling and composed | A | `document`-level listener → snapshot + persist |

The `content-loaded` payload fields Host A reads are `itemId` and `contentKind`.
It counts distinct `itemId`s against the section's expected item list and treats
equality as "section loaded". Emitting `content-loaded` more than once per item,
or for an item outside the section, would leave the count short or overshoot;
either way the host's watchdog fires and ends the session.

`item-session-changed` reaches `document` because it is dispatched through
`dispatchCrossBoundaryEvent` in
`packages/assessment-toolkit/src/runtime/tool-host-contract.ts`, whose default
init is `bubbles: true, composed: true`. Dropping those defaults silently
disconnects that host listener.

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
  demo interactions
- `hydrate()` — A only, after `toolkit-ready`, with a retry loop while the
  method is absent
- `getSession()` — A only, snapshot before switching sections
- `applySession(session, { mode: "replace" })` — A only, resume, with a
  hand-built `{ currentItemIndex, visitedItemIdentifiers, itemSessions }`
  payload

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

Host R builds `runtime` as `{ assessmentId, toolConfigStrictness: 'off', tools:
<CanonicalToolsConfig> }` plus per-demo overrides, and passes `toolRegistry` as
a separate property. It is the only host that feeds the player a
`createToolsConfig` output rather than a hand-written literal, so it is the only
one that would notice `CanonicalToolsConfig` and the CE's expected `tools` shape
drifting apart.

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

Host R takes the opposite approach: it reads the token registry and inspects
computed values at runtime, so it depends on token *names and metadata* staying
addressable rather than on any particular value. It imports `tokens.css` but
**not** `color-schemes.css`, carrying its own `data-color-scheme` rules instead —
so new upstream scheme mappings do not reach it until someone syncs them by hand.

`--pie-fixed-hue-collapse` is one such mapping, added to the required scheme set:
every built-in scheme sets `100%`, which collapses a component's own fixed hues
into the palette. Host R's hand-carried scheme rules do not set it, so a
component encoding data by hue keeps that hue under Host R's schemes even though
it collapses under the shipped ones. Activating a scheme through `<pie-theme>`
rather than by writing the attribute does supply it, since the resolver defaults
it for any scheme it resolves.

## Direct `dist` path references

Host A lists four stylesheets in its build config by literal path:

```
node_modules/@pie-players/pie-theme/dist/tokens.css
node_modules/@pie-players/pie-theme/dist/color-schemes.css
node_modules/@pie-players/pie-theme/dist/font-sizes.css
node_modules/@pie-players/pie-theme/dist/components.css
```

These bypass the package `exports` map. All four are also exported under their
bare names, so the `exports` map alone is not enough to protect this host —
**the `dist` filenames themselves are API here**. Renaming, splitting, or
merging any of those four files breaks that build.

Host R additionally hard-codes the CDN path
`@pie-players/pie-item-player@<version>/dist/pie-item-player.js`, so that
filename is API too.

## Content stylesheet delivery

The most fragile shared surface, because it changed underneath the hosts.

`packages/item-player/src/pie-item-player.ts` inlines
`@pie-players/pie-theme/components.css?raw` and installs it into
`document.head` at import time via `installContentStyles`
(`packages/players-shared/src/ui/content-styles.ts`). That shipped in
**0.3.61**. `auditContentStyles` warns once per page when the host also loads
its own copy, or when the host opts out and then loads nothing. The opt-out is
`data-pie-content-styles="host"` on `<html>`.

Consequences per host:

- **Host V** pins `0.3.53`, before the fix, and works around its absence by
  importing the stylesheet text from `pie-theme` and re-injecting it wrapped in
  `@scope (.item-content)`. The scoping is deliberate: `components.css` carries
  bare `h1`–`h6`, `table`, `th`, `#stimulus`, `#item`, `.table`, and
  `.text-center` selectors that bleed onto a surrounding host UI if applied
  document-globally. On upgrading past 0.3.61 that host gets a *second,
  unscoped* copy installed by the player, reintroducing exactly the bleed it
  scoped around, plus the duplicate warning. It needs the opt-out attribute at
  the same time as the version bump.
- **Host A** already loads `components.css` document-globally through its build
  config and resolves a caret range that includes 0.3.61+, so it is in the
  duplicate state now: the player installs a copy and the host's copy loads
  later, winning ties at equal specificity.
- **Host R** imports no copy of its own, so it is the one host in the healthy
  configuration and the one that will not surface a regression here.

Any further change to how content styles are delivered has to account for all
three positions.

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

## Change-risk quick reference

Grouped by who breaks, not by how hard the change is. Host R is ours and
refactoring it is expected, so a surface only it touches is not a constraint —
change it and fix Host R in the same push.

**Silent breakage in a client-facing host (V or A). Coordinate before shipping.**

- Renaming `pie-section-player-splitpane`, `pie-section-player-item-card`, or
  `pie-section-player-passage-card`, or moving a card out from under the
  splitpane element
- Renaming or dropping any `--pie-*` token listed above
- Renaming any of the four `pie-theme/dist/*.css` files
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
- Changing how content styles are delivered, without accounting for all three
  host positions above

**Host R only. Change freely; land the internally controlled host fix in the
same push when its checkout is available.**

- `pie-section-player-vertical`, and anything in `default-tool-loaders`
- Requiring an explicit registration call from a `pie-tool-*` package that
  currently self-registers on import
- Renaming a `ToolConfigDiagnostic` code or a `TTSErrorCode` member
- Changing `supportedLevels` or `ToolRegistry.override` semantics
- `ToolkitCoordinator` constructor, `createToolsConfig`, `setHooks`,
  `updateAssessment`, `onPolicyChange`, `decideFeaturePolicy`
- The theme token registry, its four types, and the `tts-server-*` provider
  classes
- The return shape of `listPieColorSchemes()` and removed raw scheme helpers;
  migrate the internally controlled host to snapshots and `resolvePieTheme()`
  when its checkout is available
- `dist/pie-item-player.js` as a CDN filename

The coordinator constructor and `createToolsConfig` are pinned with `satisfies`
in Host R, so signature changes there surface as type errors on its next
typecheck rather than at runtime.

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
