# @pie-players/pie-section-player

The section player renders one assessment section, its items and passages, as a
custom element. This README is the API reference for hosts that embed it: the
elements, their inputs, host methods and events, and the package exports. The
[section player integration guide](../../docs/section-player/integration-guide.md)
walks through an integration end to end,
[Custom Section Layouts](../../docs/section-player/custom-layouts.md) covers
host-built layouts, [Formative Delivery](../../docs/section-player/formative-delivery.md)
covers practice sections, and the package's
[architecture notes](./ARCHITECTURE.md) cover its internals.

## Install

```bash
npm install @pie-players/pie-section-player
```

```ts
import "@pie-players/pie-section-player";
```

Importing the package root registers every section player element. The root
entry is bundler-only: it imports `@pie-players/pie-item-player`,
`@pie-players/pie-default-tool-loaders` and `speech-rule-engine`, with the
engine's JSON locale tables, by bare specifier and without import attributes.
Items render through the host's one `@pie-players/pie-item-player`, which this
package depends on at its own version. A host without a bundler loads the
self-contained `./browser` build
([Loading from a CDN](../../docs/install/cdn.md#section-player-browser-build)).

The package is browser-only. `@pie-players/pie-section-player/item-section` is
its one Node-safe entry; the other Node-safe packages are listed in the
[library packaging strategy](../../docs/setup/library-packaging-strategy.md).

No stylesheet import is needed. Authored content depends on shared classes
(passage markup, the legacy `kds-*` families, answer-eliminator styles) from
`@pie-players/pie-theme/components.css`, and the item player installs that
stylesheet itself. [Content styles](../item-player/README.md#content-styles)
describes the host-ownership opt-out.

## Elements

| Element | Role |
| --- | --- |
| `pie-section-player-splitpane` | Passages and items side by side, with a resizable divider. Below the narrow breakpoint it collapses to tabs or a vertical stack |
| `pie-section-player-vertical` | The passages above the items |
| `pie-section-player-tabbed` | A Passage tab and a Questions tab when the section has passages; the items alone otherwise |
| `pie-section-player-kernel-host` | A section player without a layout of its own; its children are the layout ([Custom layout authoring](#custom-layout-authoring)) |
| `pie-section-player-items-pane`, `pie-section-player-passages-pane` | The panes a custom layout places inside the kernel host |
| `pie-section-player-item-card`, `pie-section-player-passage-card` | The cards the panes render, which hosts style ([Styling](#styling)) |

The layouts also render `pie-section-player-base`, `pie-section-player-shell`
and `pie-passage-shell`. Those are internal and not part of the API.

## Usage

```html
<pie-section-player-splitpane section-id="practice-set" attempt-id="attempt-1"></pie-section-player-splitpane>
```

```ts
import "@pie-players/pie-section-player";
import type {
  SectionPlayerRuntimeConfig,
  SectionPlayerRuntimeHostContract,
} from "@pie-players/pie-section-player";
import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

declare const section: AssessmentSection;

const runtime: SectionPlayerRuntimeConfig = {
  assessmentId: "practice-1",
  playerType: "iife",
  env: { mode: "gather", role: "student" },
};

const player = document.querySelector<HTMLElement & SectionPlayerRuntimeHostContract>(
  "pie-section-player-splitpane",
);
if (player) {
  player.runtime = runtime;
  player.section = section;
}
```

Strings and numbers are attributes; objects (`runtime`, `section`, `session` and
the rest of [Inputs](#inputs)) are JavaScript properties. `env` is a `runtime`
field: the layouts have no `env` property.

Set `runtime` no later than `section`. When the player builds its own
coordinator, the section's arrival rebuilds that coordinator from the current
`runtime`, so both can be set a tick after the element mounts. Once the section
has initialized, a change to `runtime.tools`, `runtime.assessmentId`,
`runtime.accessibility`, `runtime.lazyInit`, `tool-config-strictness` or
`toolRegistry` is reported once in the console and does not reach that
coordinator; `runtime.tools.pnpEnforcement` still applies. Change a running
coordinator through the one `toolkit-ready` carries, with
`updateToolConfig(...)` or `updateToolsPlacement(...)`, or pass your own as
`runtime.coordinator`.

Attributes cover standard delivery. Host policy runs in host code over the
JavaScript surface: the [host methods](#host-methods), the
[section controller](#section-controller) and its [events](#events). The player
has no gating API of its own; a host composes forward and backward eligibility
from `getSnapshot().navigation` and controller events. Updates that leave the
composition unchanged (responses, tool toggles, runtime changes that keep the
same items) keep every item and passage mounted and keep each pane's scroll
position ([flow invariants](./ARCHITECTURE.md#unidirectional-flow-invariants)).

The `single-question` and `session-hydrate-db` routes of `apps/section-demos`
([single question](../../apps/section-demos/src/routes/%28demos%29/single-question/+page.svelte),
[session hydration](../../apps/section-demos/src/routes/%28demos%29/session-hydrate-db/+page.svelte))
are complete host integrations.

## Inputs

The three layouts take these inputs. `pie-section-player-kernel-host` takes all
of them except the [layout dimensions](#layout-dimensions). Numeric attributes
are clamped to their range.

| Input | Form | Default | Effect |
| --- | --- | --- | --- |
| `runtime` | property | — | Player strategy, tools, accessibility, coordinator, env and callbacks ([Runtime configuration](#runtime-configuration)) |
| `section` | property | — | The `AssessmentSection` to deliver |
| `session` | property | — | The section's session, a `SectionControllerSessionState` ([Session lifecycle](#session-lifecycle)) |
| `assessment` | property | — | The `AssessmentEntity` whose `personalNeedsProfile` and `settings` tool policy reads, forwarded to a coordinator the player builds. A coordinator passed in `runtime` is the host's to bind with `updateAssessment`. A section's own `personalNeedsProfile` is not read, and the player warns once when it finds one |
| `policies` | property | `DEFAULT_SECTION_PLAYER_POLICIES` | A partial `SectionPlayerPolicies` for readiness, element pre-warm and telemetry ([Policies](#policies)) |
| `hooks` | property | — | Host callbacks, a `SectionPlayerHostHooks` ([Card titles](#card-titles)) |
| `toolRegistry` | property | `createPackagedToolRegistry()` | The registry the toolbars load tools from ([Tools](#tools)) |
| `sectionHostButtons`, `itemHostButtons`, `passageHostButtons` | property | — | Host buttons appended to the section, item and passage toolbars |
| `section-id` | attribute | `section.identifier`, then `section-<assessmentId>` | The section's id for its controller and persistence |
| `attempt-id` | attribute | — | The attempt the session belongs to. Without one the default persistence neither reads nor writes |
| `locale` | attribute | `en-US` | BCP-47 locale of the player's own interface text. It never sets `runtime.contentLanguage` |
| `base-heading-level` | attribute | `2` (1–6) | The level of the card headings, from which every descendant's outline derives ([Heading structure](#heading-structure)) |
| `show-toolbar` | attribute | `false` | Renders the section toolbar, which section-level tools need. Accepts `true`/`false`, `1`/`0` and `yes`/`no` |
| `toolbar-position` | attribute | `right` | `top`, `right`, `bottom`, `left` or `none` |
| `tool-config-strictness` | attribute | `error` | `off`, `warn` or `error` for tool configuration validation |
| `nds-icons` | attribute | — | Renders toolbar buttons as NDS icon buttons (below) |
| `iife-bundle-host` | attribute | — | The bundle host for the IIFE element pre-warm when `runtime.player.loaderOptions.bundleHost` is unset |
| `debug` | attribute | — | Debug logging (`true` enables, `false` or `0` disables; [Debug logging](#debug-logging)) |
| `narrow-layout-breakpoint` | attribute | `1100` (400–2000) | The viewport width in px at or below which the layout narrows |
| `content-max-width-no-passage` | attribute | unset (320–2200) | Maximum content width in px for a section without passages |
| `content-max-width-with-passage` | attribute | unset (320–2200) | Maximum content width in px for a section with passages |
| `split-pane-initial-passage-width` | attribute | `50` (20–80) | Splitpane only: the passage pane's width in percent at mount |
| `split-pane-min-region-width` | attribute | unset (160–1200) | Splitpane only: the minimum pane width in px. Unset, the divider stays between 20% and 80% |
| `split-pane-collapse-strategy` | attribute | `tabbed` | Splitpane only: `tabbed` or `vertical` below the breakpoint |

`nds-icons` opts in to the Renaissance Next Design System (NDS) icon buttons,
which render in Font Awesome and Roboto. The players add Font Awesome Free from
jsDelivr unless the page links a Font Awesome stylesheet, and the buttons add
Roboto from `ui.renaissance.com` unless the page links a stylesheet whose URL
contains `Roboto`. That CDN serves the font files to Renaissance origins only,
so a page elsewhere links its own Roboto. A page that links Font Awesome Pro
keeps the design's Light and Regular weights; without Pro every glyph renders in
Solid.

### Layout dimensions

At or below `narrow-layout-breakpoint` the splitpane renders its
`split-pane-collapse-strategy` view, and every layout moves the section toolbar
to `top`, whatever `toolbar-position` says, `none` included. The shell
separately moves a `left` or `right` toolbar to `top` at a fixed 1100px, so with
a smaller breakpoint side toolbars still move to the top from 1100px down.

The vertical and tabbed layouts take the two max-width attributes too. When
both are set, the with-passage cap resolves to the greater of the two after
clamping, so a section with passages is never narrower than one without.

```html
<pie-section-player-splitpane
  content-max-width-no-passage="800"
  content-max-width-with-passage="1200"
  split-pane-min-region-width="280"
  split-pane-collapse-strategy="vertical"
></pie-section-player-splitpane>
```

### Runtime configuration

`runtime` is a `SectionPlayerRuntimeConfig`. `locale`, `nds-icons` and
`tool-config-strictness` are attributes only.

| Key | Default | Effect |
| --- | --- | --- |
| `assessmentId` | — | The assessment the section belongs to; part of every session key |
| `playerType` | `"iife"` | The item player strategy: `"iife"`, `"esm"` or `"preloaded"` ([Preloaded elements](#preloaded-elements)) |
| `player` | — | Item player settings: `hosted`, `loaderOptions`, `loaderConfig`, `backend` and `resolveBackend` ([Backend delivery](#backend-delivery-for-embedded-items)). Every other field is passed to each embedded item player as a property |
| `env` | `{ mode: "gather", role: "student" }` | The section env every item renders in |
| `contentLanguage` | `en-US` | BCP-47 language of content whose markup names none; read-aloud speaks in it and catalog cards are picked by it. A `lang` between the content and its card wins |
| `tools` | — | Tool placement, providers and policy ([Tools](#tools)) |
| `toolContextResolvers` | — | Per-tool resolvers that run after the policy gates: they can hide a tool that survived them or attach render parameters, and cannot re-enable a removed one |
| `accessibility` | — | `{ catalogs, language }`: accessibility catalogs and their language |
| `lazyInit` | `false` | Starts text to speech at first use. `waitUntilReady()` then settles without it unless policy grants the tool |
| `coordinator` | — | A `ToolkitCoordinator` the host built. Unset, the player builds one |
| `isolation` | `"inherit"` | Without `coordinator`, `"inherit"` shares an enclosing toolkit's coordinator when there is one; `"force"` keeps the player's own |
| `createSectionController` | — | A factory for the section controller ([Custom section controllers](#custom-section-controllers)) |
| `onStageChange`, `onLoadingComplete`, `onFrameworkError` | — | Callbacks with each `pie-stage-change` detail, the `pie-loading-complete` detail and each framework error model ([Instrumentation](#instrumentation)) |

### Tools

Tool placement is empty by default. `runtime.tools.placement` places tools by
scope (`section`, `item`, `passage`), and
`SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT` from
`@pie-players/pie-default-tool-loaders` is the packaged opt-in. Section-level
tools render only when `show-toolbar` is set. The
[canonical tool ids](../../docs/tools-and-accomodations/tool_provider_system.md#canonical-tool-ids)
are listed with the tool provider system. Tool configuration is validated when
the toolkit initializes, toolbar overlays included, at the
`tool-config-strictness` level. The text-to-speech provider is configured under
`tools.providers.textToSpeech`; validation rejects `tools.providers.tts`.

```ts
import {
  SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT,
  createPackagedToolRegistry,
} from "@pie-players/pie-default-tool-loaders";
import type { SectionPlayerRuntimeHostContract } from "@pie-players/pie-section-player";

const player = document.querySelector<HTMLElement & SectionPlayerRuntimeHostContract>(
  "pie-section-player-splitpane",
);
if (player) {
  player.toolRegistry = createPackagedToolRegistry();
  player.runtime = {
    assessmentId: "practice-1",
    tools: { placement: SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT },
  };
}
```

`toolRegistry` replaces the packaged registry. Build it with
`createPackagedToolRegistry()` and register custom tools on it, since the
toolbars load each tool's element through the registry's loaders. A coordinator
the player builds takes this registry. A coordinator passed as
`runtime.coordinator` keeps the registry it was constructed with, which decides
policy; constructed without one, it takes the player's.

### Policies

`policies` is a partial `SectionPlayerPolicies`. Every unset field takes its
value from `DEFAULT_SECTION_PLAYER_POLICIES`, exported from the package root and
from `@pie-players/pie-section-player/policies`.

| Field | Default | Effect |
| --- | --- | --- |
| `readiness.mode` | `"progressive"` | `"progressive"` or `"strict"`. Both hold the `interactive` stage and `pie-loading-complete` until the element pre-warm resolves, and the two currently emit the same sequence |
| `preload.enabled` | `true` | `false` skips the section's element pre-warm, the step that loads every element the items name before they mount. Items still mount, and each item player registers its own elements. For a host that owns element registration end to end |
| `telemetry.enabled` | `true` | `false` stops the `pie-section-*` instrumentation stream ([Instrumentation](#instrumentation)) |

`resolveSectionPlayerPolicies(policies)` from
`@pie-players/pie-section-player/policies` returns the filled-in object, for
host code that applies the same gates.

### Card titles

`hooks.cardTitleFormatter` sets the heading of each item and passage card:

```ts
import type { SectionPlayerHostHooks } from "@pie-players/pie-section-player";

const hooks: SectionPlayerHostHooks = {
  cardTitleFormatter: (context) =>
    context.kind === "item"
      ? `Question ${context.itemIndex + 1}: ${context.item.name || context.defaultTitle}`
      : context.passage.name || context.defaultTitle,
};
```

An item context carries `item`, `itemIndex`, `itemCount`, `canonicalItemId` and
`defaultTitle`, the localized "Question N" ("Question" for a one-item section);
a passage context carries `passage` and `defaultTitle`. A formatter that returns
anything but a non-empty string, or throws, gets `defaultTitle`. The formatter
stays active across the splitpane's narrow and wide transitions.

### Debug logging

Debug logging is page-wide. A layout's `debug` attribute writes
`window.PIE_DEBUG`, the flag every PIE logger on the page reads, so the last
host to set it decides for all of them. Without a `debug` attribute a layout
follows `window.PIE_DEBUG`, which a host can set directly.

## Host methods

The layouts and the kernel host implement `SectionPlayerRuntimeHostContract`:

| Method | Returns | Effect |
| --- | --- | --- |
| `getSnapshot()` | `SectionPlayerSnapshot` | `{ composition: { itemsCount, passagesCount }, navigation: { currentIndex, totalItems, canNext, canPrevious, currentItemId } }` |
| `navigateTo(index)` | `boolean` | Moves to the item at a zero-based index; `false` when it cannot |
| `navigateNext()`, `navigatePrevious()` | `boolean` | Moves one item; `false` when it cannot |
| `getSectionController()` | `SectionControllerHandle \| null` | The current section's controller |
| `waitForSectionController(timeoutMs = 5000)` | `Promise<SectionControllerHandle \| null>` | Resolves at once when the controller is resolvable, else at the next `toolkit-ready`, else at the timeout with the current lookup, which may be `null` |

The methods exist from the moment the element is created. Until it mounts,
`waitForSectionController` waits, `getSectionController()` returns `null`, the
navigation methods return `false`, and `getSnapshot()` returns `null` on the
stock layouts and the bootstrap snapshot (zero counts, no navigation) on the
kernel host.

```ts
import type { SectionPlayerRuntimeHostContract } from "@pie-players/pie-section-player";

const player = document.querySelector<HTMLElement & SectionPlayerRuntimeHostContract>(
  "pie-section-player-splitpane",
);
const controller = await player?.waitForSectionController(5000);

let sectionComplete = false;
const unsubscribe = controller?.subscribe?.((event) => {
  if (event.type === "section-items-complete-changed") {
    sectionComplete = event.complete;
  }
});

function canAdvance(): boolean {
  return Boolean(player?.getSnapshot()?.navigation.canNext && sectionComplete);
}
```

## Section controller

The section controller is the section's domain authority: it owns in-section
navigation, the canonical aggregation of item sessions and the persistence
snapshot. The layouts are transport adapters around it
([controller ownership](./ARCHITECTURE.md#controller-ownership)). Its handle,
`SectionControllerHandle` from `@pie-players/pie-assessment-toolkit`, declares
every member optional, and the interface's JSDoc carries the per-method
contract.

| Member | Effect |
| --- | --- |
| `getSession()` | The section session, a `SectionControllerSessionState`: `currentItemIndex`, `visitedItemIdentifiers`, `itemSessions`, and `formative` and `timedMedia` when the section uses them |
| `applySession(session, { mode })` | Applies a section session. `"replace"` (the default) replaces it; `"merge"` overlays it item by item. Item entries may be canonical entries or raw item sessions |
| `updateItemSession(itemId, detail)` | Writes one item's session synchronously and emits `item-session-data-changed` or `item-session-meta-changed` |
| `hydrate()` | Loads the session from the persistence strategy and applies it in replace mode; a no-op without a strategy or a stored session |
| `persist()` | Saves the session through the strategy, at the host's cadence; a no-op without one |
| `configureSessionPersistence({ context, strategy })` | Sets the persistence strategy |
| `subscribe(listener)` | Delivers every controller event to `listener` until the returned function is called or the controller is disposed |
| `getRuntimeState()` | Introspection only; persist `getSession()` |
| `updateInput(input)` | Refreshes the composition for the same cohort, the `(sectionId, attemptId)` pair, and keeps the in-memory session |
| Formative members | `recordFormativeTry`, `retryFormativeItem`, `revealFormativeItem`, `hideFormativeItem`, `getFormativeProjection` ([Formative delivery](#formative-delivery)) |
| Timed-media members | `attachMediaTimeSource`, `detachMediaTimeSource`, `pauseMediaForCompetingAudio`, `getTimedMediaProjection` ([Timed media](#timed-media)) |

### Session lifecycle

Set `session` with `section` to restore a section. The controller created for
that section applies it in replace mode in place of hydrating from the
persistence strategy, before the controller is published, so the first
composition, `engine-ready` and every reader see it. The strategy still receives
every `persist()`.

A later assignment applies through `applySession(value, { mode: "replace" })`
under the rules `<pie-item-player>` applies to its `session`: a value equal to
the current session is a no-op, so echoing `session-changed` back is safe, and an
item session with neither a response value nor a response field leaves one that
holds responses in place. `null` after creation is a no-op. A `section` change
without a `session` assignment hydrates the new controller from the strategy.
Reading `session` returns the assigned value until the controller is published,
and a fresh `getSession()` snapshot after.

Driving the controller directly:

```ts
controller?.configureSessionPersistence?.({ context, strategy });
await controller?.hydrate?.();
const unsubscribe = controller?.subscribe?.(handleEvent);
// Later, on save or unload:
await controller?.persist?.();
unsubscribe?.();
```

### Item session management

`getSession()`, `applySession()` and `updateItemSession()` exchange the same
`SectionControllerSessionState` the persistence strategy loads and saves and the
`session` property takes.

```ts
import type { SectionPlayerRuntimeHostContract } from "@pie-players/pie-section-player";

const player = document.querySelector<HTMLElement & SectionPlayerRuntimeHostContract>(
  "pie-section-player-splitpane",
);
const controller = await player?.waitForSectionController(5000);

// Read the current section session.
const currentSession = controller?.getSession?.();

// Replace the section session, as when resuming from a stored snapshot.
await controller?.applySession?.(
  {
    currentItemIndex: 0,
    visitedItemIdentifiers: ["q1"],
    itemSessions: {
      q1: {
        itemIdentifier: "q1",
        pieSessionId: "q1-session",
        session: { id: "q1-session", data: [{ id: "choice", value: "a" }] },
      },
    },
  },
  { mode: "replace" },
);

// Update one item's session.
controller?.updateItemSession?.("q1", {
  session: { id: "q1-session", data: [{ id: "choice", value: "b" }] },
  complete: true,
});
```

### Commit at a section boundary

A delivery element coalesces its `session-changed` dispatch, so a response the
learner has finished entering can still be pending when the section moves. The
controller commits pending element sessions before item navigation, before
`updateInput()` snapshots the session for a section swap, and before `persist()`.
The player also commits when an item shell tears down and when the page goes
hidden.

A committed response travels like any other. A raw element `session-changed`
does not leave its `<pie-item-scope>`, which re-dispatches it as the normalized
`item-session-changed` (`PIE_ITEM_SESSION_CHANGED_EVENT`); the toolkit then
publishes the section's canonical `session-changed`. Both bubble through the
layout element to `document`, and a listener on either receives each dispatch
once. Host code persists from the controller's events or from its session
snapshot.

Each of those events marks a commit with `sessionCommitReason`
(`"teardown" | "navigate" | "page-hidden"`): `item-session-changed`, the
toolkit's `session-changed`, and the controller's `item-session-data-changed`
and `item-session-meta-changed`. A commit at a section swap or item navigation
reports the item being left, which the host may already have moved past, so a
handler that sets its current item or navigation state from these events leaves
that state alone on a commit and persists the commit's session as usual. The
controller's events also carry `sectionId`, the section the item belongs to.

Navigation inside a section keeps every item mounted, so nothing is discarded
and the element's own debounce would complete on its own. The commit still runs
there because the response belongs to the item being left: a host that persists
on the navigation event, or a `persist()` that follows it, would otherwise
snapshot a session the learner had already changed.

The section controller is DOM-free, so the player supplies the commit through
the handle's `setPendingSessionCommit()`. The player registers it on the
controllers it creates and on one the toolkit has already built. A host-built
controller that leaves the method unimplemented gets no commit, and a pending
response is lost at those boundaries.

### Custom section controllers

`runtime.createSectionController` is a factory the player calls for each
section's controller. A coordinator's `hooks.createSectionController` takes
precedence over it; without either, the player constructs a `SectionController`.
The player builds its own coordinator without hooks, so a host that lets it do
so supplies a controller through `runtime.createSectionController`.

## Events

### DOM events

Every event bubbles and is composed, so it reaches `document`, and a listener on
the layout element receives each one. The layout element dispatches
`pie-stage-change`, `pie-loading-complete` and the `element-preload-*` events.
The toolkit dispatches the runtime, readiness, composition, `session-changed`
and `framework-error` events on the inner `pie-section-player-base`, and they
bubble out through the layout element. `item-session-changed` starts at the
item's `<pie-item-scope>`.

| Event | Detail | When |
| --- | --- | --- |
| `runtime-owned`, `runtime-inherited` | `runtimeId`, `parentRuntimeId` | The player's toolkit owns its coordinator, or shares an enclosing one |
| `runtime-ready` | `runtimeId`, `coordinator`, `ownership` | Once per coordinator, before the first section starts: the earliest point a host holds the coordinator |
| `toolkit-ready` | `runtimeId`, `assessmentId`, `sectionId`, `itemPlayer`, `coordinator` | For each section, a microtask after its controller resolves and its composition goes out |
| `section-ready` | `sectionId`, `attemptId`, `controller` (or `null`) | After that section's `toolkit-ready` and its `engine-ready` stage |
| `composition-changed` | `composition`, `version` | The composition changed; `composition.formative` carries the formative projection |
| `session-changed` | The normalized item session, plus `itemId`, `canonicalItemId` and `sourceRuntimeId` | An item's session changed |
| `item-session-changed` | The normalized item session | Re-dispatched by `<pie-item-scope>` from an element's `session-changed` |
| `pie-stage-change` | `stage`, `status`, `runtimeId`, `sectionId`, `attemptId`, `timestamp`, `sourceCe` | A lifecycle stage was entered: `composed`, `engine-ready`, `interactive`, `disposed` |
| `pie-loading-complete` | `runtimeId`, `sectionId`, `attemptId`, `itemCount`, `timestamp`, `sourceCe` | Once per cohort, after `section-ready` and the element pre-warm, before the items load |
| `framework-error` | A `FrameworkErrorModel` | Any failure crossing the framework boundary, once per error |
| `element-preload-retry`, `element-preload-error` | `assessmentId`, `sectionId`, `attemptId` | The element pre-warm retried or failed |

A first section starts in this order: `pie-stage-change` `composed`,
`runtime-ready`, `toolkit-ready`, `section-ready`, `pie-stage-change`
`engine-ready`, then `pie-stage-change` `interactive` and `pie-loading-complete`
once the element pre-warm resolves. The items load after that; the controller's
`section-loading-complete` marks every one loaded, and a session applied before
then is announced again as `section-session-applied` with `replay: true`.

A non-recoverable framework error before `interactive` ends the stage chain:
the first stage the section did not reach is emitted as `failed`, and any after
it as `skipped`. A pre-warm failure also arrives as an `element-preload`
framework error.

### Controller events

`subscribe()` on the handle, and the coordinator's subscription helpers,
deliver `SectionControllerEvent`, a union discriminated by `type`. Every event
carries `timestamp`, and every one except `section-navigation-change` carries
`currentItemIndex`.

| Event | Payload | Emitted when |
| --- | --- | --- |
| `item-selected` | `previousItemId`, `currentItemId`, `itemIndex`, `totalItems` | Item navigation within the section |
| `item-session-data-changed` | `itemId`, `canonicalItemId`, `session`, `intent`, `complete`, `component`, `elementId`, `sectionId`, `sessionCommitReason` | An item's response changed |
| `item-session-meta-changed` | As above, without `session` and `intent` | An item's session metadata changed |
| `item-complete-changed` | `itemId`, `canonicalItemId`, `complete`, `previousComplete` | An item's completion flipped |
| `content-loaded` | `contentKind` (`item`, `passage`, `rubric`, `unknown`), `itemId`, `canonicalItemId`, `detail` | A passage, item or rubric finished loading |
| `item-player-error` | `contentKind`, `itemId`, `canonicalItemId`, `error` | An item player failed |
| `section-loading-complete` | `totalRegistered`, `totalLoaded` | Every renderable in the section finished loading |
| `section-items-complete-changed` | `complete`, `completedCount`, `totalItems` | The section's aggregate completion flipped |
| `section-session-applied` | `mode`, `itemSessionCount`, `replay` | A session was applied; `replay: true` after `section-loading-complete` |
| `section-navigation-change` | `previousSectionId`, `currentSectionId`, `attemptId`, `reason` (`input-change`, `runtime-transition`) | The controller's section identity changed |
| `section-error` | `source`, `error`, `itemId`, `canonicalItemId`, `contentKind` | An item player failed (`source: "item-player"`), or the section runtime did (`"section-runtime"`), a rejected element pre-warm included, which leaves the items unmounted |
| `formative-try-recorded` | `itemId`, `canonicalItemId`, `tryCount`, `outcome`, `revealed` | A Try was recorded |
| `formative-reveal-changed` | `itemId`, `canonicalItemId`, `revealed`, `feedback`, `tryCount`, `source` | The reveal changed without a Try |
| `section-mastery-changed` | `mastery` | The mastery rollup changed |
| `timed-media-cue-changed` | Active, visited and completed cues, `revealedItemIds`, `gateCueIdentifier`, `mediaCompleted`, `aggregateComplete` | A cue activated, a gate released, or aggregate completion flipped |
| `timed-media-audio-started` | — | Media audio is running, so read-aloud yields |
| `timed-media-policy-degraded` | `degradations` | The media time source cannot carry out a playback policy |
| `timed-media-invalid` | `errors` | The authored `timedMedia` cannot be delivered |

An item is complete when every element that has reported its completion is
complete. A report without `elementId`, and a restored session's item-level
`complete`, set the item's completion directly. A session restored through
`applySession` without `complete` is complete when it holds a response. A
passage's own `session-changed` stays inside its shell: a passage holds no
response.

`timed-media-cue-changed` is not emitted for media position: `timeupdate` fires
about four times a second and moves nothing a layout renders.
`timed-media-audio-started` is emitted only where playback actually started; a
gate that re-paused on the same `play` produced no audio.

### Subscriptions

The coordinator's helpers follow the active cohort, the `(sectionId, attemptId)`
pair, across section changes, so one subscription survives navigation; the
handle's `subscribe()` ends with its controller.

```ts
const unsubscribeItems = coordinator.subscribeItemEvents({
  listener: (event) => {
    // item-selected, item-session-*, item-complete-changed, content-loaded, item-player-error
  },
});

const unsubscribeSection = coordinator.subscribeSectionLifecycleEvents({
  listener: (event) => {
    // section-navigation-change, section-session-applied, section-loading-complete,
    // section-items-complete-changed, section-error, timed-media-* (except audio-started)
  },
});
```

The defaults leave out `formative-try-recorded`, `formative-reveal-changed`,
`section-mastery-changed` and `timed-media-audio-started`. Name them in
`subscribeItemEvents({ eventTypes })`, or subscribe through
`subscribeSectionEvents({ listener, eventTypes, itemIds })`.

A helper called before the coordinator's first section has been requested
throws ("requires an active section cohort"). `runtime-ready` fires before that
request, so a host subscribes from `toolkit-ready` or later. A listener added
while a section is starting binds when it becomes active.

Item-scoped events carry both id forms, and both are always populated.
`itemId` is the bare `item.id`, the form `applySession` expects.
`canonicalItemId` is that item's adapter identifier, and falls back to `itemId`
when the section was not built from an adapter or no adapter ref matches it.
Correlate with formative policy and `runtime.player.resolveBackend` by
`canonicalItemId`; reach the session by `itemId`.

## Formative delivery

A section with `formative` set delivers as practice: each formative item gets a
check-answer control, records Tries against `maxTries`, and reveals feedback by
`feedback` and `revealOn` (`"on-try"`, or `"on-final-try"`, which resolves to
`"on-try"` under `maxTries: "unlimited"`). An item ref changes the section's
policy field by field. A revealed item gets the env projection, `mode:
"evaluate"` (with `role: "instructor"` under `feedback: "solution"`) over the
section env for that item alone, and the element draws the feedback. A section
in which no item is enabled delivers unchanged, with no control, state or env
projection. Scoring a Try needs an unhosted item player
([player requirements](../../docs/section-player/formative-delivery.md#player-requirements)):
in a hosted player `provideScore()` returns empty slots and every Try records
`unknown`. [Formative Delivery](../../docs/section-player/formative-delivery.md)
covers the policy, the controller methods and events, mastery and persistence;
the [formative delivery contract](../../docs/prds/formative-delivery-contract.md)
holds the specification and its QTI 3 mapping.

## Timed media

Set `sectionType: "timed-media"` and a `timedMedia` block, and the section's cue
timeline decides when its items are delivered:

```ts
const section: AssessmentSection = {
  identifier: "water-cycle",
  sectionType: "timed-media",
  // A correctness gate needs unlimited Tries; see below.
  formative: { enabled: true, maxTries: "unlimited", feedback: "correctness" },
  rubricBlocks: [
    {
      identifier: "video-stimulus-1",
      class: "stimulus",
      view: ["candidate"],
      // An ordinary passage. Its config mounts the media element — a PIE element,
      // or authored `<video>` markup, whose `<track>` carries the captions — and
      // its accessibility catalogs carry the transcript and signed alternates.
      passage: videoPassage,
    },
  ],
  assessmentItemRefs: [{ identifier: "q1", item }, { identifier: "q2", item }],
  timedMedia: {
    stimulusRef: "video-stimulus-1",
    cues: [
      { identifier: "c1", range: { startSeconds: 4 }, itemRefs: ["q1"], policy: { activation: "reveal" } },
      {
        identifier: "c2",
        range: { startSeconds: 10 },
        itemRefs: ["q2"],
        policy: { activation: "gate", releaseOn: "correct", onUnknownCorrectness: "release" },
      },
    ],
    playbackPolicy: { allowSeekAhead: false, pauseOnRequiredCue: true, requireMediaCompletion: false },
  },
};
```

Every item a gate names must satisfy its `releaseOn`. To split must-answer items
from optional ones, author two cues at the same timestamp: a gate over the first
set and a reveal over the second. Both activate in the same pass, the reveal
completes at once, and only the gate holds playback.

Without `sectionType`, delivery is unchanged: no projection, no session slice,
no cue behavior. An item no `reveal` or `gate` cue names is delivered normally,
including one a `metadata` cue names, since metadata records state and reveals
nothing. A cued item is mounted and hidden until its cue fires, so its session
and shell registration survive a seek backwards.

The section reaches media only through a **Media Time Source**. The stimulus
card finds the media element its passage mounted and registers a native adapter;
a host with its own player registers its own port, which outranks the card's
adapter for as long as it is attached:

```ts
const controller = await host.waitForSectionController(5000);
// No `renderableId`: a host asserts its own port. A renderable's adapter names
// itself, and is ignored unless it is the resolved stimulus.
controller?.attachMediaTimeSource?.(myThirdPartyPort);
controller?.detachMediaTimeSource?.();
controller?.getTimedMediaProjection?.(); // cues, gate, enforcement, revealed items
// One half of the read-aloud handoff. `false` means the port cannot pause, and
// the overlap stands; the accommodation is not withheld.
controller?.pauseMediaForCompetingAudio?.();
```

Read-aloud and media audio never run at once, and the action the learner just
took wins: starting read-aloud pauses media, starting media pauses read-aloud.
The section supplies both halves, the method above and
`timed-media-audio-started`, and the toolkit arbitrates between them, because
only the toolkit holds both the text-to-speech service and the section. Neither
direction resumes what it silenced.

Where the port reports `canPause: false` or `canRestrictSeeking: false`, the
matching policy degrades to **advisory**: cues still fire, state is still
recorded, the projection says `enforcement: "advisory"`, and a recoverable
`timed-media` framework warning names the policy that can no longer be
enforced.

Three authoring mistakes fail loudly: a `stimulusRef` that resolves to no
renderable in the section; a gate on correctness over an item without unlimited
Tries, where a learner who spent a finite budget could never release playback
again; and a `stimulusRef` that resolves to a renderable which mounts no media,
reported once the section's content has loaded and no time source has attached.
Each reports a `timed-media` framework error, after which the section delivers
as an ordinary section with every item visible.

Cue state persists inside `SectionControllerSessionState.timedMedia` and
hydrates with the rest of the snapshot, including the furthest position reached,
which `allowSeekAhead: false` clamps against across a reload. The
[timed-media section contract](../../docs/prds/timed-media-section-contract.md)
holds the contract and its decision record.

## One item as a section

`sectionFromItem` wraps one item config, in the shape `<pie-item-player config>`
takes, and optionally its session, in the `section` and `session` the layouts
take. It is exported from the package root and from
`@pie-players/pie-section-player/item-section`, which defines no custom element
and imports in Node.js.

```ts
import { sectionFromItem } from "@pie-players/pie-section-player/item-section";

const { section, session } = sectionFromItem(itemConfig, { session: itemSession });
player.section = section;
player.session = session;
```

The item ref's `identifier` and the item's `id` are the config's `id`, so every
`itemId` the section reports is the id the host already holds. An advanced
config's `passage` becomes the item's passage, and its `instructorResources` and
`defaultExtraModels` stay on the item's config. The section carries no `baseId`
or `version`; `options.sectionId` names the section, which defaults to the
config's `id`, and the player takes it as the section id when `section-id` is
unset.

## Backend delivery for embedded items

A host configures item player backend delivery once, on the section player's
runtime, for a delivery backend that processes models and scores on the server.
The section player derives a `backend` property for each embedded item player
before it renders the item.

```ts
import type { SectionPlayerRuntimeConfig } from "@pie-players/pie-section-player";

const runtime: SectionPlayerRuntimeConfig = {
  playerType: "iife",
  env: { mode: "gather", role: "student" },
  player: {
    backend: {
      delivery: {
        enabled: true,
        baseUrl: apiBaseUrl,
        assignmentId,
        autosave: { enabled: true, debounceMs: 250 },
      },
    },
  },
};

sectionPlayer.runtime = runtime;
```

With `runtime.player.backend.delivery` enabled, each item player's `itemId` and
`sessionId` are its per-item delivery identity, derived from
`canonicalItemId || item.id` and the item session. Static delivery fields
(`baseUrl`, `auth`, `endpoints`, `assignmentId`, `autosave`) are kept. Set
`assignmentId` to the backend assignment the items are delivered under.

An enabled `backend.delivery` also sets `hosted: true` on each embedded item
player unless `runtime.player.hosted` is set, so the item players load no
element controllers and render the models the server returns. Those item players
cannot score in the browser, so formative Tries record `unknown`: formative
delivery needs an unhosted player.

`runtime.player.resolveBackend(context, baseBackend)` maps per-item identity
when the derivation does not fit. `context` carries `itemId`, `canonicalItemId`,
`item`, `itemIndex`, `itemSession`, `sectionId`, `env` and `baseBackend`; the
returned config merges over the derived backend, and a nullish return keeps it.
The resolver receives cloned backend objects, so a per-item change neither
mutates the shared runtime nor leaks across items, and the key is removed before
the properties reach `<pie-item-player>`.

The section player derives `backend` and calls nothing on the item players. An
embedded `<pie-item-player>` loads on its own when its derived
`backend.delivery` has a load signature, so every mounted item player issues one
backend load for its own item. Passage players receive the shared non-delivery
backend configuration and no item delivery configuration. This configuration is
separate from the element loader, which hands IIFE and ESM bundle loads to an
adapter (`preloaded` uses none). The item player's
[backend support](../../docs/item-player/backend-support.md) guide covers the
delivery backend contract.

### Section session persistence

Section state persists outside `runtime.player.backend`, which covers one
item's calls. A coordinator hook,
`ToolkitCoordinatorHooks.createSectionSessionPersistence`, returns the strategy
for each section controller, created once per `(assessmentId, sectionId,
attemptId)`; it loads and saves the `SectionControllerSessionState` that carries
navigation, item sessions, and formative and timed-media state.

```ts
import { ToolkitCoordinator } from "@pie-players/pie-assessment-toolkit";
import type { SectionPlayerRuntimeConfig } from "@pie-players/pie-section-player";

const coordinator = new ToolkitCoordinator({
  assessmentId: "practice-1",
  hooks: {
    createSectionSessionPersistence: () => ({
      async loadSession({ key }) {
        return await loadSectionSession(key.sectionId, key.attemptId);
      },
      async saveSession({ key }, session) {
        await saveSectionSession(key.sectionId, key.attemptId, session);
      },
    }),
  },
});

const runtime: SectionPlayerRuntimeConfig = { assessmentId: "practice-1", coordinator };
```

Without the hook, the strategy stores the session in `localStorage` under
`pie:section-controller:v1:{assessmentId}:{sectionId}:{attemptId}`, and only
when there is an attempt id. The coordinator persists a controller before it
disposes it. A player that builds its own coordinator installs no hooks, so a
host that lets it do so restores through the `session` property and saves from
the controller's events or `getSession()`, or sets a strategy on the handle with
`configureSessionPersistence()`.

The player does not load a section definition by identity: the host loads the
`AssessmentSection` and passes it in.

## Preloaded elements

With `runtime.playerType: "preloaded"` the section player loads no element
code. Its pre-warm asserts that every tag the section's items and passages name
is registered, so the host registers the elements first:

```ts
import { registerPreloadedElements } from "@pie-players/pie-item-player/preloaded";
import * as delivery from "@pie-element/multiple-choice/browser/delivery";
import * as controller from "@pie-element/multiple-choice/browser/controller";
import manifest from "../package.json"; // pins "@pie-element/multiple-choice" exactly

registerPreloadedElements(
  [
    {
      tag: "pie-element-multiple-choice",
      package: "@pie-element/multiple-choice",
      version: manifest.dependencies["@pie-element/multiple-choice"],
      element: delivery,
      controller,
    },
  ],
  { math: { assetRoot: "https://assets.example.com/npm" } },
);

sectionPlayer.runtime = { ...sectionPlayer.runtime, playerType: "preloaded" };
```

Register before the section player mounts: a tag missing at pre-warm leaves
the items unmounted and raises a non-recoverable `element-preload` framework
error. Item players count as hosted under `runtime.player.hosted` or an enabled
`runtime.player.backend.delivery`, and then need no `controller`. Version pins,
element sets, MathJax assets and TypeScript setup are in
[Registering elements from npm](../../docs/item-player/loading-strategies.md#registering-elements-from-npm).

## Styling

### Heading structure

The player publishes one number and every descendant derives its outline from it.
Set `base-heading-level` to the level the cards should occupy in the surrounding
page: 2 when the page has its own `<h1>` above the player, 3 when the player sits
under an `<h2>`, and so on:

```html
<pie-section-player-splitpane base-heading-level="3"></pie-section-player-splitpane>
```

At the default of 2 that produces:

```
h2   Passage                    <- passage card heading
h3     Sea Turtles in Trouble   <- passage title
h4       Danger on Land         <- authored data-heading content
h2   Question 1                 <- item card heading
h3     Part A                   <- authored data-heading content in the prompt
```

The two content kinds derive different levels from the same number. An item
card's heading is the item's heading, so the item player emits no screen-reader
item heading of its own: one at that level already exists, and a second would
read as its sibling. A passage card's heading is a group label, so the passage
player starts one level deeper, putting the passage's own title beneath it.

Authored `data-heading="headingN"` markup in passages and prompts becomes real
heading elements only when a level is published, which the player always does,
so authored heading markup renders as structure without host configuration.

A host that does not supply question headings of its own, and so needs the
element's screen-reader item heading, turns it on through the runtime:

```js
sectionPlayer.runtime = { player: { includeSrHeading: true } };
```

[Composition context](../../docs/architecture/composition-context.md) sets out
the pattern, and why the level is published to descendants.

### Tab styling hooks

`pie-section-player-tabbed` and the splitpane's `tabbed` collapse mode expose
these hooks:

- `pie-section-player-tabs`
- `pie-section-player-tab`
- `pie-section-player-tab--active`
- `pie-section-player-tab-panel`

Tabs also carry `data-pie-purpose="passage-label"` and `data-pie-purpose="item-label"`.

Tab colors, spacing and track geometry are themed through
`--pie-section-player-tab-color`, `--pie-section-player-tab-background`,
`--pie-section-player-tab-active-color`,
`--pie-section-player-tab-active-background`,
`--pie-section-player-tab-gap`,
`--pie-section-player-tab-track-radius`,
`--pie-section-player-tab-track-padding` and
`--pie-section-player-tab-padding-block`.

### Card header styling hooks

Passage and item cards share a header row
(`.pie-section-player-content-card-header`, with the card-specific aliases
`.pie-section-player-passage-header` and `.pie-section-player-item-header`).

- Title and toolbar are centered vertically. A host that needs another
  alignment overrides the selector in its own stylesheet; there is no attribute
  for it.
- Card corners default to `8px`; `--pie-section-player-card-radius` overrides
  them.
- The header fill is transparent by default.
  `--pie-section-player-card-header-background` sets a color; the framework
  ships no brand palette.
- With a header fill, the header's top corners default to just inside the card
  radius; `--pie-section-player-card-header-radius` overrides them.
- Under a dark theme the header takes
  `--pie-section-player-card-header-background-dark`, falling back to
  `--pie-section-player-card-header-background` when it is unset: the hook for
  a brand tint that is legible on a light card and not on a dark one. A dark
  theme is `[data-theme="dark"]` on an ancestor or `pie-theme[theme="dark"]`,
  the selectors the theme package writes its dark tokens under. The `-dark`
  suffix here means under a dark theme; on canonical tokens such as
  `--pie-background-dark` it means a darker shade.
- `pie-section-player-passage-card` bridges `--pie-passage-header-background`
  to `--pie-section-player-card-header-background`, so a passage player custom
  element defined outside this package takes the same header fill without
  either side hardcoding the other's token name.

```css
pie-section-player-passage-card,
pie-section-player-item-card {
  --pie-section-player-card-radius: 8px;
  --pie-section-player-card-header-background: #c9e5e6;
  --pie-section-player-card-header-background-dark: #1f4a4d;
  --pie-section-player-card-header-radius: 7px;
}
```

### Split-pane backdrop

The split-pane layout paints a backdrop behind each scrollable pane, under the
passage and item cards. It reads the canonical `--pie-background-dark`, so it
follows the active theme and color scheme, and it has no pane-specific hook: the
backdrop stays with the theme. The rule covers the items pane as well as the
passage pane, so no passage-header hook drives it. Card fills stay independent
through `--pie-section-player-card-header-background`.

### Content-card tool surfaces

Item and passage cards offer two content-scoped host surfaces:

- `content-lead` is a full-width stack before the authored player content.
- `content-media` is the resizable region beside that content.

Any capability that declares one of those names in `surfaces` may render there,
and this package names no capability. A surface becomes mountable only when
policy grants the capability and its own `requiresAuthoredContent` resolves, so
an item or passage without the authored resource gets no dead affordance.

The packaged audio transcript (`audioTranscriptRegistration` in
`@pie-players/pie-default-tool-loaders`) renders in `content-lead`.
`content-media` holds `@pie-players/pie-tool-sign-language`, a signed (ASL)
translation gated on the `signLanguage` PNP support; it is outside the packaged
set, so a deployment opts in by registering it on the tool registry it passes to
the player.

The `content-media` region sits to the right of the content and is resizable
through a keyboard-accessible divider (`role="separator"`; arrow keys,
`Home`/`End`, `Escape` to cancel a drag). Below a card width of 560px the region
stacks under the content and the divider is withdrawn. Placement is fixed: there
is no orientation toggle and no free repositioning.

This package owns the region's share of the card width and nothing inside it. A
capability mounted here sizes its own content: signing legibility needs height
for hands and face, so the sign-language tool sizes by an aspect-ratio target
with a height floor. The `--pie-section-player-item-media-*` tokens that size it
belong to `@pie-players/pie-tool-sign-language` and are documented with their
defaults in [its README](../tool-sign-language/README.md); they keep the
`pie-section-player` prefix because hosts already set them by those names.

All three section player surfaces (`content-lead`, `content-media` and
`section-overlay`) share one tool surface host. It observes live `ToolRegistry`
mutations and policy and catalog changes, keeps registration order across lazy
loads, synchronizes an existing element when its context changes, and always
calls `destroy()` before removing it. Surface failures are isolated per
capability and emitted as recoverable `framework-error` warnings; they never
block readiness or remove another working capability. A `renderSurface()` result
of `null` means mountable and unoccupied.

## Host-owned focus

The section player does not move focus on behalf of host affordances such as
"Skip to Main", and does not make passage or question containers tab stops.
Hosts own page chrome, skip links, landmarks and special focus placement. A host
shell can focus its own `main#main-content`, and the next Tab follows the
browser's natural order into the first actionable control in the section
player.

The passage and item cards are content surfaces and not focus targets. Splitpane
passage content scrolls through the pane's native scrolling, and the passage
pane itself is not in the sequential keyboard order.

```html
<a href="#main-content" class="skip-link">Skip to Main</a>
<main id="main-content" tabindex="-1">
  <pie-section-player-splitpane></pie-section-player-splitpane>
</main>
```

## Instrumentation

Instrumentation goes through the shared `InstrumentationProvider` contract, set
at `runtime.player.loaderConfig.instrumentationProvider`. The embedded item
players use the same `loaderConfig` for resource monitoring; `loaderOptions`
controls bundle loading. A provider is a JavaScript object, so it is set on the
`runtime` property.

```ts
import { ConsoleInstrumentationProvider } from "@pie-players/pie-players-shared";

const provider = new ConsoleInstrumentationProvider({ useColors: true });
await provider.initialize({ debug: true });

sectionPlayerEl.runtime = {
  playerType: "esm",
  player: {
    loaderConfig: {
      trackPageActions: true,
      instrumentationProvider: provider,
      maxResourceRetries: 3,
      resourceRetryDelay: 500,
    },
    loaderOptions: {
      esmCdnUrl: "https://cdn.jsdelivr.net/npm",
    },
  },
};
```

[Instrumentation providers](../../docs/architecture/instrumentation-providers.md#provider-resolution)
sets out how an unset, `null` or invalid provider resolves. Local debug overlays
compose providers (for example `NewRelicInstrumentationProvider` and
`DebugPanelInstrumentationProvider`) through `CompositeInstrumentationProvider`.

The provider receives the section player's own stream (`pie-section-stage-change`,
`pie-section-loading-complete`, `pie-section-framework-error`,
`pie-section-element-preload-retry`, `pie-section-element-preload-error`), which
`policies.telemetry.enabled: false` stops, and the toolkit's separate
`pie-toolkit-*` stream with its tool and backend
[operational events](../../docs/architecture/instrumentation-providers.md#operational-events).
The two streams do not overlap.

`runtime.onStageChange(detail)` and `runtime.onLoadingComplete(detail)` receive
the `pie-stage-change` and `pie-loading-complete` details.
`runtime.onFrameworkError(model)` fires once per error whatever the wrapper
depth, like the `framework-error` DOM event; consume either. Errors from a
coordinator passed as `runtime.coordinator` arrive the same way.

## Custom layout authoring

A host builds its own section layout from `pie-section-player-kernel-host` and
the two panes. The kernel host runs the section: the toolkit, the section
controller, readiness, the element pre-warm and the section toolbar. Its element
children are the layout, and the panes inside them render the section's items
and passages. [Custom Section Layouts](../../docs/section-player/custom-layouts.md)
covers the kernel host, the panes and the rules a layout follows.

## Content trust boundary

The layouts embed a `<pie-item-player>` for each item. Item and passage markup
is sanitized with DOMPurify by default; the
[item player README](../item-player/README.md#content-trust-boundary) describes
the allow-list, the `trust-markup` opt-out and the `sanitizeMarkup` property.
Every `runtime.player` field the section player does not consume is set on each
embedded item player as a property, so a host forwards those settings there:

```js
const runtime = {
  playerType: "iife",
  player: {
    trustMarkup: false, // the default: DOMPurify stays on
    // sanitizeMarkup: (html) => myCustomSanitize(html),
  },
};
```

Set `trustMarkup: true` only when a trusted pipeline produces the section
payload. The [security overview](../../docs/security/readme.md) covers the wider
trust model.

## Exports

| Specifier | Contents |
| --- | --- |
| `@pie-players/pie-section-player` | Registers every element. Exports `sectionFromItem`, `DEFAULT_SECTION_PLAYER_POLICIES` and the types `SectionPlayerRuntimeConfig`, `SectionPlayerRuntimePlayerConfig`, `SectionPlayerRuntimeHostContract`, `SectionPlayerSnapshot`, `SectionPlayerNavigationSnapshot`, `SectionPlayerPolicies`, `SectionPlayerHostHooks`, the card title context types, `SectionPlayerBackendResolver` and `SectionPlayerBackendResolverContext` |
| `@pie-players/pie-section-player/browser` | The self-contained browser build, which also exports `createPackagedToolRegistry` and `DEFAULT_TOOL_MODULE_LOADERS` ([Loading from a CDN](../../docs/install/cdn.md#section-player-browser-build)) |
| `@pie-players/pie-section-player/components/section-player-splitpane-element` | An alias of the package root |
| `@pie-players/pie-section-player/contracts/runtime-host-contract` | The host method types |
| `@pie-players/pie-section-player/contracts/host-hooks` | `SectionPlayerHostHooks` |
| `@pie-players/pie-section-player/policies` | `DEFAULT_SECTION_PLAYER_POLICIES`, `resolveSectionPlayerPolicies` and the policy types |
| `@pie-players/pie-section-player/item-section` | `sectionFromItem`, Node-safe |

## Development

```bash
bun run --cwd packages/section-player dev
bun run --cwd packages/section-player check
bun run --cwd packages/section-player build
```
