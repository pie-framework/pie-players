# Timed Media Section Contract

Status: Accepted, 2026-08-17

Implementation status: shipped in pie-players. Types, validation and the cue
reduction live in `@pie-players/pie-players-shared/timed-media`; live state and
the Media Time Source port live in `@pie-players/pie-section-player`. Captions
end to end and score projection remain open; see [Open Questions](#open-questions).

Owner: PIE Players maintainers

This PRD defines the Timed-Media Section: a section whose shared media timeline
decides when its items are delivered, through cues over a media stimulus, a
playback policy, a session slice and gates on formative state. It is for
maintainers of the section player and the shared types, and for adapter authors
mapping the shape to other formats. Terms follow the
[timed media language](../../CONTEXT.md#timed-media-language).

Timed media is sequenced behind formative delivery
([ADR 0001](../adr/0001-formative-delivery-before-timed-media.md)), because a
correctness gate needs the per-item evaluation seam and the `FormativeCorrectness`
values that the [formative delivery contract](./formative-delivery-contract.md)
supplies.

Related architecture:

- [Timed media section architecture](../architecture/timed-media-section.md)
- [P0 shared contracts](../architecture/shared-contracts-p0.md)
- [Media asset contract](./shared-contracts/media-asset-contract.md) — the range type and media validation this contract reuses
- [Interaction event contract](./shared-contracts/interaction-event-contract.md)
- [Score components and section outcomes](./shared-contracts/score-components-and-section-outcomes.md)
- [Accessibility runtime patterns](./shared-contracts/accessibility-runtime-patterns.md)
- [Formative delivery contract](./formative-delivery-contract.md) — supplies the state a gate condition names
- [Formative delivery before timed media](../adr/0001-formative-delivery-before-timed-media.md) — the sequencing record
- [Sign language (ASL) support](./sign-language-asl-support.md) — sibling media contract, out of scope here

Integrator guide: [Timed media](../../packages/section-player/README.md#timed-media)
in the section player README.

## Problem

PIE could not deliver items against a shared media timeline. An assessment that
cues questions from a video combines a media stimulus, cues on its timeline,
ordinary PIE child items, playback policy, completion and score aggregation. It
is built as section-level composition: one opaque element would hide the child
items, sessions and outcomes, and a replacement assessment player would duplicate
delivery the section player already does.

## Goals

- Define timed media as a section flavor with ordinary child item refs and child
  item sessions.
- Keep `video-stimulus` to media rendering. The section reaches the `<video>` it
  mounts through the native Media Time Source adapter; the element exposes no
  playback API.
- Define cue metadata, cue policy, playback policy, the media and cue session
  slice, and section completion.
- Keep existing section item-session behavior while adding a typed `timedMedia`
  section slice.
- Give adapters events and outcome projections built on the shared contracts.

## Non-Goals

- No item bank, media repository, catalog, workflow, rostering, scheduling,
  gradebook, backend reporting or durable attempt store.
- No opaque PCI or custom-item wrapper that hides child item, session and outcome
  structure.
- No cue-to-question orchestration inside `video-stimulus`.
- No generic `profileState` bag for section behavior.
- No composition authoring UI. A separate PRD covers cue timelines, item
  bindings, preview and policy editing; [Composition Authoring](#composition-authoring)
  records the decisions it inherits.
- No QTI profile or conformance claim; QTI mapping belongs in `pie-qti`.
- No sign-language delivery as a section flavor. The section player hosts signing
  through the accessibility-catalog rail, never through `sectionType` or a
  specialized layout, and signed alternates are item-level and gate nothing
  ([sign language support](./sign-language-asl-support.md)). Both contracts
  share `MediaFragmentRange`.

## Media Representation

The stimulus is a passage: a `RubricBlock` with `class: "stimulus"` whose
`passage` config mounts the media element. `timedMedia` carries no media payload.
It carries the cue timeline, the playback policy and a required `stimulusRef`
naming the renderable that supplies the time source.

A passage, for three reasons:

- **Catalog ownership.** A passage is a Catalog Owner
  (`PassageEntity.accessibilityCatalogs`), so transcripts and signed alternates
  resolve through the accessibility-catalog rail. A `timedMedia.media` blob would
  strip video, the content type that most needs alternates, of that owner and
  require a second representation of alternates.
- **One content path.** `SectionRenderable` is
  `{ flavor, entity: ConfigContainerEntity }`, so every renderable is a PIE config
  rendered through the item player, and `SectionContentService` already
  normalizes `class: "stimulus"` blocks with a passage into the section's passage
  map. No new `class` value, shell or field.
- **Reuse.** `passageVId` reuses a stimulus across sections. Cues name this
  section's `itemRefs` and are never reusable, so the media and the timeline
  separate cleanly.

`stimulusRef` is required because a section may hold a video stimulus and a text
stimulus at once, such as an intro or summary passage beside the media, and every
`class: "stimulus"` entry becomes a renderable. An item reaches the video through
`cue.itemRefs` and keeps its own `ItemEntity.passage` slot for text, so the two
associations never compete. Validation resolves the ambiguity: `stimulusRef`
must name a renderable in the section, and that renderable must expose a time
source ([Failure Handling](#failure-handling)).

A deliberate trade: one content-resolution path and media inside the catalog
model, at the cost of "exactly one time source per section" being a validation
rule rather than a type invariant. `timedMedia.media` would have made it a type
invariant and made video the only content in PIE that is not a config container.

Placement is a layout concern. The passages pane renders the stimulus first and
every other passage after it ([Delivery Attachment](#delivery-attachment)); the
splitpane's rule that passages share a pane is that layout's own, and a dedicated
timed-media layout would own its placement.

## Delivery Attachment

Timed media targets the existing section-player layouts on the standalone path:
the host mounts the layout tag, as every integration that renders a section
already does. `sectionType` is a data discriminator that `SectionController`
reads; nothing selects a renderer from it. The assessment player mounts the
splitpane or vertical layout per its `sectionPlayerLayout` attribute and
dispatches on no section data, and `sectionType`-driven dispatch there would be
selection machinery with no caller.

No custom element is added. A stimulus passage renders in every layout:
`SectionContentService` normalizes the block into the section's passage list and
`SectionPassagesPane` renders it. The splitpane's two panes are the timed-media
geometry, media in one and the cued item in the other, so the delivery surface is
content plus runtime: no new tag, and nothing to add to the
[consumer API dependencies](../integrations/consumer-api-dependencies.md) record.

Cue-driven reveals reuse the composition republish every layout renders against.
The items pane carries a polite status line that announces reveals, a held gate
and its release, and a gate that holds playback moves focus to the card it waits
on. A plain reveal leaves focus alone, because moving focus mid-playback is the
change of context WCAG 3.2.1 rules out.

The passages pane takes the composition model and renders the stimulus first
without pinning it. Sticky placement needs `scroll-padding-top` on a scroll
container the pane does not own, and without it a focused control in a passage
scrolling under the media is obscured (WCAG 2.4.11). Pinning stays with a
dedicated layout.

A video-first layout, with full-bleed media, controls beneath and the item below,
is later presentation work. It closes no capability gap.

## Package And Export Ownership

- Owning package: `@pie-players/pie-players-shared` (source at
  `packages/players-shared`), the one type home for `sectionType`, `timedMedia`,
  cues and the session slice, beside `AssessmentSection` and `RubricBlock`.
- Runtime home: `@pie-players/pie-players-shared/timed-media` owns validation
  (`normalizeTimedMediaSectionData`), the cue reduction (`reduceTimedMediaState`)
  and the projection (`resolveTimedMediaProjection`). `SectionController` owns the
  live state and the Media Time Source port, and layouts read the projection from
  `compositionModel.timedMedia`. `@pie-players/pie-assessment-toolkit` arbitrates
  the [read-aloud handoff](#read-aloud-handoff).
- Cue and playback policy stay out of `ToolPolicyEngine`. Its decision domain is
  tool eligibility, a placement level and scope in, `visibleTools` out, several
  `PolicySource`s merged with provenance. A cue decision is a reduction over media
  time and delivery state with one authored source, so provenance buys nothing and
  the capability-neutral core would gain a second unrelated domain. A layout is
  the wrong home too, because every layout hosting timed media would re-implement
  the reduction. Formative delivery splits its policy the same way.
- Public export path: `@pie-players/pie-players-shared/timed-media` for the cue,
  policy and session-slice types, validation, the reduction, the projection and
  the port. `TimedMediaSectionData`, the authored half, is also exported beside
  `AssessmentSection` from the package root and `/types`.
- Consuming packages or apps: `section-player`, `assessment-player`,
  `assessment-toolkit`, `apps/section-demos`, `apps/assessment-demos`,
  pie-elements-ng `video-stimulus`, and pie-qti adapters.
- Runtime environment: browser and custom element; the data types are Node-safe
  for adapters.

## Contract Shape

The section shape extends `AssessmentSection` additively.

```ts
interface TimedMediaCuePolicy {
  activation: "reveal" | "gate" | "metadata";
  /** Required for `activation: "gate"`; ignored otherwise. */
  releaseOn?: "responded" | "correct" | "partial-or-better";
  /** Required when `releaseOn` names correctness; ignored otherwise. */
  onUnknownCorrectness?: "release" | "hold";
}

interface TimedMediaCue {
  identifier: string;
  /** The window in which the cue is active. A point cue omits `endSeconds`. */
  range: MediaFragmentRange;
  /** Identifiers of this section's `assessmentItemRefs`. */
  itemRefs: string[];
  policy: TimedMediaCuePolicy;
}

interface TimedMediaPlaybackPolicy {
  allowSeekAhead: boolean;
  pauseOnRequiredCue: boolean;
  requireMediaCompletion: boolean;
}

interface TimedMediaScoringPolicy {
  strategy: "sum-child-outcomes" | "average-child-outcomes" | "host-defined";
}

interface TimedMediaSectionData {
  /** The rubric block identifier or passage id of the stimulus renderable. */
  stimulusRef: string;
  cues: TimedMediaCue[];
  playbackPolicy: TimedMediaPlaybackPolicy;
  scoringPolicy?: TimedMediaScoringPolicy;
}

/** Additive fields on `AssessmentSection`. */
interface AssessmentSection {
  sectionType?: "timed-media";
  /** Ignored unless `sectionType` is `"timed-media"`. */
  timedMedia?: TimedMediaSectionData;
}

interface TimedMediaSectionSessionSlice {
  version: 1;
  mediaCurrentTime: number;
  /** Furthest position reached, which `allowSeekAhead: false` clamps against. */
  maxPositionSeconds: number;
  mediaCompleted: boolean;
  visitedCueIdentifiers: string[];
  completedCueIdentifiers: string[];
  activeCueIdentifier?: string;
  aggregateComplete?: boolean;
}
```

`MediaFragmentRange` comes from the media asset contract and sits beside the
asset, because a range describes a use of an asset. For a cue that use is
activation: the range is the window in which the cue is active and implies no
seeking. A sign-language card reads the same type as a slice to play, with the
player enforcing both bounds; the type carries no discriminant for the two
readings.

When `playbackPolicy` is absent, validation applies the restrictive defaults:
`allowSeekAhead: false`, `pauseOnRequiredCue: true`,
`requireMediaCompletion: false`. A section that omitted the block reads as one
that wanted sequencing, and the permissive reading would deliver an unsequenced
video. `pauseOnRequiredCue: false` turns every gate into a reveal, and
`requireMediaCompletion` decides whether aggregate completion needs the media to
have ended.

Authored media URLs follow the media asset contract's rules: scheme allow-list,
source normalization, dedupe by `src` and fragment normalization, owned by
`@pie-players/pie-players-shared/media`. `video-stimulus` carries its own copy of
the URL and source rules, because elements take no dependency on a player
package, and holds parity with tests. `MediaAssetRef.version: 1` is a required
literal.

### Media Time Source

The section reaches media only through a Media Time Source, a port shaped after
`HTMLMediaElement`:

```ts
interface MediaTimeSourceCapabilities {
  canPause: boolean;
  canRestrictSeeking: boolean;
}

interface MediaTimeSource {
  readonly currentTime: number;
  /** `NaN` until metadata loads, as on the element. */
  readonly duration: number;
  readonly paused: boolean;
  readonly seekable: MediaTimeRanges | null;
  readonly capabilities: MediaTimeSourceCapabilities;
  play(): Promise<void> | void;
  pause(): void;
  seekTo(seconds: number): void;
  /** Notifications are `time`, `seek`, `play`, `pause` and `ended`, each with `currentTime`. */
  subscribe(listener: (notification: MediaTimeSourceNotification) => void): () => void;
}
```

Seeking is `seekTo(seconds)` rather than a writable `currentTime`, so a source
that cannot seek has a way to say so. That and `capabilities` are the port's only
departures from the element. `createMediaElementTimeSource` adapts a native
element with both capabilities.

The stimulus card finds the media element its passage mounted and attaches the
native adapter with `origin: "native-adapter"` and its `renderableId`; a host
with its own player attaches its port with no renderable. Two precedence rules
apply:

- A host-attached port outranks the card's native adapter on attach and on
  detach. The card re-runs discovery whenever its content re-renders, so without
  the rule a host's third-party player would be replaced mid-session and the
  capabilities would flip back to `canPause: true`.
- A native adapter counts only from the resolved stimulus renderable, since a
  section may hold a second video passage.

Where the attached source reports `canPause: false` or
`canRestrictSeeking: false`, the matching policy is advisory: cues still fire and
state is still recorded, the projection reports `enforcement: "advisory"`, and a
recoverable `timed-media` framework warning names the policy. An author cannot
require enforcement and fail closed, because that would block delivery on a media
capability probe, against the **Tool Surface Failure** rule in
[CONTEXT.md](../../CONTEXT.md).

### Cue Behavior

- A cue is reached when playback passes its start, and stays reached. Visits and
  reveals are monotonic, so seeking back withdraws nothing, and seeking past a
  gate still trips it.
- `reveal` shows its items and completes on activation. `gate` also holds
  playback until every item it names satisfies `releaseOn`, and a released gate
  stays released when a retry lowers correctness. `metadata` records state and
  reveals nothing.
- A `metadata` cue's items are not sequenced. The projection separates
  `sequencedItemIds` (named by a `reveal` or `gate` cue) from `revealedItemIds`,
  and a layout reads the first to decide what is pending, so an item only a
  metadata cue names is delivered normally. Only a metadata cue may name no items.
- `responded` reads item completion, so it works in a section that does not
  deliver formatively. A correctness gate requires the items it names to deliver
  formatively with unlimited Tries, and validation refuses anything else with
  `gate-requires-unlimited-tries` naming the item refs: a gate on `correct`
  releases only while the learner has a Try to spend, and a forced reveal is not a
  correct answer.
- `onUnknownCorrectness` is required on a correctness gate, with no default. Both
  readings are defensible and each silent default is wrong somewhere: one traps a
  learner behind an item nothing can score, the other waves the checkpoint
  through.
- Every item a gate names must satisfy `releaseOn`. A split between must-answer
  and optional items is two cues at one timestamp, a gate over the first set and a
  reveal over the second; both activate in the same pass and only the gate holds.
  Reusing `required: false` on the item ref was rejected, because it means
  "counts toward completion" and would change gate behavior for an author who set
  it for that reason.
- Playback never resumes on its own when a gate releases; the learner presses
  play. Resuming would start audio nobody asked for over the release announcement
  and fight a learner still reading feedback.
- A cued item's card is mounted and hidden until its cue fires. Mounting on
  activation would rebuild the item player on every seek backwards and churn shell
  registration, loading accounting and preload warmup; the cost is a pending item
  laying out while hidden.
- Cue state joins the composition revision key through
  `timedMediaProjectionSignature`, which the controller's change event and the
  toolkit's composition key share. The current position does not join it: it
  moves about four times a second and nothing renders it. The furthest position
  joins in 10-second buckets, so progress persists between cues minutes apart.

### Seeking

`allowSeekAhead: false` clamps a forward seek past `maxPositionSeconds`. The
slice persists that position, because deriving it would hand the learner the
whole timeline back after a reload, and a restored position seeks a freshly
attached source forward. The clamp allows a 0.5-second tolerance
(`SEEK_AHEAD_TOLERANCE_SECONDS`), because `timeupdate` lags playback by up to a
quarter second and a learner nudging the scrubber where they already are should
not be fought.

### Read-Aloud Handoff

Read-aloud and media audio never overlap, and the last action wins: starting
read-aloud pauses media, and starting media pauses read-aloud. The toolkit
arbitrates, as the only layer holding both the TTS service and the section. The
controller supplies `pauseMediaForCompetingAudio()`, which returns `false` when
the port cannot pause, and emits `timed-media-audio-started` when media audio
resumes. Neither direction resumes what it silenced.

A source without `canPause` cannot yield, and read-aloud proceeds over it:
withholding an accommodation to protect a policy the port already reported it
cannot keep is the worse failure. Media with no audio still pauses read-aloud,
because `HTMLMediaElement` exposes no portable signal for a silent track. A
deliberate trade: one unnecessary pause the learner undoes with one press,
against overlapping speech.

### Failure Handling

A `timedMedia` block that fails validation reports a non-recoverable
`timed-media` framework error, so readiness latches error and the author sees it,
and the section then delivers as an ordinary section with every item visible.
Refusing to deliver would turn an authoring slip into an outage. The codes are
`TimedMediaValidationError.code`: `missing-stimulus-ref`,
`unresolved-stimulus-ref`, `no-cues`, `duplicate-cue-identifier`,
`invalid-cue-identifier`, `invalid-cue-range`, `invalid-cue-activation`,
`unknown-item-ref`, `missing-item-refs`, `missing-release-condition`,
`missing-unknown-correctness`, `gate-requires-unlimited-tries`,
`invalid-playback-policy` and `invalid-scoring-policy`.

Whether a stimulus exposes a time source is only half knowable from data: the
passage's element bundle decides whether and when it mounts media. Validation
resolves `stimulusRef`, and a watch armed when the section's content has loaded
reports `stimulus-exposes-no-time-source` if no source has attached five seconds
later. The section then drops the timeline and delivers every item, because the
failure is a pane of questions no cue can reveal.

### Completion And Scoring

`aggregateComplete` keeps three facts separate: every required cue complete,
every item complete, and, where `requireMediaCompletion` holds, the media played
to its end. It is independent of mastery.

`scoringPolicy` is validated, persisted and carried to the host unchanged. PIE
derives no aggregate outcome from it, and a section that omits it gets none.
Validation refuses a weighted strategy, because no weight is authorable on a cue,
an item ref or the section; where weights live belongs to the score components
contract, and a host holding its own weights uses `host-defined`.

### Print

A printed timed-media section prints every cued item revealed: a page has no
timeline, and items no cue can fire leave a blank page. This binds section
printing when it is built; `pie-print-player` takes a single item config and has
no section awareness.

### Composition Authoring

Decisions the composition authoring PRD inherits:

- The authored artifact is `timedMedia`. No QTI representation of cue-gated
  delivery exists, so authoring into QTI would invent those semantics in the
  editor; QTI stays an export concern in `pie-qti`.
- The editor requires the stimulus media resolvable to a playable URL, because
  scrubbing against the real clip is the value. `MediaAssetRef` carries the
  reference, and a playable one is a prerequisite on the host's asset pipeline.
- The surface is built in the authoring application that already owns item and
  passage authoring and already assembles and previews an `AssessmentSection`; a
  new pie-players package would have to grow item and passage authoring from
  nothing. The architecture note's
  [Authoring Model](../architecture/timed-media-section.md#authoring-model)
  enumerates the surface. The PRD lives in this repository, beside this contract,
  and sets the MVP.

## Compatibility

This PRD extends section-player behavior additively. It does not change:

- PIE element runtime and controller contracts;
- `pie-item-player` properties, events or imperative APIs;
- child item session propagation;
- delivery of a section without `sectionType`, which gets no projection, no slice
  and no cue behavior;
- assessment-player routing.

## Data Ownership And Host Responsibilities

PIE owns:

- timed-media section data vocabulary;
- cue and playback policy semantics;
- media and cue session slice behavior;
- section-player orchestration of media, cues, child item reveal and completion;
- adapter-friendly projections derived from shared contracts.

Hosts own:

- media hosting, signed URLs, CDN, CSP, authorization, retention and privacy;
- durable attempt persistence;
- item lookup and storage;
- product workflow, scheduling, gradebooks and reporting;
- composition authoring unless a future PIE package explicitly scopes it.

## Serialization And Versioning

- Authored `timedMedia` carries no version. `normalizeTimedMediaSectionData`
  validates it whenever the section is built.
- The session slice carries `version: 1` and persists in
  `SectionControllerSessionState.timedMedia`, extending the section snapshot as
  the formative slice does. It hydrates with the rest of the snapshot.
- `normalizeTimedMediaSectionSlice` rejects an unknown version whole: delivery
  restarts from clean cue state and item sessions survive. An absent slice reads
  like a snapshot from before timed media.
- On hydrate, cue identifiers the section no longer holds are dropped, a
  completed cue never visited is discarded, `maxPositionSeconds` is never restored
  below `mediaCurrentTime`, and a section without timed media restores nothing.
- A readable incoming slice replaces the live one in both `applySession` modes,
  since cue state is section-scoped and has no per-key entries to merge. A
  `replace` without a readable slice clears cue state; a `merge` without one
  leaves it.
- Hosts never round-trip untyped timed-media state.

## Accessibility

Timed-media delivery must satisfy WCAG 2.2 AA and consume the accessibility
runtime patterns PRD:

- all media controls are keyboard accessible and labeled;
- cue activation is announced to assistive technology;
- focus moves predictably when playback pauses and an item appears;
- captions and transcripts remain available during cue-linked questions;
- overlays must not obscure captions, transcripts, controls or essential media;
- an enforced seek restriction must not trap keyboard or assistive-technology
  users;
- the read-aloud handoff prevents overlapping speech and media audio;
- high-contrast, zoom, touch and reduced-motion behavior must be verified.

## Standards Or Adapter Impact

This PRD produces adapter-friendly data for QTI/PCI, xAPI and Caliper. It does
not claim standards conformance.

QTI import and export profile work belongs in `pie-qti`. Opaque PCI wrapping of
the whole timed-media experience is rejected because it hides child item,
session and outcome structure.

## Test Plan

- `packages/players-shared/tests/timed-media-policy.test.ts`: validation,
  covering the restrictive defaults, `stimulusRef` resolution, cue shape errors,
  `onUnknownCorrectness`, the Try-budget refusal and scoring strategies.
- `packages/players-shared/tests/timed-media-state.test.ts`: the reduction,
  covering activation, gate conditions, a released gate staying released, the
  gate-and-reveal split, seeking past a gate, the seek clamp and its tolerance,
  aggregate completion, capability degradation, metadata cues and the projection
  signature.
- `packages/players-shared/tests/timed-media-session.test.ts`: the slice round
  trip, unknown-version rejection and hydrate filtering.
- `packages/players-shared/tests/timed-media-port.test.ts`: the native adapter.
- `packages/section-player/tests/section-controller-timed-media.test.ts`: the
  controller, covering stimulus resolution, attach and reveal, emitting on cue
  state only, gates, no auto-resume, degradation, the seek clamp through the port,
  completion, the session round trip, the unknown-version restart, a non-stimulus
  adapter ignored, the missing time source, both read-aloud halves and the
  Try-budget refusal.
- `packages/section-player/tests/section-player-timed-media.spec.ts`: in the
  browser, a cue firing at its range, a gate pausing playback, moving focus and
  announcing why, release on a correct answer without resuming, and advisory
  degradation on a source that cannot pause.
- `packages/section-player/tests/section-player-video-stimulus-package.spec.ts`:
  opt-in (`PIE_VIDEO_STIMULUS_PACKAGE_E2E=1`, with a sibling pie-elements-ng
  checkout), the packed `video-stimulus` rendering its source, captions track and
  transcript, and two cues revealing questions under real playback.

Gaps: no test that a host-attached port outranks the native adapter, no
toolkit-level test of the read-aloud arbitration, and no score projection
coverage ([Open Questions](#open-questions)). The remaining accessibility
requirements need manual verification.

Commands:

```sh
bun run typecheck
bun run test
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
```

Playwright-backed tests must run outside the sandbox.

## Rollout And Release Notes

- Changeset: changes to the public timed-media exports or section-player
  behavior carry one.
- Migration notes: none. The section flavor is additive, and existing sections
  and layouts remain valid.
- Documentation: the section player README's
  [Timed media](../../packages/section-player/README.md#timed-media) section, the
  `timed-media` route in `apps/section-demos`, and the `video-stimulus` and
  pie-qti adapter documentation in their own repositories.
- Release risk: high, because media playback, focus, completion and score
  aggregation are user-visible and cross-package.

## Open Questions

- **Captions end to end.** pie-players handles no caption track itself; captions
  ride on the stimulus element. The packaged `video-stimulus` renders
  `MediaAssetRef.tracks` as `<track>`, and the opt-in package spec asserts it.
  Unasserted: that the browser exposes the captions control, that gate state
  never covers the captions, and `<track>` inside authored passage markup, which
  is the host-supplied video path. A narrated clip requires captions under WCAG
  1.2.2, and the narrated public-domain NASA SVS 11054 excerpt, which ships a
  WebVTT file, is the candidate fixture for that path.
- **Score projection.** `scoringPolicy` reaches the host unchanged and PIE derives
  no aggregate, so there is no projection to assert. The type home
  (`ScoreComponent` / `OutcomeProjection`) is open in the Draft
  [score components and section outcomes](./shared-contracts/score-components-and-section-outcomes.md)
  contract, and deriving here would settle that export decision from inside a
  section feature. Coverage arrives with the first derivation.
