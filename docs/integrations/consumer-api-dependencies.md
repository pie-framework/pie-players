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
business logic. Keep it that way when editing. Maintainers know the mapping;
agents working in this repo also have it in project memory.

Last verified against consumer checkouts and this repo's `develop` line:
**2026-08-13**.

## Consumer profiles

| Label | Stack | Packages consumed | Depth | Breakage cost |
| --- | --- | --- | --- | --- |
| **Host V** | Vue 3 + Vite | `pie-item-player`, `pie-theme` | One item at a time, read-only instructor rendering, behind a host feature flag; migrating off `@pie-framework/pie-player-components` | High — external client-facing |
| **Host A** | Angular + webpack | `pie-section-player`, `pie-assessment-toolkit`, `pie-theme`, `pie-theme-daisyui`, `pie-calculator-desmos`, `pie-tool-calculator-desmos`, `pie-tool-text-to-speech`, `tts-client-server`, `tts-server-polly`, two section-player debugger tools | Full fixed-form delivery: layout CE, toolkit coordinator, session persistence, TTS, calculator, PNP | Highest — external client-facing, drives live delivery |
| **Host S** | Stencil component suite | none | Wraps the legacy `@pie-framework/pie-player-components`; shares only the authored-content shape and the `@pie-element/*` version list | Low — internally controlled, and no `@pie-players` dependency to break |

Host V pins an exact patch (`0.3.53` at last read), so it upgrades
deliberately. Host A uses a caret range on the `0.3.x` line, so **every
published patch reaches it on its next install** — a lockstep patch that changes
behavior lands there without a code change on their side.

Host S matters only as a migration target. Nothing in this pad constrains
changes to `@pie-players` on its account.

## Package entrypoints in use

| Specifier | Consumer | Note |
| --- | --- | --- |
| `@pie-players/pie-item-player` | V | Dynamic `import()`, registration by side effect |
| `@pie-players/pie-theme` | A | Bare specifier → `dist/index.js`, which calls `definePieTheme()` at module scope |
| `@pie-players/pie-theme/theme-element` | V | Does **not** self-register; the host calls `definePieTheme()` itself |
| `@pie-players/pie-theme/components.css` | V | Imported as text and re-injected under `@scope`, see below |
| `@pie-players/pie-section-player/components/section-player-splitpane-element` | A | Static import, eager-bundled |

The self-registration asymmetry between `pie-theme` and
`pie-theme/theme-element` is load-bearing in both directions: V depends on
`theme-element` staying side-effect-free, A depends on the index entry keeping
its module-scope `definePieTheme()` call. Moving the call, or adding one to
`theme-element`, breaks one of them.

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

### `pie-section-player-splitpane` (Host A)

Object properties: `runtime`, `section`, `hooks`.

Attributes: `section-id`, `attempt-id`, `show-toolbar="false"`, `debug="false"`,
`narrow-layout-breakpoint`, `split-pane-initial-passage-width`,
`nds-icons="true"`.

Method called off a `document.querySelector` handle:
`waitForSectionController(timeoutMs)`.

Event consumed: `toolkit-ready`, read as `event.detail.coordinator`.

`show-toolbar` and `debug` are declared `type: "String"` and passed the literal
string `"false"`. Retyping either to `Boolean` inverts the host's intent, since
attribute presence would then read as `true`. Same trap for any other
`type: "String"` attribute a host sets to `"false"`.

### `pie-theme` (both)

Attributes used: `theme`, `scope`. V uses `theme="light" scope="self"`; A uses
`theme="light" scope="document"`. `observedAttributes` also carries `provider`,
`scheme`, and `variables`; neither host sets them today, and V's local typings
declare all five.

Neither host uses `theme="auto"`. Both deliberately force light so an
OS-dark-mode user does not get dark-rendered content inside a light-only host
UI.

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

## Events and coordinator callbacks

| Name | Route | Consumer | Use |
| --- | --- | --- | --- |
| `toolkit-ready` | DOM event on the layout CE | A | Captures `detail.coordinator`, then subscribes and hydrates |
| `item-session-data-changed` | `subscribeItemEvents` | A | Response capture → store dispatch → autosave |
| `content-loaded` | `subscribeItemEvents` | A | Per-item and `contentKind === "rubric"` load tracking; cancels a load-timeout watchdog |
| `section-loading-complete` | `subscribeSectionLifecycleEvents` | A | Subscribed, no handler body |
| `section-items-complete-changed` | `subscribeSectionLifecycleEvents` | A | Subscribed, no handler body |
| `section-error` | `subscribeSectionLifecycleEvents` | A | Fatal: exits the delivery session |
| `item-session-changed` | DOM, bubbling and composed | A | `document`-level listener → snapshot + persist |

The `content-loaded` payload fields the host reads are `itemId` and
`contentKind`. It counts distinct `itemId`s against the section's expected item
list and treats equality as "section loaded". Emitting `content-loaded` more
than once per item, or for an item outside the section, would leave the count
short or overshoot; either way the host's watchdog fires and ends the session.

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

Reached via `coordinator.getSectionController({ sectionId, attemptId })` or
`waitForSectionController(5000)`, all on Host A:

- `persist()` — on section switch and on every session change
- `hydrate()` — after `toolkit-ready`, with a retry loop while the method is
  absent
- `getSession()` — snapshot before switching sections
- `applySession(session, { mode: "replace" })` — resume, with a hand-built
  `{ currentItemIndex, visitedItemIdentifiers, itemSessions }` payload

Also consumed off the coordinator:

- `subscribeItemEvents({ eventTypes, listener })` → unsubscribe function
- `subscribeSectionLifecycleEvents({ eventTypes, listener })` → unsubscribe
  function
- `ttsService.stop()`
- `toolCoordinator.getVisibleTools()` and `toolCoordinator.hideTool(id)`

The host filters `getVisibleTools()` by `id.startsWith("calculator:")` to hide
open calculators on navigation. Tool-id prefixes are therefore observable API.

`applySession` keys `itemSessions` by the bare `item.id`, not by the QTI
identifier or the versioned item id. The host maintains an explicit translation
between the three id forms because the session map and the emitted session
events use the bare form. Changing which id form appears in either place breaks
resume and response routing at once.

Both hosts guard every controller method with optional-call syntax, so a method
that disappears degrades to a silent no-op — persist and hydrate stop happening
with no error surfaced. Removing one of these will not fail loudly downstream.

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

## Hooks

Host A passes `hooks.cardTitleFormatter`, a function reading
`context.kind` (`"item"` / `"passage"`), `context.itemIndex`,
`context.defaultTitle`, and `context.passage?.name`. It renumbers questions
across sections, so the formatter is the only thing producing correct question
numbers in that delivery. Changing the context shape, or calling the formatter
for a new `kind` without a `defaultTitle`, produces wrong or blank card titles.

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

The host also relies on being able to *win* against player styles at equal
specificity from outside, including with `!important`. Moving any of these
tokens behind a cascade layer, or resolving them at build time, removes that
lever.

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

## Content stylesheet delivery

The most fragile shared surface, because it changed underneath both hosts.

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

Any further change to how content styles are delivered has to account for both
positions.

## Change-risk quick reference

Highest risk, no downstream build signal:

- Renaming internal layout CE tags (`pie-section-player-item-card`,
  `pie-section-player-passage-card`, `pie-section-player-splitpane`)
- Renaming or dropping any `--pie-*` token listed above
- Renaming any of the four `pie-theme/dist/*.css` files
- Changing `bubbles` / `composed` defaults on cross-boundary events
- Reshaping `content-loaded` or `item-session-data-changed` payloads, or their
  emission cardinality
- Removing a controller method that hosts call with optional-call syntax
- Filtering unknown keys out of `env`
- Changing which item-id form appears in session maps or session events
- Retyping a `type: "String"` CE attribute to `Boolean`
- Moving `definePieTheme()` between the `pie-theme` index and `theme-element`

Lower risk, caught at build or startup downstream:

- Changes to entries in a package `exports` map that a host imports by
  specifier
- Removing a CE property a host sets through a typed wrapper

Free to change as far as these hosts are concerned:

- Anything only reachable through the assessment player, print player, tabbed
  or vertical section layouts, the toolbars package, `pie-context`, or
  `default-tool-loaders`
- Attributes and props on the splitpane element not listed above
- `theme="auto"` / `provider` / `scheme` / `variables` behavior on `pie-theme`
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

Re-derive rather than trust the rows. For each consumer checkout:

1. `grep -rn "@pie-players" <checkout>` outside `node_modules` and lockfiles —
   gives the entrypoint set and the version range.
2. Grep the same tree for `pie-` tag names, `--pie-` custom properties, and
   `::ng-deep` / `:deep` / `@scope` blocks — gives the CE and CSS surface.
3. Read the component that mounts the player end to end. The coordinator,
   controller, runtime, and hook usage is concentrated there and does not
   grep well.
4. Verify each claimed surface still exists in this repo before recording it;
   several rows above exist only because a grep came back empty.

Update the "last verified" date whenever you do this, and delete rows you could
not confirm rather than leaving them to rot.
