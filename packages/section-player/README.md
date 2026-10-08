# @pie-players/pie-section-player

Section rendering package with layout custom elements:

- `pie-section-player-splitpane`
- `pie-section-player-vertical`
- `pie-section-player-tabbed`

A host that arranges the section itself builds its layout from
`pie-section-player-kernel-host` and the two panes; see
[Custom layout authoring](#custom-layout-authoring).

## Install

```bash
npm install @pie-players/pie-section-player
```

No stylesheet import is needed. Authored content depends on shared classes
(passage markup, the legacy `kds-*` families, answer-eliminator styles) from
`@pie-players/pie-theme/components.css`, and this player renders items through
`@pie-players/pie-item-player`, which installs that stylesheet itself. See
[content styles](../item-player/README.md#content-styles) for the host-ownership
opt-out.

## Runtime boundary and migration

- Browser-only package: `@pie-players/pie-section-player` registers custom elements and
  is intended for browser/DOM hosts, not plain Node runtime imports.
- Node-import-safe packages (for server/runtime utilities) are documented in
  `docs/setup/library-packaging-strategy.md`.
- Migration direction: prefer the stable default entry for side-effect registration:

```ts
import "@pie-players/pie-section-player";
```

The entrypoints under `@pie-players/pie-section-player/components/*` load one
element each, together with every element it renders: a layout entry also
registers the cards, panes and shell. They choose which layouts a host loads; the
tag names stay fixed.

The entries are bundler-only: they import `@pie-players/pie-item-player`,
`@pie-players/pie-default-tool-loaders` and `speech-rule-engine`, with the
engine's JSON locale tables, by bare specifier and without import attributes.
Items render through the host's one `@pie-players/pie-item-player`, which this
package depends on at its own version.

## SectionController

`SectionController` is the domain authority inside a section player. It owns
in-section navigation state, the canonical aggregation of per-item sessions,
and the host-facing persistence snapshot. The layout custom elements
(`pie-section-player-splitpane` / `-vertical` / `-tabbed`) are transport
adapters around it. See
[`docs/section-player/controller-boundaries.md`](../../docs/section-player/controller-boundaries.md)
for the rationale behind that split, and
[`docs/section-player/client-architecture-tutorial.md`](../../docs/section-player/client-architecture-tutorial.md)
for the end-to-end walkthrough.

The handle implements `SectionControllerHandle` from
`@pie-players/pie-assessment-toolkit`; see the JSDoc on that interface for
the per-method contract.

### Obtaining the handle

```ts
const host = document.querySelector("pie-section-player-splitpane") as any;
const controller = await host.waitForSectionController(5000);
```

`waitForSectionController(timeoutMs)` resolves when the layout CE has wired
its controller (the same anchor `pie-stage-change` reaches with
`detail.stage === "engine-ready"`), or with `null` once `timeoutMs` passes.
Use `getSectionController()` if you've already passed the readiness anchor
synchronously.

The layout elements define their host methods from the moment they are
created, so a host can call them before the element mounts. Until it mounts,
`waitForSectionController` waits, `getSectionController()` returns `null`, the
navigation methods return `false`, and `getSnapshot()` and the `select*` reads
return `null` (`pie-section-player-kernel-host` returns its bootstrapping
snapshot).

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
// ...later, on save / unload:
await controller?.persist?.();
unsubscribe?.();
```

`getSession()` / `applySession(session, { mode })` / `updateItemSession(itemId,
detail)` are the direct read/write surfaces and exchange the same
`SectionControllerSessionState` shape the persistence strategy load/save
methods receive. See [Item session management](#item-session-management) for
worked examples.

### Event stream

The controller's typed event stream (`SectionControllerEvent` discriminated
union) is the single source of truth for in-section change. Hosts usually
subscribe through `ToolkitCoordinator.subscribeItemEvents` /
`subscribeSectionLifecycleEvents` (cohort-aware filtering, survives
navigation) — see [JS API example for advanced host
policy](#js-api-example-for-advanced-host-policy). Key event types:

- `item-selected` — item navigation within the current section.
- `item-session-data-changed` / `item-session-meta-changed` — per-item
  session updates the persistence layer should observe. `sectionId` names the
  section. `elementId` names the reporting element when the change carries one,
  and `complete` is then that element's own. A commit carries
  `sessionCommitReason` (see [Commit at a section
  boundary](#commit-at-a-section-boundary)).
- `item-complete-changed` — an item's completion flipped. An item is complete
  when every element that has reported its completion is complete. A report
  without `elementId`, and a restored session's item-level `complete`, set the
  item's completion directly. A session restored through `applySession`
  without `complete` is complete when it holds a response. A passage's own
  `session-changed` stays inside its shell: a passage holds no response.
- `content-loaded` — passage / item / rubric finished loading. Carries
  `contentKind`, `itemId`, and `canonicalItemId`.
- `section-loading-complete` — every renderable in the section finished
  loading.
- `section-items-complete-changed` — aggregate completion flip.
- `section-error` — an item player failed (`source: "item-player"`), or the
  section runtime did (`source: "section-runtime"`), a rejected element warmup
  included, which leaves the items unmounted.
- `section-navigation-change` — the controller's section identity changed.
- `formative-try-recorded` — a learner checked an answer.
- `formative-reveal-changed` — the reveal state changed without a Try: a learner
  dismissed feedback, or a host forced or withdrew a reveal (`source` says which).
- `section-mastery-changed` — the mastery rollup changed. Emitted on change
  only, like `section-items-complete-changed`.
- `timed-media-cue-changed` — a cue activated, a gate released, or aggregate
  completion flipped. Not emitted for media position: `timeupdate` fires about four
  times a second and moves nothing a layout renders.
- `timed-media-audio-started` — media audio is running, so read-aloud must yield.
  Emitted only where playback actually stood; a gate that re-paused on the same
  `play` produced no audio.
- `timed-media-policy-degraded` — the attached media time source cannot carry out a
  playback policy, so it is advisory from here.
- `timed-media-invalid` — authored `timedMedia` that cannot be delivered; the
  section renders without cue behavior.

The helpers' default event sets leave out `formative-try-recorded`,
`formative-reveal-changed`, `section-mastery-changed` and
`timed-media-audio-started`. Name them in `subscribeItemEvents({ eventTypes })`,
or subscribe through `subscribeSectionEvents`.

Item-scoped events carry both id forms, and both are always populated.
`itemId` is the bare `item.id` — the form the map returned by
`getItemSessionsByItemId()` is keyed by, and the form `applySession` expects.
`canonicalItemId` is that item's adapter identifier, and falls back to `itemId`
when the section was not built from an adapter or no adapter ref matches it.
Correlate with formative policy and `runtime.player.resolveBackend` by
`canonicalItemId`; reach the session by `itemId`. `content-loaded` and
`item-player-error` both carry the pair.

### Formative delivery

Set `formative` on the section and the player renders a check-answer control per
item, records Tries, and reveals feedback:

```ts
const section: AssessmentSection = {
  identifier: "practice-set",
  formative: { enabled: true, maxTries: 3, feedback: "correctness" },
  assessmentItemRefs: [
    { identifier: "q1", item },
    // Overrides the section default field by field.
    { identifier: "q2", item, formative: { maxTries: 1, feedback: "solution" } },
    { identifier: "q3", item, formative: { enabled: false } },
  ],
};
```

Absent, or `enabled: false`, and delivery is unchanged: no control, no state, no
`env` override, and `getSession()` does not carry the key.

PIE renders no feedback of its own. A revealed item gets `mode: "evaluate"`
projected over the section env — with `role: "instructor"` under
`feedback: "solution"` — and the element draws the rest. Only that item's env
changes; its neighbours stay editable. A retry withdraws the projection.

Read the resolved state from `getFormativeProjection()`, or from
`composition.formative` in a `composition-changed` event's detail. Drive it from a
host through the same handle:

```ts
const controller = await host.waitForSectionController(5000);
// The learner's actions, budget-respecting.
controller?.recordFormativeTry?.({ itemId, outcomes }); // outcomes from provideScore()
controller?.retryFormativeItem?.({ itemId });
// Host authority: a teacher-driven "show the answer". Spends no Try, ignores the
// Try budget, works on an item with no Try yet.
controller?.revealFormativeItem?.({ itemId, feedback: "solution" });
controller?.hideFormativeItem?.({ itemId });
```

`feedback` is stated rather than taken from the policy, because a reveal under
`feedback: "none"` would project nothing. A learner retry clears it, so a forced
solution does not upgrade every later reveal on that item.

Try state persists inside `SectionControllerSessionState.formative` and hydrates
with the rest of the snapshot. See
[`docs/prds/formative-delivery-contract.md`](../../docs/prds/formative-delivery-contract.md)
for the full contract, its QTI 3 mapping, and the mastery denominator rule.

### Timed media

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
      // or authored `<video>` markup — and it owns the accessibility catalogs that
      // carry captions, transcript and signed alternates.
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

Every item a gate names must satisfy its `releaseOn`. To split must-answer items from
optional ones, author two cues at the same timestamp — a gate over the first set, a
reveal over the second. Both activate in the same pass, the reveal completes at once,
and only the gate holds playback.

Absent `sectionType` and delivery is unchanged: no projection, no session slice, no
cue behavior. An item no `reveal` or `gate` cue names is delivered normally —
including one a `metadata` cue names, since metadata records state and reveals
nothing. A cued item is mounted and hidden until its cue fires, so its session and
shell registration survive a seek backwards.

The section reaches media only through a **Media Time Source**. The stimulus card
finds the media element its passage mounted and registers a native adapter; a host
with its own player registers its own port instead, and that port outranks the
card's discovery for as long as it is attached:

```ts
const controller = await host.waitForSectionController(5000);
// No `renderableId`: a host is asserting its own port, where a renderable's adapter
// has to name itself and is ignored unless it is the resolved stimulus.
controller?.attachMediaTimeSource?.(myThirdPartyPort);
controller?.detachMediaTimeSource?.();
controller?.getTimedMediaProjection?.(); // cues, gate, enforcement, revealed items
// One half of the read-aloud handoff; `false` means the port cannot pause, so the
// overlap stands rather than the accommodation being withheld.
controller?.pauseMediaForCompetingAudio?.();
```

Read-aloud and media audio never run at once, and the action the learner just took
wins: starting read-aloud pauses media, starting media pauses read-aloud. The section
supplies both halves — the method above and `timed-media-audio-started` — and the
toolkit arbitrates between them, because only the toolkit holds the TTS service and
the section. Neither direction resumes what it silenced.

Where the port reports `canPause: false` or `canRestrictSeeking: false`, the
matching policy degrades to **advisory**: cues still fire, state is still recorded,
the projection says `enforcement: "advisory"`, and a recoverable `timed-media`
framework warning names the policy that lost its teeth. Nothing silently pretends to
hold.

Three authoring mistakes fail loudly rather than delivering inert cues: a
`stimulusRef` that resolves to no renderable in the section; a gate on correctness
over an item without unlimited Tries, where a learner who spent a finite budget could
never release playback again; and a `stimulusRef` that resolves to a renderable which
mounts no media, reported once the section's content has loaded and no time source
has attached. Each reports a `timed-media` framework error, after which the section
delivers as an ordinary section with every item visible.

Cue state persists inside `SectionControllerSessionState.timedMedia` and hydrates
with the rest of the snapshot, including the furthest position reached, which is what
`allowSeekAhead: false` clamps against across a reload. See
[`docs/prds/timed-media-section-contract.md`](../../docs/prds/timed-media-section-contract.md)
for the contract and the decision record.

## Usage

Import the custom-element registration entrypoint in consumers:

```ts
import '@pie-players/pie-section-player/components/section-player-splitpane-element';
import '@pie-players/pie-section-player/components/section-player-vertical-element';
import '@pie-players/pie-section-player/components/section-player-tabbed-element';
import '@pie-players/pie-section-player/components/section-player-item-card-element';
import '@pie-players/pie-section-player/components/section-player-passage-card-element';
```

Render in HTML/Svelte/JSX:

```html
<pie-section-player-splitpane></pie-section-player-splitpane>
```

Set complex values (`runtime`, `section`, `session`) as JS properties. `env` is a
`runtime` field (`runtime.env`); the layout elements have no `env` property.

Set `runtime` no later than `section`. When the player builds its own
coordinator, the section's arrival rebuilds that coordinator from the current
`runtime`, so both can be set a tick after the element mounts. Once the section
has initialized, a change to `runtime.tools`, `runtime.assessmentId`,
`runtime.accessibility`, `runtime.lazyInit`, `runtime.toolConfigStrictness` or
`toolRegistry` is reported once in the console and does not reach that
coordinator; `runtime.tools.pnpEnforcement` still applies. Change a running
coordinator through the one `toolkit-ready` carries, with
`updateToolConfig(...)` or `updateToolsPlacement(...)`, or pass your own as
`runtime.coordinator`.

## Runtime Inputs

The layout elements (`pie-section-player-splitpane`,
`pie-section-player-vertical`, `pie-section-player-tabbed`) support:

- `runtime` (object): primary coordinator/tools/player runtime bundle
- `section` (object): assessment section payload
- `session` (object, JS property only): the section's session, a `SectionControllerSessionState`; see [Session lifecycle](#session-lifecycle)
- `debug` (boolean-like): verbose debug logging control (`"true"` enables, `"false"`/`"0"` disables)
- `toolbar-position` (string): `top|right|bottom|left|none`
- `narrow-layout-breakpoint` (number, optional): viewport width in px below which the layout collapses (split pane: single column; vertical: toolbar moves to top). Clamped to 400–2000; default 1100.
- `content-max-width-no-passage` (number, optional): max width in px when no passages exist. Clamped to 320–2200. Unset by default (layout uses available width).
- `content-max-width-with-passage` (number, optional): max width in px when passages are present. Clamped to 320–2200. Unset by default (layout uses available width).
- `split-pane-min-region-width` (number, optional): splitpane minimum pane width in px. Clamped to 160–1200. Unset by default (split bounds stay at 20–80). (Ignored by vertical layout; supported for API parity.)
- `split-pane-collapse-strategy` (string, optional): splitpane stacked-mode strategy. Supported values: `tabbed` (default) and `vertical`. (Ignored by vertical/tabbed layouts; supported for API parity.)
- `base-heading-level` (number, optional): the heading level this player's card headings occupy, and the level every descendant's outline derives from. Clamped to 1–6; default 2. See [Heading structure](#heading-structure).
- `show-toolbar` (boolean-like): accepts `true/false` and common string forms (`"true"`, `"false"`, `"1"`, `"0"`, `"yes"`, `"no"`); default `false`, so tools placed at `section` level render only when it is `true`
- `locale` (string, optional): BCP-47 locale for the player's own interface text. Mirrored onto `runtime.locale`, which wins when both are set. Unset renders `en-US`.
- `runtime.contentLanguage` (string, optional, `runtime` only): BCP-47 language of the content where its markup names none, which read-aloud speaks in and picks catalog cards by. A `lang` between the content and its card wins; unset reads `en-US`. `locale` never sets it.
- `nds-icons` (boolean): opt in to NDS icon buttons. Mirrored onto `runtime.ndsIcons`, which wins when both are set.
- `tool-config-strictness` (string, optional): `off|warn|error` for tool-config validation; default `error`. `runtime.toolConfigStrictness` wins when both are set.
- `split-pane-initial-passage-width` (number, optional): splitpane passage pane width in percent at mount. Clamped to 20–80; default 50.
- `iife-bundle-host` (string, optional): bundle host for the IIFE element pre-warm when `runtime.player.loaderOptions.bundleHost` is unset.
- Host extension props (JS properties only): `toolRegistry`, `sectionHostButtons`, `itemHostButtons`, `passageHostButtons`, `hooks`

When the viewport is no wider than `narrow-layout-breakpoint` (default 1100px),
splitpane and vertical layout hosts normalize section toolbar placement to `top`.
This includes `left`, `right`, `bottom`, and `none` values. Separately, the shell
moves a `left` or `right` toolbar to `top` at a fixed 1100px, so with a smaller
breakpoint side toolbars still move to the top from 1100px down.

`hooks.cardTitleFormatter` remains active across responsive splitpane transitions (split -> stacked and stacked -> split), because title rendering is provided through shared card context rather than layout-specific state.

To opt into PIE-117 dimensions from a host, configure:

```html
<pie-section-player-splitpane
  content-max-width-no-passage="800"
  content-max-width-with-passage="1200"
  split-pane-min-region-width="280"
></pie-section-player-splitpane>
```

Use the same max-width attributes on `pie-section-player-vertical` when you want the same no-passage/with-passage width behavior in vertical mode.

To force splitpane stacked mode to use vertical rendering:

```html
<pie-section-player-splitpane
  narrow-layout-breakpoint="1100"
  split-pane-collapse-strategy="vertical"
></pie-section-player-splitpane>
```

By default, splitpane stacked mode uses tabs. The dedicated `pie-section-player-tabbed` layout also always renders passage/items tabs when passages are present.

### Heading structure

The player publishes one number and every descendant derives its outline from it.
Set `base-heading-level` to the level the cards should occupy in the surrounding
page — 2 when the page has its own `<h1>` above the player, 3 when the player sits
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

The two content kinds derive different levels from the same number, and the
difference is deliberate. An item card's heading *is* the item's heading, so the
item player is told not to emit a screen-reader item heading of its own — one at
that level already exists, and a second would read as its sibling. A passage
card's heading is a group label, so the passage player is told to start one level
deeper, putting the passage's own title beneath it.

Authored `data-heading="headingN"` markup in passages and prompts becomes real
heading elements only when a level is published, which the player now always does.
Content authored against
[PIE-151](https://illuminate.atlassian.net/browse/PIE-151) therefore renders as
structure without any host configuration.

A host that needs the element's own screen-reader item heading — because it is not
supplying question headings of its own — overrides per player through the runtime:

```js
sectionPlayer.runtime = { player: { includeSrHeading: true } };
```

The pattern behind this, and the reason the value is published rather than pushed,
is in
[`docs/architecture/composition-context.md`](../../docs/architecture/composition-context.md).

### Tab styling hooks

`pie-section-player-tabbed` and splitpane `tabbed` collapse mode expose canonical `pie-*`
hooks for theming:

- `pie-section-player-tabs`
- `pie-section-player-tab`
- `pie-section-player-tab--active`
- `pie-section-player-tab-panel`

For theme compatibility with existing passage-label patterns, tabs also expose:

- `data-pie-purpose="passage-label"` and alias class `passage-label`
- `data-pie-purpose="item-label"` and alias class `item-label`

Tab colors, spacing, and track geometry can be themed via CSS variables:
`--pie-section-player-tab-color`, `--pie-section-player-tab-background`,
`--pie-section-player-tab-active-color`,
`--pie-section-player-tab-active-background`,
`--pie-section-player-tab-gap`,
`--pie-section-player-tab-track-radius`,
`--pie-section-player-tab-track-padding`, and
`--pie-section-player-tab-padding-block`.

### Card header styling hooks

Passage and item cards share a common header row
(`.pie-section-player-content-card-header`, with the card-specific aliases
`.pie-section-player-passage-header` / `.pie-section-player-item-header`).

- Title and toolbar are centered vertically by default. There is no prop or
  attribute for this — hosts needing a non-standard alignment should override
  the selector in their own stylesheet.
- Card corners default to `8px`. Hosts/themes can override the card radius via
  `--pie-section-player-card-radius`.
- The header fill is transparent by default. Hosts/themes opt into a color
  via the `--pie-section-player-card-header-background` CSS variable; the
  framework does not ship a brand palette.
- When a header fill is provided, header top corners default just inside the
  card radius. Hosts/themes can override them independently via
  `--pie-section-player-card-header-radius`.
- Under a dark theme the header takes
  `--pie-section-player-card-header-background-dark` instead, falling back to
  `--pie-section-player-card-header-background` when it is unset. That is the
  hook for a host whose brand tint is legible on a light card but not on a dark
  one. "Dark theme" here means the selectors the theme package writes its dark
  tokens under: `[data-theme="dark"]` on an ancestor, or
  `pie-theme[theme="dark"]`. Note the `-dark` suffix means *under a dark theme*
  here, unlike canonical tokens such as `--pie-background-dark`, where it means
  a darker shade.
- `pie-section-player-passage-card` also bridges
  `--pie-passage-header-background` to `--pie-section-player-card-header-background`,
  so a hosted passage-player custom element (defined outside this package)
  picks up the same header fill without either side hardcoding the other's
  token name.

Example (host CSS):

```css
pie-section-player-passage-card,
pie-section-player-item-card {
  --pie-section-player-card-radius: 8px;
  --pie-section-player-card-header-background: #c9e5e6;
  --pie-section-player-card-header-background-dark: #1f4a4d;
  --pie-section-player-card-header-radius: 7px;
}
```

When both max-width attributes are set, the with-passage cap resolves to the greater
of the two configured values (after clamp), so with-passage mode never ends up narrower
than no-passage mode.

### Split-pane backdrop

The split-pane layout paints a backdrop behind each scrollable pane, under the
passage and item cards. It reads the canonical `--pie-background-dark`, so it
follows the active theme and color scheme, and there is no pane-specific hook:
the backdrop is meant to stay with the theme rather than be styled per pane.
The rule covers the items pane as well as the passage pane, so it is not driven
from a passage-header hook. Card fills stay independent via
`--pie-section-player-card-header-background`.

### Content-card tool surfaces

Item and passage cards offer two content-scoped host surfaces:

- `content-lead` is a full-width stack before the authored player content.
- `content-media` is the resizable region beside that content.

They are host surfaces, not features: whatever capability declares one of those
names in `surfaces` may render there, and this package names no capability. A
surface becomes mountable only when policy grants the capability and its own
`requiresAuthoredContent` resolves, so an item or passage without the authored
resource gets no dead affordance.

Today's occupant is `@pie-players/pie-tool-sign-language` — a signed (ASL)
translation gated on the `signLanguage` PNP support. It is not part of the
packaged capability set: a deployment opts in by registering it on the tool
registry it passes to the player.

The `content-media` adapter sits to the right of the content and is resizable via a
keyboard-accessible divider (`role="separator"`; arrow keys, `Home`/`End`,
`Escape` to cancel a drag). Below a card width of 560px the region stacks under
the content and the divider is withdrawn. Placement is fixed in this iteration:
there is no orientation toggle and no free repositioning.

This package owns the region's share of the card width and nothing inside it. A
capability mounted here sizes its own content: signing legibility needs height for
hands and face, so it is sized by an aspect-ratio target with a height floor
rather than by width alone. The `--pie-section-player-item-media-*` tokens hosts
set for that belong to `@pie-players/pie-tool-sign-language` and are documented
with their defaults in [its README](../tool-sign-language/README.md) — they keep
the `pie-section-player` prefix because hosts already set them by those names.

All three section-player surfaces (`content-lead`, `content-media`, and
`section-overlay`) share one internal Tool Surface Host. It observes live
`ToolRegistry` mutations and policy/catalog changes, preserves registration
order across lazy loads, synchronizes an existing element when its current
context changes, and always calls `destroy()` before removing it. Surface
failures are isolated per capability and emitted as recoverable
`framework-error` warnings; they never block readiness or remove another
working capability. A `renderSurface()` result of `null` is a normal
mountable-but-unoccupied result, not an error.

### API direction: CE defaults first, JS customization for advanced cases

The intended usage model is:

- **CE props for default/standard flows (roughly 90% use cases)**:
  - `assessment-id`, `section`, `section-id`, `attempt-id`, `debug`
  - `show-toolbar`, `toolbar-position`, `narrow-layout-breakpoint`
  - `content-max-width-no-passage`, `content-max-width-with-passage`, `split-pane-min-region-width`, `split-pane-collapse-strategy`
- **JS API for advanced customization**:
  - Get the controller handle via `getSectionController()` or `waitForSectionController()` (preferred)
  - Listen for `pie-stage-change` and filter on `detail.stage === "engine-ready"` for an event-driven entry point
  - Apply custom policy/gating in host code (for example, domain-specific `canNext` based on controller events like `section-items-complete-changed`)
  - Compose forward/backward eligibility in host code using `selectNavigation()` + host state; there is intentionally no separate parallel CE gating API for this
  - Inject custom toolbar tooling with `toolRegistry` and optional host button arrays (`sectionHostButtons`, `itemHostButtons`, `passageHostButtons`)
  - Register host callbacks via `hooks` (for example `hooks.cardTitleFormatter`)

Example:

```ts
const host = document.querySelector("pie-section-player-splitpane") as any;
host.hooks = {
  cardTitleFormatter: (context: any) => {
    if (context.kind === "item") {
      return `Question ${context.itemIndex + 1}: ${context.item?.name || context.defaultTitle}`;
    }
    return context.passage?.name || context.defaultTitle;
  },
};
```

Advanced runtime configuration is supplied through the `runtime` object. Set player config, tools, accessibility, coordinator, env, and `createSectionController` on `runtime.<key>`.

### Backend delivery for embedded items

Hosts can configure item-player backend delivery once at the section-player
runtime level. Section-player derives a concrete `backend` prop for each
embedded item player before it renders the item. This is intended for hosts
that need server-processed PIE models and server scoring without querying every
nested `<pie-item-player>`.

```ts
import type {
  SectionPlayerRuntimeConfig,
} from "@pie-players/pie-section-player";

const runtime: SectionPlayerRuntimeConfig = {
  playerType: "iife",
  env: {
    mode: "gather",
    role: "student",
  },
  player: {
    backend: {
      delivery: {
        enabled: true,
        baseUrl: bffUrl,
        assignmentId: playerSessionId,
        endpoints: {
          load: "/api/player/load",
          saveSession: "/api/player/save",
          model: "/api/player/model",
          score: "/api/player/score",
        },
        autosave: { enabled: true, debounceMs: 250 },
      },
    },
  },
};

sectionPlayer.runtime = runtime;
```

When `runtime.player.backend.delivery` is enabled, section-player treats
`itemId` and `sessionId` as per-item delivery identity. It derives them from
`canonicalItemId || item.id` and the item session before forwarding `backend` to
each embedded item player. Static delivery fields such as `baseUrl`, `auth`,
`endpoints`, `assignmentId`, and `autosave` are preserved. Use `assignmentId`
for shared attempt/player identity.

An enabled `backend.delivery` also sets `hosted: true` on each embedded item
player unless `runtime.player.hosted` is set, so the item players load no
element controllers and render the models the server returns.

`runtime.player.resolveBackend` is a section-player-reserved key. It is called
with `{ itemId, canonicalItemId, item, itemIndex, itemSession, sectionId, env,
baseBackend }` and is stripped before props reach `<pie-item-player>`. Use it
only when the backend needs custom per-item identity mapping. The resolver
receives cloned backend objects, so per-item identity changes do not mutate the
shared runtime configuration or leak across items.

Section-player only derives the concrete `backend` prop. It does not call
`loadFromBackend()` on nested item players. Embedded `<pie-item-player>` loads
automatically when its derived `backend.delivery` config has a load signature,
so every mounted item player issues one backend load for its own item. Passage
players do not receive item delivery backend config, but shared non-delivery
backend config is preserved.

This backend delivery config is separate from the element-loader backend used
for IIFE/ESM bundle preloading.

### Preloaded elements

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

- Register before the section player mounts. A tag missing at pre-warm leaves
  the items unmounted and raises a non-recoverable `element-preload` framework
  error.
- Install element packages with `npm install --save-exact`. npm otherwise saves
  a caret range, which registration rejects as a `version`, and which a fresh
  install can resolve to another release line: `^13.4.0-next.15` resolves to
  the legacy `13.4.4`, which has no `./browser/*` modules.
- Install every pie-elements-ng package from one release, in one install from
  the same dist-tag, and upgrade them together. Elements whose `./browser/*`
  builds typeset on `window.MathJax` share the MathJax the first of them loads,
  in the build and configuration of that element's release, so in a mixed set
  an element can typeset with a MathJax it was not built for. Elements that
  bundle their own MathJax share none
  ([One MathJax version per page](../../docs/item-player/loading-strategies.md#one-mathjax-version-per-page)).
- Pass `math.assetRoot`, an npm root serving the fonts and speech the elements'
  bundled MathJax loads, or `math.assetUrls`, each file's URL; without either,
  elements on adapter 0.1.3 or later render without web fonts and speech
  ([MathJax assets](../../docs/item-player/loading-strategies.md#mathjax-assets)).
- Register one version per package. The players align every authored version
  of a package to the registered one, and registering a second version throws.
- Register each package's `controller` unless the item players are hosted
  (`runtime.player.hosted`, or an enabled `runtime.player.backend.delivery`).
  A player that is not hosted runs `model()` in the browser and warns for each
  tag registered without one.
- Only `@pie-element/*` builds from pie-elements-ng publish
  `./browser/delivery` and `./browser/controller`.
- Under TypeScript, the `package.json` import needs `resolveJsonModule`, and a
  package version that ships no declarations for `./browser/*` needs a
  `declare module` shim for those subpaths.

See [`strategy="preloaded"`](../../docs/item-player/loading-strategies.md#strategypreloaded)
for the registration contract.

### Host-owned focus

Section-player does not move focus on behalf of host-level affordances such
as "Skip to Main", nor does it make passage/question containers tab stops.
Hosts own page chrome, skip links, landmarks, and any special focus placement.
For example, a host shell can focus its own
`main#main-content`; the next Tab then follows the browser's natural order
into the first actionable control rendered inside the section player.

The passage and item card custom elements are content/layout surfaces, not
public focus targets. Splitpane passage content remains scrollable through the
pane's native scroll behavior, but the passage pane itself is not inserted into
sequential keyboard navigation.

```html
<a href="#main-content" class="skip-link">Skip to Main</a>
<main id="main-content" tabindex="-1">
  <pie-section-player-splitpane></pie-section-player-splitpane>
</main>
```

**Policy fields.** The layout accepts a partial `policies` object: every
unset field, a missing section included, takes its value from
`DEFAULT_SECTION_PLAYER_POLICIES`.

- `readiness.mode` (`"progressive"` | `"strict"`) — the mode
  `SectionPlayerLayoutKernel` passes to `createReadinessDetail`. Both modes
  hold the `interactive` stage and `pie-loading-complete` until the section's
  element pre-warm resolves and the item cards can mount. The kernel has no
  later loading signal, so the two modes currently emit the same sequence.
  Default: `"progressive"`.
- `preload.enabled` — when `false`, `SectionItemsPane` short-circuits the
  section-level element warmup pipeline (`warmupSectionElements`). Items
  still mount and item-players register their own elements on demand. Use
  this to disable section pre-warm when the host already owns element
  registration end-to-end. Default: `true`.
- `telemetry.enabled` — when `false`, the layout custom elements skip
  `attachInstrumentationEventBridge` setup, so no `pie-section-*`
  telemetry events flow through the bridge. Hosts that want a different
  shape of opt-out can still override `runtime.player.loaderConfig.instrumentationProvider`.
  Default: `true`.

The exported `isPreloadEnabled(policies)` and `isTelemetryEnabled(policies)`
helpers read these toggles with the documented default-true semantics, so
host code that needs to mirror the same gate (e.g. when composing a custom
layout host) can call them directly.

### Navigation signals

- `item-selected`: item-level navigation change within the current section in the `SectionController` broadcast stream (`itemIndex`, `currentItemId`, `totalItems`).
- `section-navigation-change`: section-level navigation/selection change in the `SectionController` broadcast stream (`previousSectionId`, `currentSectionId`, `reason`).

Runtime configuration is explicit:

- `runtime` owns runtime fields (`assessmentId`, `playerType`, `player`, `lazyInit`, `tools`, `accessibility`, `coordinator`, `isolation`, `env`, `createSectionController`).
- Tool placement is configured through `runtime.tools.placement.section`, `runtime.tools.placement.item`, and `runtime.tools.placement.passage`.
- Tool configuration validation is canonical in toolkit initialization (`pie-assessment-toolkit`), including toolbar overlays. Use `runtime.toolConfigStrictness` (`off` | `warn` | `error`) to control warning-only vs fail-fast behavior.
- TTS provider config must use `tools.providers.textToSpeech` (canonical). `tools.providers.tts` is rejected by validation.
- Host tool overrides:
  - `toolRegistry` replaces the default toolbar registry when provided. Build it with `createPackagedToolRegistry({ toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS })` and register custom tools on it, since toolbars load each tool's element through the registry's loaders. A player that builds its own coordinator gives it this registry; a coordinator passed as `runtime.coordinator` keeps its own, which decides policy, so build that coordinator with the same registry
  - host buttons are appended per toolbar scope via `sectionHostButtons`, `itemHostButtons`, `passageHostButtons`

Debug logging is page-wide. A layout's `debug` attribute writes `window.PIE_DEBUG`, the flag every PIE logger on the page reads, so the last host to set it decides for all of them:

- Enable: `<pie-section-player-splitpane debug="true">`
- Disable: `<pie-section-player-splitpane debug="false">` (or `debug="0"`)

Without a `debug` attribute a layout follows `window.PIE_DEBUG`, which a host can set directly.

See the progressive demo routes in `apps/section-demos/src/routes/(demos)` (for example `single-question/+page.svelte` and `session-hydrate-db/+page.svelte`) for end-to-end host integrations.

## Data flow and stability guarantees

Section-player follows a unidirectional flow model:

- Inputs flow downward (`runtime`, `section`, `env`, toolbar options) into base/toolkit/layout/card render paths.
- State updates flow upward as events (`runtime-*`, `session-changed`, controller change events) and are reconciled by runtime owners.
- Layout/card components should not create competing sources of truth for composition/session.

### Stability guarantees

For non-structural updates, section-player guarantees behavior stability:

- Item/passage shell identity remains stable (no remount churn for response-only updates).
- Pane-local scroll position remains stable in splitpane and vertical layouts.

Non-structural updates include:

- response/session updates
- tool toggles/config updates
- runtime config changes that do not alter composition identity

Structural composition changes (new/removed/reordered entities) may legitimately re-render/remount affected nodes.

## Custom layout authoring

A host builds its own section layout from `pie-section-player-kernel-host` and the
two panes. The kernel host runs the section: toolkit, section controller,
readiness, element pre-warm and the section toolbar. Its element children are the
layout, and the panes inside them render the section's items and passages. The
stock layouts are built from the same panes.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; }
      pie-section-player-kernel-host { display: block; height: 100vh; }
      .columns { display: grid; grid-template-columns: 3fr 2fr; height: 100%; }
      .column { min-height: 0; overflow: auto; }
    </style>
    <script type="module">
      import "https://cdn.jsdelivr.net/npm/@pie-players/pie-section-player@x.y.z/dist/browser/pie-section-player.js";

      const player = document.querySelector("pie-section-player-kernel-host");
      player.addEventListener("pie-loading-complete", () => {
        console.log("ready", player.selectNavigation());
      });
      player.runtime = { env: { mode: "gather", role: "student" } };
      player.section = {
        identifier: "water-cycle",
        rubricBlocks: [
          {
            identifier: "passage-1",
            class: "stimulus",
            view: ["candidate"],
            passage: {
              id: "passage-1",
              config: {
                markup: "<p>Water evaporates, condenses into clouds and falls as rain.</p>",
                elements: {},
                models: [],
              },
            },
          },
        ],
        assessmentItemRefs: [
          {
            identifier: "item-1",
            item: {
              id: "item-1",
              config: {
                markup: "<p>Name the stage in which water vapour forms clouds.</p>",
                elements: {},
                models: [],
              },
            },
          },
        ],
      };
    </script>
  </head>
  <body>
    <pie-section-player-kernel-host section-id="water-cycle" attempt-id="attempt-1">
      <div class="columns">
        <div class="column"><pie-section-player-items-pane></pie-section-player-items-pane></div>
        <div class="column"><pie-section-player-passages-pane></pie-section-player-passages-pane></div>
      </div>
    </pie-section-player-kernel-host>
  </body>
</html>
```

The example loads the [browser build](../../docs/setup/cdn_usage.md#section-player-browser-build).
A bundled host imports
`@pie-players/pie-section-player/components/section-player-kernel-host-element`,
which defines the panes too. An item with PIE elements names them in
`config.elements` and carries their `config.models`, as in any section. The
`/custom-layout` route of `apps/section-demos`
([source](../../apps/section-demos/src/routes/%28demos%29/custom-layout/+page.svelte))
builds the same two columns in Svelte.

### Kernel host

- **Inputs and host methods.** Those of the layout elements in
  [Runtime Inputs](#runtime-inputs), without the layout dimensions
  (`narrow-layout-breakpoint`, `content-max-width-*`, `split-pane-*`) and without
  the `locale` and `nds-icons` mirrors, which it takes as `runtime.locale` and
  `runtime.ndsIcons`.
- **DOM.** The open shadow root holds the toolkit and the section toolbar around
  one default slot; `show-toolbar` and `toolbar-position` place the toolbar around
  the layout. The children, the panes and the content they render stay in light
  DOM, where page styles and the content stylesheet reach them. The element has
  no styles of its own, so the host gives it `display` and a height.
- **Stock body.** With no element children it renders its own layout, the
  passages pane above the items pane, and places the passages pane only for a
  section with passages. The stock body leaves when the first element child
  arrives and returns when the last one leaves. Text and comment children do not
  count, so markup whitespace and a framework's placeholder comments leave it in
  place.
- **Navigation and state.** The host methods (`navigateNext`, `navigatePrevious`,
  `navigateTo`, `selectNavigation`, `getSnapshot`, `waitForSectionController`)
  and the events (`pie-stage-change`, `pie-loading-complete`,
  `composition-changed`, `session-changed`, `framework-error`, `toolkit-ready`)
  are those of the stock layouts. `detail.sourceCe` on its `pie-stage-change`
  and `pie-loading-complete` events reads `pie-section-player-kernel-host`.

### Panes

`<pie-section-player-items-pane>` renders the item cards of the current
composition, with their toolbars, and runs the element pre-warm;
`<pie-section-player-passages-pane>` renders the passage cards. A pane takes no
attributes or properties, and its pre-warm failures arrive as the section
player's `framework-error` and `element-preload-error` events. It reads the
section player it belongs to from a context the kernel publishes, so it renders
at any depth below the kernel host, and outside a section player it renders
nothing.

- **One pane of each kind renders**: the first connected. A second pane of a
  kind renders nothing and takes over when the first disconnects; the player
  reports the duplicate once in the console.
- **Readiness follows the rendering items pane.** `interactive` and
  `pie-loading-complete` wait for its element pre-warm, and reports from any
  other pane are ignored. A section with items and no items pane never reaches
  either; the player reports it once in the console a task after
  `section-ready`.
- **The passages pane is optional.** A section without passages needs none, and
  readiness does not wait for it.
- **Scrolling belongs to the layout.** The items pane's scroll hint follows the
  nearest ancestor with `overflow-y: auto` or `scroll`, so the layout gives each
  pane's container that overflow and a bounded height. The stock layouts' pane backdrops and margins
  stay with those layouts; the cards keep their tags and
  [styling hooks](#card-header-styling-hooks).

### JS API example for advanced host policy

```ts
const host = document.querySelector("pie-section-player-splitpane") as any;
const controller = await host.waitForSectionController(5000);
let sectionComplete = false;

const unsubscribe = controller?.subscribe?.((event: any) => {
  if (event?.type === "section-items-complete-changed") {
    sectionComplete = event.complete === true;
  }
});

function canAdvance() {
  const nav = host.selectNavigation?.();
  return Boolean(nav?.canNext && sectionComplete);
}
```

If you already have a `ToolkitCoordinator`, prefer helper subscriptions for host logic. Subscriptions follow the toolkit's active section cohort automatically — a single subscribe call survives navigation:

```ts
const unsubscribeItem = coordinator.subscribeItemEvents({
  listener: (event: any) => {
    // item-scoped stream
  },
});

const unsubscribeSection = coordinator.subscribeSectionLifecycleEvents({
  listener: (event: any) => {
    // section-loading-complete / section-items-complete-changed / section-error / section-navigation-change
  },
});
```

Subscribe **after** the first `getOrCreateSectionController(...)` resolves (or after `toolkit-ready` once the section player has fully wired its controller — typically the safest anchor in host code is `toolkit-ready` followed by the first controller-resolve). Calling subscribe before the first `getOrCreateSectionController(...)` call throws; a listener added while a section is starting binds when that section becomes active.

Use `subscribeSectionEvents(...)` only for advanced mixed filtering requirements.

> **Upgrading from `<0.3.35`?** The `sectionId` / `attemptId` arguments on `subscribeItemEvents` / `subscribeSectionLifecycleEvents` / `subscribeSectionEvents` were dropped — subscriptions now follow the toolkit's active section cohort automatically and migrate across navigation. See the **"Migrating from `<0.3.35`"** section in [`@pie-players/pie-assessment-toolkit`](../assessment-toolkit/README.md#migrating-from-0335-breaking--pre-10) for the full upgrade recipe.

### Item-level observability configuration

Item-level resource observability is configured on the embedded `pie-item-player` via
`loaderConfig`. In section-player integrations, pass this through `runtime.player.loaderConfig`.

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

Important:

- `loaderOptions` controls bundle loading. `loaderConfig` controls runtime resource monitoring.
- Custom providers (functions/instances) must be passed as JS properties (`runtime` object), not serialized string attributes.

### Instrumentation ownership and semantics

Section-player instrumentation is provider-agnostic and uses the shared
`InstrumentationProvider` contract.

- Canonical provider path: `runtime.player.loaderConfig.instrumentationProvider`
- With `trackPageActions: true`, missing/`undefined` providers use the default New Relic provider path.
- `instrumentationProvider: null` explicitly disables instrumentation.
- Invalid provider objects are ignored (optional debug warning), also no-op.
- Existing `item-player` behavior is preserved.
- For local debug overlays, compose providers (for example `NewRelicInstrumentationProvider` + `DebugPanelInstrumentationProvider`) through `CompositeInstrumentationProvider`.
- Toolkit telemetry forwarding uses the same provider path, so tool/backend
  operational events are visible alongside section events when toolkit is mounted.

Canonical lifecycle stream (engine-routed, dispatched on the outer layout CE,
bubbling and composed):

- `pie-stage-change` — single typed transition stream covering
  `composed` → `engine-ready` → `interactive` → `disposed`. Payload is a
  `StageChangeDetail`. A non-recoverable framework error before
  `interactive` emits the current stage `failed` and each stage it never
  reached `skipped`.
- `pie-loading-complete` — fires once per cohort, when the section's element
  pre-warm resolves for the current composition and the item cards can mount
  (kernel-routed).
- `framework-error` — canonical error event for any failure crossing the
  framework boundary. Payload is a `FrameworkErrorModel`. The toolkit
  dispatches it once per error, bubbling and composed, so it reaches the
  layout CE and `document`; errors from a coordinator the host passes as
  `runtime.coordinator` arrive the same way.
  `tests/section-player-event-delivery.spec.ts` pins these counts.

Callback-prop mirrors with two-tier precedence (`runtime.<key>` wins over
the top-level prop):

- `onStageChange(detail)` and `onLoadingComplete(detail)` — on the
  kernel-backed layout CEs (split-pane / vertical / tabbed / kernel-host).
- `onFrameworkError(model)` — on every layout CE and
  `pie-section-player-base`. Fires once per error regardless of wrapper
  depth, like the `framework-error` DOM event; consume either.

Section-player owned instrumentation stream:

- `pie-section-stage-change`
- `pie-section-loading-complete`
- `pie-section-framework-error`
- `pie-section-element-preload-retry`
- `pie-section-element-preload-error`

Build consumers against these canonical lifecycle events:

- `readiness-change` → listen for `pie-stage-change`. The readiness
  payload is also available via `selectReadiness()` /
  `getSnapshot().readiness` on the layout CE.
- `interaction-ready` → `pie-stage-change` filtered on
  `detail.stage === "interactive"`.
- `ready` → `pie-loading-complete`.
- `section-controller-ready` → call
  `waitForSectionController(timeoutMs)` or `getSectionController()`
  on the layout CE, or filter `pie-stage-change` for
  `detail.stage === "engine-ready"`.

If toolkit is mounted, toolkit lifecycle events are emitted on a separate
`pie-toolkit-*` stream. This separation avoids semantic overlap; bridge dedupe
is a defensive safety net only.

Toolkit tool/backend operational stream:

- `pie-tool-init-start|success|error`
- `pie-tool-backend-call-start|success|error`
- `pie-tool-library-load-start|success|error`

### Item session management

Section session data can be managed either through persistence hooks or directly through the controller API.

```ts
const host = document.querySelector("pie-section-player-splitpane") as any;
const controller = await host.waitForSectionController(5000);

// Read current section session snapshot.
const currentSession = controller?.getSession?.();

// Replace section session state (resume from backend snapshot).
await controller?.applySession?.({
  currentItemIndex: 0,
  visitedItemIdentifiers: ["q1"],
  itemSessions: {
    q1: {
      itemIdentifier: "q1",
      pieSessionId: "q1-session",
      session: { id: "q1-session", data: [{ id: "choice", value: "a" }] }
    }
  }
}, { mode: "replace" });

// Update a single item session directly.
await controller?.updateItemSession?.("q1", {
  session: { id: "q1-session", data: [{ id: "choice", value: "b" }] },
  complete: true,
});
```

The same controller snapshot is what the persistence strategy saves/loads, and
what the layout's `session` property takes.
When a controller is reused for the same `sectionId`/`attemptId`, `updateInput()` refreshes composition input while preserving in-memory section session data.

### One item as a section

`sectionFromItem` wraps one item config, in the shape `<pie-item-player config>`
takes, and optionally its session, in the `section` and `session` the layouts
take. It is exported from the package root and from
`@pie-players/pie-section-player/item-section`, which defines no custom element
and imports in Node.

```ts
import { sectionFromItem } from "@pie-players/pie-section-player/item-section";

const { section, session } = sectionFromItem(itemConfig, { session: itemSession });
player.setAttribute("section-id", section.identifier);
player.section = section;
player.session = session;
```

The item ref's `identifier` and the item's `id` are the config's `id`, so every
`itemId` the section reports is the id the host already holds. An advanced
config's `passage` becomes the item's passage, and its `instructorResources` and
`defaultExtraModels` stay on the item's config. The section carries no `baseId`
or `version`; `options.sectionId` names the section, which defaults to the
config's `id`.

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
once.
Host code persists from the controller's events or from its session snapshot.

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

`SectionController` stays DOM-free; the player supplies the commit through
`setPendingSessionCommit()`, declared on `SectionControllerHandle`. The player
registers it both on the controllers it creates and on one the toolkit has
already built, since the first section's controller usually exists before the
player can override the factory. A host-built controller that leaves the method
unimplemented keeps the behaviour it had before the hook existed, and loses a
pending response at those boundaries.

## Content trust boundary

Section-player layouts embed `<pie-item-player>` elements for each item.
Item and passage markup is sanitized by default via DOMPurify; see the
[pie-item-player README](../item-player/README.md#content-trust-boundary)
for the allow-list, the `trust-markup` opt-out and the `sanitizeMarkup`
property. Hosts can forward those settings through the section-player
`runtime.player` overrides — the runtime flattens these onto the embedded
`<pie-item-player>` instance, so any field not recognized by the kernel is
passed straight through as a prop/attribute:

```ts
const runtime = {
  playerType: "iife",
  player: {
    trustMarkup: false, // default, keeps DOMPurify on
    // sanitizeMarkup: (html) => myCustomSanitize(html),
  },
};
```

Set `trustMarkup: true` only when the section payload is guaranteed to be
produced by a trusted pipeline.

## Exports

Published exports are intentionally minimal:

- `@pie-players/pie-section-player`
- `@pie-players/pie-section-player/browser`, the self-contained browser build ([CDN usage](../../docs/setup/cdn_usage.md#section-player-browser-build))
- `@pie-players/pie-section-player/components/section-player-splitpane-element`
- `@pie-players/pie-section-player/components/section-player-vertical-element`
- `@pie-players/pie-section-player/components/section-player-tabbed-element`
- `@pie-players/pie-section-player/components/section-player-kernel-host-element`
- `@pie-players/pie-section-player/components/section-player-shell-element`
- `@pie-players/pie-section-player/components/section-player-item-card-element`
- `@pie-players/pie-section-player/components/section-player-passage-card-element`
- `@pie-players/pie-section-player/components/section-player-items-pane-element`
- `@pie-players/pie-section-player/components/section-player-passages-pane-element`
- `@pie-players/pie-section-player/contracts/layout-contract`
- `@pie-players/pie-section-player/contracts/public-events`
- `@pie-players/pie-section-player/contracts/runtime-host-contract`
- `@pie-players/pie-section-player/contracts/layout-parity-metadata`
- `@pie-players/pie-section-player/contracts/host-hooks`
- `@pie-players/pie-section-player/policies`
- `@pie-players/pie-section-player/item-section`

## Development

```bash
bun run --cwd packages/section-player dev
bun run --cwd packages/section-player check
bun run --cwd packages/section-player build
```
