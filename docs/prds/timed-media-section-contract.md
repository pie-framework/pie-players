# Timed Media Section Contract

Status: Implemented, 2026-08-17. Was Ready, 2026-08-15.

Owner: PIE Players maintainers

Tracking: not tracked in an issue tracker by design. This PRD's `Status:` line is the record. Revalidated against `develop` on 2026-08-05 and 2026-08-15; see [Current State](../architecture/timed-media-section.md#current-state) in the architecture note for what moved underneath this draft. Nothing here is blocked on a ticket.

Sequenced behind formative delivery, 2026-08-15. [ADR 0001](../adr/0001-formative-delivery-before-timed-media.md) records the decision and its reason: a cue's interesting gate condition is "answered correctly", which needs a per-item evaluation seam PIE did not have, so building cues first would force `responded` as the only expressible condition and then revise a shipped section slice. The [formative delivery contract](./formative-delivery-contract.md) supplies that seam — Try state, per-item feedback reveal, and the four-valued `FormativeCorrectness` this PRD's cue policy names as gate conditions. That work merged on 2026-08-15 and releases with the next publish, so `FormativeCorrectness` is a real exported type and the per-item `env` seam exists: a cue policy can name `correct` rather than settling for `responded`.

Every prerequisite this PRD inherits is satisfied: the [media asset contract](./shared-contracts/media-asset-contract.md) is `Ready` and its types are shipped, `assessment-toolkit/src/services/catalog-media.ts` owns media validation, and the [theming contract](./pie-727-broad-theming-contract.md) is `Accepted` so media controls have a palette. `Ready` means the contract is settled enough to implement against; the questions left in [Open Questions](#open-questions) are implementation-time choices, not contract gates.

Cue and playback policy ownership does not ride on it, contrary to the earlier reading here. `assessment-toolkit` sits beneath the standalone path as well as beneath assessment-player: formative delivery's Try round trip runs controller → `SectionRuntimeEngine` → `PieAssessmentToolkit` → composition republish, with no assessment-player in it. So `ToolPolicyEngine` can own cue and playback policy whichever player mounts the section, and that choice can be taken on its own merits. The architecture note's layer-ownership table was re-derived against the engine on 2026-08-15.

Related architecture:

- [Timed media section architecture](../architecture/timed-media-section.md)
- [P0 shared contracts](../architecture/shared-contracts-p0.md)
- [Media asset contract](./shared-contracts/media-asset-contract.md) — prerequisite, satisfied 2026-08-09; see below
- [Interaction event contract](./shared-contracts/interaction-event-contract.md)
- [Score components and section outcomes](./shared-contracts/score-components-and-section-outcomes.md)
- [Accessibility runtime patterns](./shared-contracts/accessibility-runtime-patterns.md)
- [Formative delivery contract](./formative-delivery-contract.md) — prerequisite; supplies the state a cue gate condition names
- [Formative delivery before timed media](../adr/0001-formative-delivery-before-timed-media.md) — the sequencing record
- [Sign language (ASL) support](./sign-language-asl-support.md) — sibling media contract, deliberately out of scope here

## Problem

Video-linked assessment is a high-value gap because it combines shared media stimulus, timestamp cues, normal PIE child items, playback policy, completion, and score aggregation. The architecture should be implemented as section-level composition, not as one opaque element or a full assessment-player replacement.

This PRD defines the section contract that timed-media section-player variants, assessment-player renderer selection, `video-stimulus`, and future adapters can align around.

## Goals

- Define timed media as a section flavor with normal child item refs and normal child item sessions.
- Keep `video-stimulus` responsible for media rendering and playback APIs only.
- Define cue metadata, cue policy, playback policy, media/cue session state, and section completion behavior.
- Preserve existing section item-session behavior while adding a named typed `timedMedia` section slice.
- Provide adapter-friendly events and outcome projections by consuming shared contracts.

## Non-Goals

- No item bank, media repository, catalog, workflow, rostering, scheduling, gradebook, backend reporting, or durable attempt store.
- No opaque PCI/custom-item wrapper that hides normal child item/session/outcome structure.
- No cue-to-question orchestration inside `video-stimulus`.
- No generic `profileState` bag for section behavior.
- No composition authoring UI in this PRD; that is a future PRD for cue timelines, item bindings, preview, and policy editing.
- No final QTI profile or conformance claim; QTI mapping belongs in `pie-qti` after this contract is reviewed.
- No sign-language/ASL delivery as a section flavor. Section-player still hosts signing at runtime — through the existing accessibility-catalog rail, since the resolver lives in `assessment-toolkit` and section-player already consumes it — but not through `sectionType` or a specialized layout. Signed alternate representations are item-level, learner-triggered, and gate nothing; see [`./sign-language-asl-support.md`](./sign-language-asl-support.md). The two contracts should share the media asset contract and, if both land, time-ranged playback.

## Prerequisite: Media Asset Contract

Noted 2026-08-07. Sign-language support is starting around the same time as this work, and both consume [`media-asset-contract`](./shared-contracts/media-asset-contract.md). That contract should be reviewed and landed **before** either side writes media-handling code, and designed against both consumers rather than shaped by whichever moves first — otherwise the result is two media vocabularies in one codebase and a merge later.

The specific piece both need is a time range within an asset: Media Fragments for signing, where one recording serves several content nodes, and cue ranges here. Same primitive, two callers, so it gets designed once in the shared contract rather than twice.

Updated 2026-08-08: signing moved first, so the vocabulary now exists in code — `MediaAssetRef`, `MediaSource`, `TextTrackRef`, `TranscriptRef` and `MediaFragmentRange` in `@pie-players/pie-players-shared/types`. That changes this prerequisite rather than removing it. Cue ranges should reuse `MediaFragmentRange` in the same position it holds for signing (beside the asset, not inside it — a range describes a *use* of an asset, not the asset), and anything this contract needs that the shipped types lack should extend them. What must not happen is a second media vocabulary growing beside the first because this side found the first one inconvenient.

**Satisfied 2026-08-09.** `media-asset-contract` is `Ready`, ratified against this workstream's proposed shapes before the release that first publishes the types. Cue ranges fit `MediaFragmentRange` in both forms — a point cue omits `endSeconds`, a ranged cue carries it — and nothing a stimulus needs is missing from `MediaAssetRef`, so `video-stimulus` inherits the vocabulary rather than extending it. The `cues[].startTime` name in the architecture note becomes `startSeconds` to match.

What this leaves for this PRD is narrower than a media contract and must not be skipped as though the ratification covered it: **cue-range semantics**. `MediaFragmentRange` deliberately carries no playback meaning. The two shipped consumers read it as "play only this slice," with the player enforcing both bounds itself — a Media Fragments URI is written but honoured inconsistently at both ends, so the region seeks explicitly once metadata loads and pauses on `timeupdate`. A cue range means "the window during which this cue is active," which is not a slice to play and does not imply seeking. This PRD states that meaning for cues; it does not add a discriminant to the range type or fork it.

Two media-handling facts also arrive as constraints rather than choices. Authored media URLs are validated by `assessment-toolkit/src/services/catalog-media.ts` — scheme allow-list, source normalization, dedupe by `src`, fragment normalization — and `video-stimulus` consumes it rather than writing a second allow-list. And `MediaAssetRef.version: 1` is a required literal, so anything this contract emits carries it.

## Media Representation

Decided 2026-08-15. The stimulus is a passage: a `RubricBlock` with
`class: "stimulus"` whose `passage` config mounts the media element. `timedMedia`
carries no media payload — it carries the cue timeline, the playback policy, and a
required `stimulusRef` naming which renderable is the time source.

Three reasons, in the order they decide it. A passage is a **Catalog Owner**, and a
`timedMedia.media` blob is not: `PassageEntity.accessibilityCatalogs` exists, and
captions, transcripts and signed alternates already resolve through the
accessibility-catalog rail. Video is the worst content type to strip of that owner,
since captions are not optional on it the way they are on a text passage, and the
alternative is a second representation of alternates the catalog rail already
models. The route also already works: `SectionRenderable` is
`{ flavor, entity: ConfigContainerEntity }`, so every renderable is a PIE config
rendered through the item-player, and `SectionContentService` already normalizes
`class: "stimulus"` blocks with a passage into the section's passage map. No new
`class` value, no new shell, no widened field. And `passageVId` gives cross-section
reuse of a stimulus for free, where cues can never be reused with it — they name
this section's `itemRefs` — so the media and the timeline separate cleanly rather
than sharing one placement decision.

`stimulusRef` is required, not a convenience. A section may legitimately hold a
video stimulus and a text stimulus at once — an intro or summary passage beside the
media — because `rubricBlocks` is a list and every `class: "stimulus"` entry becomes
a renderable. An item reaches the video through `cue.itemRefs` and keeps its own
single `ItemEntity.passage` slot for the text, so the two associations never
compete; the cost is that "which renderable is the time source" is ambiguous by
construction. Resolution is validated: `stimulusRef` must name a renderable in this
section, and that renderable must expose a time source. A section carrying cues
without a resolvable `stimulusRef` is malformed and fails loudly, because the
alternative is cues that silently never fire.

The trade, stated as one: this buys a single content-resolution path and keeps media
inside the catalog model, at the cost of "exactly one time source per section" being
a validation rule rather than a type invariant. `timedMedia.media` would have made
it a type invariant and made video the only content in PIE that is not a config
container.

Placement is deferred and is a layout concern, not a data one. `stimulusRef` names
what goes in the media region and every other passage falls through to the normal
passage rail; the splitpane's "passages share a pane" rule is that layout's, not a
universal one. A dedicated timed-media layout owns its own placement.

## Delivery Attachment

Decided 2026-08-15. Timed media targets the existing section-player layouts on the
standalone path: the host mounts the layout tag, as every integration that renders a
section already does. `assessment-player` gains no `sectionType`-driven renderer
dispatch — `sectionType` occurs nowhere in `packages/`, no integration renders a
section through assessment-player, and dispatch would be selection machinery with no
caller.

No new custom element is required and none is added here. A stimulus passage already
renders in every layout: `SectionContentService` normalizes a `class: "stimulus"`
block with a passage into the section's passage list, and `SectionPassagesPane` maps
over it. The splitpane's two-pane frame is already the timed-media geometry — media
in one pane, the cued item in the other — so this contract's delivery surface is
content plus runtime, not a new tag, and it stays off the consumer dependency pad.

Cue-driven progression reuses `navigateToItem` and the composition republish every
layout re-renders against; a gate's visible state reuses the polite status region
the item card gained with formative delivery. Neither is a layout change.

One optional layout input is added, and only for a section carrying a media stimulus
*and* another passage: the passages pane accepts a pinned passage id, fed from
`stimulusRef`, so the media holds position while other passages scroll. Absent, the
pane renders exactly as it does today. That additive default is what keeps current
section-player users unaffected — by construction rather than by care at each call
site — and DOM order inside the pane changes only when the input is set.

A dedicated video-first layout — full-bleed media, controls beneath it, the item
below rather than beside — stays available as later presentation work. It closes no
capability gap, so it follows a working cue engine rather than gating one.

## Package And Export Ownership

- Owning package: `@pie-players/pie-players-shared` (source at `packages/players-shared`) for timed-media section data types, alongside the existing `AssessmentSection` and `RubricBlock` definitions. Runtime behavior is the open part, not the data home.
- Runtime home: `@pie-players/pie-assessment-toolkit` is the leading candidate for cue and playback policy, not merely "slice helpers if needed." Since this PRD was drafted the toolkit has grown `SectionRuntimeEngine`, `SectionEngineCore`, engine state/transition machinery, and a `ToolPolicyEngine` with `PolicySource`, `compose-decision`, and provenance. Composed policy decisions are a closer match for cue/playback policy than layout-custom-element internals. `SectionController` still lives in `section-player`.
- Public export path: open question; candidate shape is shared section type exports plus toolkit runtime/policy contributions.
- Consuming packages or apps: `section-player`, `assessment-player`, `assessment-toolkit`, `apps/section-demos`, `apps/assessment-demos`, `pie-elements-ng` `video-stimulus`, and `pie-qti` adapters.
- Runtime environment: browser and custom element; data types should be Node-safe for adapters.

Implementation must choose one canonical type home for `sectionType`, `timedMedia`, cues, and the timed-media session slice, and must decide the data/runtime split above before the contract hardens.

## Contract Shape

The final names are not ratified by this draft. The section shape should extend existing section data additively.

Documentation sketch only:

```ts
interface TimedMediaCue {
  identifier: string;
  /**
   * The window in which this cue is active, reusing the ratified range type. A
   * point cue omits `endSeconds`. It sits beside the asset rather than inside
   * `MediaAssetRef` because a range describes a *use* of an asset; here that use
   * is activation, not a slice to play, so it implies no seeking.
   */
  range: MediaFragmentRange;
  itemRefs: string[];
  policy: {
    activation: "reveal" | "gate" | "metadata";
    /**
     * For `activation: "gate"`, the condition over formative state that
     * releases playback. Named from the shipped formative vocabulary rather
     * than defined here; `"responded"` is the response-only case the earlier
     * `pause-and-require-response` sketch meant.
     */
    releaseOn?: "responded" | "correct" | "partial-or-better";
    /** What a gate does when the item cannot be auto-scored. */
    onUnknownCorrectness?: "release" | "hold";
  };
}

interface TimedMediaSectionData {
  sectionType: "timed-media";
  timedMedia: {
    /**
     * The renderable that supplies the time source, authored as a
     * `class: "stimulus"` rubric block whose passage config mounts the media
     * element. Required, and validated to resolve within this section — see
     * [Media Representation](#media-representation). No media payload lives
     * here; the passage owns the asset and its accessibility catalogs.
     */
    stimulusRef: string;
    cues: TimedMediaCue[];
    playbackPolicy: {
      allowSeekAhead: boolean;
      pauseOnRequiredCue: boolean;
      requireMediaCompletion: boolean;
    };
    scoringPolicy?: {
      strategy: "sum-child-outcomes" | "average-child-outcomes" | "host-defined";
    };
  };
}

interface TimedMediaSectionSessionSlice {
  version: 1;
  mediaCurrentTime: number;
  mediaCompleted: boolean;
  visitedCueIdentifiers: string[];
  completedCueIdentifiers: string[];
  activeCueIdentifier?: string;
  aggregateComplete?: boolean;
}
```

The existing section snapshot remains the base. The named `timedMedia` slice must define merge and replace behavior explicitly.

## Compatibility

This PRD extends `section-player` behavior additively. It must not change:

- PIE element runtime/controller contracts;
- `pie-item-player` properties, events, or imperative APIs;
- normal child item session propagation;
- existing section-player layouts unless they opt into timed-media behavior;
- assessment-player routing except for additive renderer selection.

"Additive renderer selection" understates the work as of 2026-08-05: assessment-player has no data-driven renderer selection to extend. `AssessmentPlayerDefaultElement` takes a hardcoded `sectionPlayerLayout: "splitpane" | "vertical"` attribute and imports only those two layouts, and nothing dispatches on section data. Either this PRD scopes that dispatch as new machinery, or timed media targets the standalone `section-player` path where the host selects the tag directly.

The timed-media slice must not become a generic profile bag. Unknown hosts must follow the slice behavior ratified by this PRD, not invent alias maps, fallback normalizers, or duplicate dispatch paths.

Element source references and child item markup must preserve versioned PIE tag names and contract attributes unchanged.

## Data Ownership And Host Responsibilities

PIE owns:

- timed-media section data vocabulary;
- cue and playback policy semantics;
- media/cue session slice behavior;
- section-player orchestration of media, cues, child item reveal, and completion;
- adapter-friendly projections derived from shared contracts.

Hosts own:

- media hosting, signed URLs, CDN, CSP, authorization, retention, and privacy;
- durable attempt persistence;
- item lookup/storage;
- product workflow, scheduling, gradebooks, and reporting;
- composition authoring unless a future PIE package explicitly scopes it.

## Serialization And Versioning

The timed-media section data and session slice are persisted or wire-facing data and require:

- `version: 1` on the `timedMedia` session slice;
- validation by the owning package;
- replace semantics for host-provided section data;
- merge semantics for runtime session updates;
- hydrate behavior from persisted section snapshots;
- unknown-version rejection for runtime delivery;
- unknown-host behavior: reject unknown `timedMedia.version` and do not round-trip untyped timed-media state.

Round-trip fixtures must cover media progress, cue visits, cue completion, active cue, aggregate completion, and child item sessions.

## Accessibility

Timed-media delivery must satisfy WCAG 2.2 AA and consume the accessibility runtime patterns PRD:

- all media controls are keyboard accessible and labelled;
- cue activation is announced to assistive technology;
- focus moves predictably when playback pauses and an item appears;
- captions and transcripts remain available during cue-linked questions;
- overlays must not obscure captions, transcripts, controls, or essential media;
- seek locks must not trap keyboard or assistive-technology users;
- TTS/media handoff rules prevent overlapping speech and media audio;
- high-contrast, zoom, touch, and reduced-motion behavior must be verified.

## Standards Or Adapter Impact

This PRD produces adapter-friendly data for QTI/PCI, xAPI, and Caliper. It does not claim standards conformance.

QTI import/export profile work belongs in `pie-qti` after this contract and its shared dependencies are reviewed. Opaque PCI wrapping of the whole timed-media experience is rejected because it hides normal child item/session/outcome structure.

## Test Plan

Required test coverage:

- contract fixtures for timed-media section data;
- session slice merge, replace, hydrate, persist, and round-trip tests;
- cue activation tests for reveal, gate, metadata, and multi-item cues;
- child item session propagation tests proving existing item sessions remain the source for responses;
- completion tests that separate media completion, cue completion, child item completion, and aggregate completion;
- score projection tests using the shared score/outcome contract;
- accessibility tests for keyboard controls, focus handoff, announcements, captions/transcripts, TTS/media handoff, and seek restrictions.

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

- Changeset required: yes, when public exports or player variants are added.
- Migration notes: additive section flavor; existing sections and layouts remain valid.
- Documentation updates: section-player docs, assessment-player renderer selection docs, timed-media demos, `pie-elements-ng` `video-stimulus` PRD, and `pie-qti` adapter PRDs.
- Release risk: high, because media playback, focus, completion, and score aggregation are user-visible and cross-package.

## Implementation Record, 2026-08-17

Built on branch `feat/timed-media-section-contract`. Every choice below was an
implementation-time question this contract left open or did not foresee; each is
recorded with the reason, because the reasons are what a later revision needs.

**Cue and playback policy live in a pure module, not in the policy engine and not
in a layout.** `@pie-players/pie-players-shared/timed-media` owns validation and the
cue reduction; `SectionController` owns the live state and the port;
`resolveTimedMediaProjection` is what layouts read. `ToolPolicyEngine` was the
leading candidate in [Package And Export Ownership](#package-and-export-ownership)
and was not taken: its decision domain is tool eligibility — a placement level and
scope in, `visibleTools` out, several `PolicySource`s merged with provenance —
while a cue decision is a reduction over media time and delivery state with exactly
one authored source, so provenance buys nothing and the capability-neutral core
gains a second unrelated domain. A layout was rejected because every layout hosting
timed media would re-implement the reduction, untestably. Formative delivery had
already answered the same question the same way, which is the precedent that
settles it rather than a fresh argument.

**Cue state joins the composition revision key; media position does not.** The
first half is the failure formative delivery documented and this work hit anyway: a
cue firing changes neither the renderables nor the item sessions, so the emit is
coalesced away and the controller holds cue state no card sees. The second half is
new: `timeupdate` fires about four times a second and nothing renders the clock, so
folding position in would re-diff every mounted item player on a timer. Position is
recorded in the session slice and surfaces only through the cue transitions it
causes.

**A cue-gated card is mounted and hidden, not mounted on the cue.** Mounting on
activation would tear an item player down and rebuild it on every seek backwards,
and it churns shell registration, the section's loading accounting and the preload
warmup signature. The cost is that a pending item player lays out inside
`display: none` until revealed, which is the cheaper failure.

**`onUnknownCorrectness` is required on a correctness gate, not defaulted.** The
contract said it must never default to treating `unknown` as incorrect; the
implementation goes further and refuses to guess in either direction, because both
readings are defensible and each silent choice is wrong somewhere — one traps a
learner behind an item nothing can score, the other waves through the checkpoint the
author wrote.

**A correctness gate over a finite Try budget is a validation error.** Not
foreseen by this contract. A gate on `correct` releases only while the learner still
has a Try to spend, so over an item with `maxTries: 1` — the built-in default — the
gate becomes unpassable the moment the budget runs out, and over an item that does
not deliver formatively there is never a Try at all. Nothing the learner can do
releases playback, and no host action does either, because a forced reveal is not a
correct answer. Releasing on an exhausted budget was considered and rejected: it
delivers the opposite of what the author wrote. So the section is refused with
`gate-requires-unlimited-tries` naming the offending item refs.

**A malformed `timedMedia` reports and delivers as an ordinary section.** The
framework error is non-recoverable, so readiness latches error and the author cannot
miss it, while the learner still gets the content with every item visible. The
alternative — refusing to deliver — makes an authoring slip a total outage.

**A stimulus that exposes no time source takes the same path, reported at
runtime.** [Media Representation](#media-representation) requires the renderable
`stimulusRef` names to expose a time source. Only the first half of that is
statically knowable: a passage is a PIE config and its element bundle decides
whether and when it mounts media, so validation resolves the ref and a clock reports
the rest. The watch is armed when the section's content has loaded and fires five
seconds later if no source has attached, at which point the timeline is dropped, the
section delivers every item, and `stimulus-exposes-no-time-source` names the
renderable. Reported rather than left alone because the failure is not a timeline
that fires late — it is a pane of questions no cue can ever reveal.

**A `metadata` cue's items stay ordinary items.** The cue shape carries `itemRefs`
for every activation, and metadata records state and reveals nothing, so the items
it names are not sequenced: the projection separates `sequencedItemIds` from
`revealedItemIds` and a layout reads the first to decide what is pending. One
predicate for both, because a cue counted as sequencing but never as revealing hides
its items for the whole section.

**Playback is never auto-resumed when a gate releases.** The learner presses play.
Resuming would start audio nobody asked for, on top of the announcement that the
gate released, and it would fight both the reduced-motion posture and a learner
still reading feedback.

**The TTS/media handoff is arbitrated in the toolkit, on a last-action-wins rule.**
Starting read-aloud silences media; starting media pauses read-aloud. Neither side
can decide this alone — the section owns the port and no policy over speech, the TTS
service owns speech and knows nothing of a stimulus — so the toolkit, the only layer
holding both, owns the policy and the two packages expose one half each:
`pauseMediaForCompetingAudio()` on the controller, and a `timed-media-audio-started`
event when media audio resumes. Neither direction resumes what it silenced, for the
reason above. A source reporting no `canPause` cannot yield, and read-aloud proceeds
over it: withholding an accommodation to protect a policy the port already said it
cannot keep is the worse failure, and the gap is already reported at attach.

Media that carries no audio still pauses read-aloud, because no portable signal
distinguishes a silent track from a narrated one — `HTMLMediaElement` exposes none,
so the port cannot either. A deliberate trade: one unnecessary pause the learner
undoes with one press, against overlapping speech, which is the accessibility
failure.

**Seeking is `seekTo(seconds)` on the port rather than a writable `currentTime`.**
A writable property gives a source that cannot seek no way to say so, and
`canRestrictSeeking` needs somewhere to live. This is the one place the port
deliberately departs from the `HTMLMediaElement` shape, along with `capabilities`,
which the element has no equivalent for.

**A host-attached port outranks the stimulus card's native adapter, on attach and
on detach.** Discovered in the browser: the card re-runs its discovery whenever its
content re-renders, so without a precedence rule a host that wired a third-party
player had it silently replaced by the native element mid-session — and the
capabilities flipped back to `canPause: true` with it, which is exactly the
"appears to enforce" failure this contract exists to prevent. The registration event
carries an `origin`, and a `native-adapter` attach or detach is ignored while a
host-owned source is live.

**Enforcement of `allowSeekAhead: false` needs a persisted furthest position.**
`maxPositionSeconds` joins the session slice sketch in [Contract
Shape](#contract-shape). Deriving it would hand the learner the whole timeline back
after a reload. A forward seek is clamped with a 0.5s tolerance, because
`timeupdate` lags real playback by up to a quarter second and clamping at exactly the
recorded value fights a learner nudging the scrubber where they already are.

**Seeking past a gate still trips it.** A cue is reached when playback passes its
start and stays reached, so a learner permitted to seek ahead cannot jump over a
checkpoint. A gate that can be skipped is not a gate.

**The restrictive playback defaults apply when `playbackPolicy` is absent.** A
section that forgot the block reads as one that wanted sequencing, and the permissive
reading would silently deliver an unsequenced video.

**Fail-closed enforcement stays out.** The contract asked whether an author may
require enforcement and fail closed instead of degrading. No: degradation is always
advisory plus a recoverable warning. Failing closed means blocking delivery on a
media capability probe, which contradicts the **Tool Surface Failure** posture in
[`../../CONTEXT.md`](../../CONTEXT.md), and no author has asked for it. Recorded as
a decision rather than an omission.

**No scoring default, and no weighted strategy.** `scoringPolicy` is validated and
persisted; PIE derives no aggregate outcome from it, and a section that omits it is
not silently assigned one. `aggregateComplete` deliberately keeps three facts
separate — required cues, item completion, and media completion where the policy
requires it. `weighted-child-outcomes` was dropped from the strategy union before
release: no weight is authorable on a cue, an item ref or the section, so the entry
named a capability PIE does not have. Where weights live is the score contract's
question, and a host that already holds its own weights says `host-defined`.

**A gate may not name a subset of its cue's items, because two cues already say
it.** Every item a gate names must satisfy `releaseOn`. A split between must-answer
and optional items is authored as two cues at one timestamp — a gate over the first
set, a reveal over the second — which the reduction already delivers: every reached
cue activates in the same pass, the reveal completes immediately, and only the gate
holds. Rejected alternative: reusing `required: false` on the item ref, which today
means "counts toward completion" and would silently change gate behaviour for an
author who set it for a completion reason.

**A printed timed-media section prints every cued item revealed.** Recorded for
whoever builds section printing, which does not exist — `pie-print-player` takes a
single PIE item config and has no section awareness, so nothing in the shipped path
can reach this. A printed page has no timeline, and a page of items no cue can fire
is a blank page: the same reasoning that makes a stimulus with no time source
deliver every item.

**A host-supplied port outranks a renderable's, and a renderable's only counts for
the stimulus.** `attachMediaTimeSource` takes the `renderableId` the source was
found in and ignores a `native-adapter` attach from anything but the resolved
stimulus, because a section may legitimately hold a second video passage and
"exactly one time source per section" is a validation rule rather than a type
invariant. A host names no renderable and is taken at its word.

**The passages pane takes the composition model, not the pinned passage id
[Delivery Attachment](#delivery-attachment) sketched.** Its sibling pane already
takes the whole model, and narrowing this one moves the stimulus-id derivation to
four call sites. The pane renders the stimulus first and does not pin it: sticky
placement needs `scroll-padding-top` on a scroll container the pane does not own, and
without that a focused control in a passage scrolling under it is obscured (WCAG
2.4.11). Ordering delivers the intent; pinning stays with the dedicated layout this
contract already assigns placement to.

Delivered surface, tests and demo: see the changeset
`timed-media-sections-reach-media-through-a-port`, the `timed-media` route in
`apps/section-demos`, and `section-player-timed-media.spec.ts`.

## Open Questions

Six questions closed with the implementation above: type ownership and policy
placement, where an unenforceable policy reports itself and whether an author may
fail closed, whether the slice extends the existing snapshot (it does, as the
formative slice does), and scoring defaults (none).

Still open:

- What is the minimum timed-media MVP for cue timeline authoring, and which package owns that future PRD? Nothing here supplies an authoring surface, and the cue timeline is the part an author cannot reasonably hand-write for long.
- Captions and transcripts are unexercised end to end, and nothing in PIE handles a caption track: there is no `<track>` or `textTracks` handling in any package, so "captions remain available during cue-linked questions" rests entirely on `<track>` surviving inside the stimulus passage's markup, which the demo's `<video>` and `<source>` do but which is untested for `<track>` itself. The fixture is the narrated public-domain source evaluated for the demo (NASA SVS 11054, which ships a real WebVTT file), added as a second demo route rather than replacing the silent clip: a narrated clip *requires* captions under 1.2.2, where the silent one is satisfied by the text alternative the demo already carries, so replacing it would trade a met obligation for an unmet one. Coverage is bounded to two claims — `<track>` survives the passage markup and the browser exposes the captions control, and a gate overlay does not cover the caption region.
- No score-projection coverage. `scoringPolicy` is validated, persisted and carried to the host unchanged for each of its three strategies; PIE derives no aggregate from any of them, so there is no projection to assert. The type home — `ScoreComponent` / `OutcomeProjection` — is an open question in [score components and section outcomes](./shared-contracts/score-components-and-section-outcomes.md), which is still `Draft`, and deriving here would settle that export decision from inside a section feature. The coverage arrives with the first derivation. Weights are that contract's to place, which is why the weighted strategy is not in this one.
