# Timed Media Section Architecture

Status: Implemented, 2026-08-17

This note is the design record for the timed-media section: one media stimulus
paired with normal PIE items, where cues on the media timeline reveal and gate
those items. It is for contributors changing the section player, the assessment
toolkit or the timed-media rules in `@pie-players/pie-players-shared`. The
[timed-media section contract](../prds/timed-media-section-contract.md) owns the
ratified model, session and event surfaces; where this note and the PRD differ, the
PRD governs. Hosts and authors start from [Timed media](../../packages/section-player/README.md#timed-media)
in the section player README and [Timed Media](../../packages/players-shared/README.md#timed-media)
in the players-shared README.

## Context

PIE has primitives for individual interactive questions, shared passages, section
composition and assessment-level routing. A video-linked assessment pairs one media
stimulus with several normal PIE items. Cues on the media timeline decide when those
items appear, pause playback and gate progression, and the section rolls the result
up into one completion.

The section was designed as a boundary test for how PIE grows, before any deployment
required it. Its likely uses are higher education, online courses, vocational
training, HR and compliance training, and other scored learning interactions.

## Goals

- Express video-linked assessment as section-level composition.
- Keep child questions as normal PIE items and elements, with normal item sessions
  and outcomes.
- Render media, captions and transcript in a reusable element,
  `@pie-element/video-stimulus` in pie-elements-ng.
- Carry the timed-media section contract and its runtime in pie-players, in the
  existing section-player layouts.

## Non-Goals

- No item bank, media asset repository, catalog management, rostering, scheduling,
  workflow, gradebook or backend reporting. Those stay host-system responsibilities.
- No replacement for the assessment player. Where a host uses it, it keeps
  active-section selection and assessment-level navigation and session state.
- No timed-media container inside a leaf PIE element.
- No opaque PCI or custom-item wrapper that hides child questions from the normal
  PIE item, session and outcome contracts.
- No sign-language delivery as a section type. Section-player renders signing through
  the accessibility-catalog rail, item-level and cue-free; see
  [Relationship to Sign Language](#relationship-to-sign-language).

## Glossary

[`CONTEXT.md`](../../CONTEXT.md#timed-media-language) defines the runtime terms:
Timed-Media Section, Media Stimulus, Media Time Source, Media Capability, Cue, Cue
Activation, Gate Condition, Enforced and Advisory Policy, and Aggregate Completion.
The table adds the terms this note uses beyond them.

| Term | Meaning in this note | Relationship to current PIE language |
| --- | --- | --- |
| Stimulus | Shared non-response content that frames one or more items. | Broader architecture term, common in QTI contexts. |
| Passage | The PIE player term for shared reading or visual context rendered alongside items. | pie-elements-ng's [`CONTEXT.md`](https://github.com/pie-framework/pie-elements-ng/blob/develop/CONTEXT.md) treats Passage as canonical and keeps Stimulus for QTI contexts. |
| Video stimulus | The shared media element `@pie-element/video-stimulus`. It renders media, captions and transcript, and mounts the `<video>` the section adapts as its Media Time Source. | A sibling of `@pie-element/passage` in concept only; it holds no cue-to-question orchestration. |
| Section | A QTI-like grouping of item refs, shared content, tools and section session state. | `AssessmentSection` in `@pie-players/pie-players-shared`. |
| Timed-media section | A section whose shared media timeline decides when its items are delivered, named by `sectionType: "timed-media"`. | A section type on data. It adds no assessment layer and no layout. |
| Cue | A window on the media timeline, spelled as a `MediaFragmentRange`, that activates one or more of the section's item refs under a policy. A point cue omits `endSeconds`. | Timed-media section concept. |
| Child item | A normal `assessmentItemRef` rendered by item-player and backed by normal PIE elements. | Existing section-player item composition. |
| Composition authoring | Authoring of section-level composition: stimulus, item refs, cue bindings, layout, playback policy, scoring policy. | Authoring category between element authoring and assessment authoring. |
| Assessment authoring | Assembly of sections into a test, activity or larger assessment definition. | Assessment-player and host-level concern. |

Passage and stimulus coexist on purpose. In data and at runtime a media stimulus is
a passage: `CONTEXT.md` defines it as the passage whose PIE config mounts the media
element. Element docs keep Passage for the passage+item pattern, and this note says
stimulus where a point covers video, audio and future simulations, which are not
naturally passages.

Learnosity's `stimulus` is PIE's **prompt**: per-item question language, not shared
content framing several items. An import mapping treats a Learnosity `stimulus`
field as a prompt, never as a passage or a media stimulus.

## Layer Ownership

A section reaches the screen on one of two entry paths: the host mounts a layout
tag itself, or the assessment player mounts `pie-section-player-splitpane` or
`pie-section-player-vertical`, as the host sets `sectionPlayerLayout`. The
assessment player does not dispatch on `sectionType`. The toolkit is beneath
both.

![Timed-media layers as implemented: the host mounts a section layout itself or through the assessment player, which mounts split pane or vertical; the layout registers with the assessment toolkit along with its Media Time Source; the toolkit routes section input and recorded actions to the section controller, which calls the pure timed-media rules and drives the video stimulus's video element through the port; the toolkit republishes the composition and timed-media projection to the layout, whose item players render the items and the stimulus passage](../img/design-timed-media-layers.excalidraw.svg)

| Layer | Owns | Does not own |
| --- | --- | --- |
| Host application | Media hosting/CDN, CSP, item lookup/storage, durable attempt persistence, authorization, telemetry sinks, product workflow, backend policy. | Internal section runtime mechanics or child element behavior. |
| `assessment-player` | Active section selection, assessment-level navigation, assessment session abstraction over section sessions. Optional: a host supplying its own assessment shell reaches the section directly. | Timed cue orchestration or media playback internals. |
| Section player layouts | Media layout, item reveal/selection, section-level completion view, bridge between media state and child item sessions. Shipped as the existing layouts reading `compositionModel.timedMedia`, which `SectionController` computes with `resolveTimedMediaProjection`; cue activation and pause/resume policy live in the `timed-media` module and `SectionController`. | Child element internals, backend storage, assessment-level routing. |
| `assessment-toolkit` engine layer | Runtime registration through `SectionControllerBinding`, stage derivation through `SectionRuntimeEngine`/`SectionEngineCore`, composed policy decisions with provenance through `ToolPolicyEngine`, tool/TTS/accessibility service coordination, composition republish to the layout, routing `pie-media-time-source` registrations to the controller, and folding the timed-media signature into the composition revision key. Reached on both entry paths, so tool policy placed here needs no assessment-player. | Media playback internals, per-item controller instantiation, durable storage, product policy. |
| `SectionController`, in `section-player` | Aggregate section state, the item-session map, per-item completion and formative Try/mastery rollups, timed-media live state and the Media Time Source port, the persistence snapshot shape. | Media playback internals, assessment-level routing, durable storage. |
| `video-stimulus` | Media rendering: sources, captions, transcript, and the `<video>` element the stimulus card adapts as the section's Media Time Source. | Cue-to-item bindings, scoring, child item sessions. |
| `item-player` | Rendering normal item content and propagating item sessions/outcomes. | Media timeline policy or section-level aggregation policy. |
| Child PIE elements | Their own model/session/environment, authoring surface, session-changed events, controller outcomes. | Section composition, media state, persistence. |

## Section Type and Layouts

Timed media is a section type on data and renders in the existing section-player
layouts, with no layout custom element of its own. `sectionType: "timed-media"` on
`AssessmentSection` pairs with a `timedMedia` block, and only `SectionController`
reads it. The assessment player does not dispatch on it, and the toolkit names it
only in a diagnostic.

The delivery path forced this. Integrations that render a section pick the layout
tag themselves, and none renders one through the assessment player, which has no
data-driven renderer selection: `AssessmentPlayerDefaultElement` takes
`sectionPlayerLayout: "splitpane" | "vertical"` and imports only those two layouts,
so the tabbed and kernel-host layouts are unreachable through it. The PRD's
[Delivery Attachment](../prds/timed-media-section-contract.md#delivery-attachment)
records the decision. Dispatch on `sectionType` in the assessment player stays
possible and is not built.

The layout family is unchanged:

- `pie-section-player-splitpane`
- `pie-section-player-vertical`
- `pie-section-player-tabbed`
- `pie-section-player-kernel-host`

Layouts are transport and layout adapters, and `SectionController` owns aggregate
section state; timed media keeps that split. A layout reads
`compositionModel.timedMedia`, which `SectionController` computes with
`resolveTimedMediaProjection`, and renders it. Cue and playback policy live in the
pure `timed-media` module of `@pie-players/pie-players-shared`, with live state in
`SectionController`. `ToolPolicyEngine` in the toolkit was the other candidate home;
its decision domain is tool eligibility, so cue policy stays out of it. The toolkit's
timed-media roles are the event route for Media Time Source registrations and the
composition revision key, as they are for formative delivery.

Cue gating does not reuse the canonical `Stage` vocabulary. `players-shared/src/pie/stages.ts`
is a lifecycle list (`composed`, `engine-ready`, `interactive`, `disposed`),
deliberately narrowed after earlier readiness-event drift was removed, and
progression and cue gating stay out of it.

## Normal Passage Section vs Timed-Media Section

| Concern | Passage+items section | Timed-media section |
| --- | --- | --- |
| Shared content | Passage rendered beside or above items. | Media stimulus: a passage whose config mounts the media element. |
| Child questions | Normal `assessmentItemRefs`. | Normal `assessmentItemRefs`. |
| Visibility | Items are visible or navigable according to the layout. | An item a `reveal` or `gate` cue names stays mounted and hidden until its cue activates; other items deliver normally. |
| Progression | Section navigation or page-mode behavior. | Media playback plus gate conditions. |
| Session storage | Item sessions in the section item-session map, plus navigation state. | The same item-session map, plus a `timedMedia` slice for media progress and cue state. |
| Tools and accommodations | Section and player tool placement, passage and item TTS, highlights. | The same services, plus media-control accessibility, captions, transcript, cue announcements, focus on a held gate, and the read-aloud handoff. |

The media stimulus is passage-like because it is shared context. The timed-media
section adds the timeline orchestration a plain passage renderer does not own.

## Decisions, 2026-08-15

Three decisions taken in design review constrain the contract.

**1. Formative delivery ships first.** [ADR 0001](../adr/0001-formative-delivery-before-timed-media.md)
records it and the [formative delivery contract](../prds/formative-delivery-contract.md)
specifies it. A cue's useful gate condition is "answered correctly", and correctness
at the section layer needs a per-item evaluation seam PIE did not have. Building cues
first would have forced `responded` as the only expressible condition, then a
revision of a shipped section slice once correctness arrived.

A gate therefore names a gate condition over delivery state and defines none of its
own: `responded`, `correct` or `partial-or-better` (`TimedMediaGateCondition`). The
correctness conditions read the formative `FormativeCorrectness` values `correct`,
`partial`, `incorrect` and `unknown`; `responded` reads item completion. `unknown` is
the state of an item no loaded controller can score, so a correctness gate states
what it does with it, through a required `onUnknownCorrectness: "release" | "hold"`,
and never treats it as wrong. A correctness gate also requires the items it names to
deliver formatively with unlimited Tries (validation error
`gate-requires-unlimited-tries`), since anything else is a checkpoint a learner could
become unable to pass.

**2. Media is reached through a Media Time Source port.** The section orchestrates
against an `HTMLMediaElement`-shaped interface and never against a player library
API. The browser's own shape is chosen because a native `<video>` satisfies it with a
small adapter, which makes the port testable and keeps the
[Video Player Dependency Decision](#video-player-dependency-decision) reversible. A
host can supply its own port and deliver timed media without shipping a PIE element.
[Media Time Source](#media-time-source) gives the shape.

The port declares its own limits, because not every media source can be controlled:
`canPause` and `canRestrictSeeking` are capabilities of the adapter, never
assumptions of the section.

**3. Playback policy is enforced or advisory, and degrades on capability.** A seek
restriction or a pause-on-cue is enforced only when the port reports the capability.
Where it does not, as with a third-party embed that exposes time but not control, the
policy is advisory: cues still fire, state is still recorded, and the gap is reported
as a recoverable framework warning. Silent degradation is the failure this rules out,
because a seek lock that does not lock reads to an author as one that does.

This is the fail-soft posture of **Tool Surface Failure** in
[`../../CONTEXT.md`](../../CONTEXT.md): a capability gap isolates to the affected
policy and never blocks delivery. An author cannot require enforcement and fail
closed; the PRD's [Media Time Source](../prds/timed-media-section-contract.md#media-time-source)
gives the reason and names the warning.

## Section Data

The shape below follows the shipped `AssessmentSection` and `TimedMediaSectionData`
types. The section player README's [Timed media](../../packages/section-player/README.md#timed-media)
section carries the host-facing example.

```ts
const section = {
  identifier: "video-section-1",
  title: "Lab safety video check",
  sectionType: "timed-media",
  keepTogether: true,
  // A correctness gate needs unlimited Tries.
  formative: { enabled: true, maxTries: "unlimited", feedback: "correctness" },
  rubricBlocks: [
    {
      identifier: "video-stimulus-1",
      class: "stimulus",
      view: ["candidate"],
      // The stimulus is a passage, so the media model rides in a PIE config like
      // any other element model. `passageVId` references a shared passage instead
      // when the same video serves several sections.
      passage: {
        id: "passage-lab-safety-video",
        name: "Lab safety video",
        config: {
          markup: '<video-stimulus id="lab-safety"></video-stimulus>',
          elements: { "video-stimulus": "@pie-element/video-stimulus@x.y.z" },
          models: [
            {
              id: "lab-safety",
              element: "video-stimulus",
              media: {
                version: 1,
                kind: "video",
                sources: [{ src: "https://cdn.example/lab-safety.mp4", type: "video/mp4" }],
                poster: "https://cdn.example/lab-safety.jpg",
              },
            },
          ],
        },
        // Captions, transcript and signed alternates resolve through the
        // accessibility-catalog rail this passage owns as a Catalog Owner.
        accessibilityCatalogs: [/* caption, transcript and signing cards */],
      },
    },
  ],
  assessmentItemRefs: [
    { identifier: "q-eye-protection", itemVId: "item-eye-protection" },
    { identifier: "q-spill-response", itemVId: "item-spill-response" },
  ],
  timedMedia: {
    // No media payload here. `stimulusRef` names the renderable above that
    // supplies the time source, and resolution is validated.
    stimulusRef: "video-stimulus-1",
    cues: [
      {
        identifier: "cue-eye-protection",
        range: { startSeconds: 42.5 },
        itemRefs: ["q-eye-protection"],
        policy: { activation: "gate", releaseOn: "correct", onUnknownCorrectness: "release" },
      },
      {
        identifier: "cue-spill-response",
        range: { startSeconds: 118 },
        itemRefs: ["q-spill-response"],
        policy: { activation: "reveal" },
      },
    ],
    playbackPolicy: {
      allowSeekAhead: false,
      pauseOnRequiredCue: true,
      requireMediaCompletion: true,
    },
    scoringPolicy: {
      strategy: "sum-child-outcomes",
    },
  },
};
```

### Video Stimulus Mapping

The stimulus is a passage (option 1 below). The PRD's
[Media Representation](../prds/timed-media-section-contract.md#media-representation)
owns the record, and `timedMedia` carries a required `stimulusRef` in place of a
media payload. Three options were weighed:

1. **Reference the stimulus through `rubricBlocks` with `class: "stimulus"`.
   Chosen.** Every `RubricBlock` payload field is passage-typed or raw HTML, which
   first read as requiring passage fields widened to carry media. A passage payload
   is a PIE config, so nothing widens: `SectionRenderable` is
   `{ flavor, entity: ConfigContainerEntity }`, every renderable renders through the
   item-player, and a passage config mounting `video-stimulus` carries the media
   model the way any config carries an element model. `SectionContentService`
   normalizes a `class: "stimulus"` block with a passage like any other passage and
   maps its identifier to the normalized renderable for `stimulusRef`, so no new
   shell appears. The deciding reason is narrower than reuse: a passage is a
   **Catalog Owner**, so captions, transcript and signed alternates resolve through
   the rail that already serves them.
2. **Add a renderable flavor for media.** `SectionRenderable.flavor`
   (`"item" | "passage" | "rubric"`) is internal to section-player, and the authored
   side is `RubricBlock.class` plus separate item and passage shell elements. A
   media flavor therefore means a new `class` value, a new flavor and a new shell,
   none of which option 1 needs.
3. **Keep media metadata in `timedMedia.media` as a section-local media resource.
   Rejected.** It is the cheapest field placement, and it makes "which content is the
   video" a type invariant rather than a validation rule, a genuine advantage where a
   section holds both a video and a text stimulus. It loses on ownership: a media
   blob has no catalog owner, so captions and transcript become a second
   representation of alternates the accessibility-catalog rail already models, and
   video is the content type least able to afford that. It would also make media the
   only PIE content that is not a config container, so tools, TTS, theming and
   preloading would each gain a special case.

The invariant either way: the video stimulus renders media and mounts the `<video>`
the section adapts, and it does not know which question appears at which cue or own
child sessions.

Options 1 and 3 differ on more than field placement: option 1 makes media a
first-class shared-content entity a host can reference from several sections, and
option 3 makes it section-local. Catalog ownership decided it, and reuse came with
it, since `passageVId` already references a shared passage. The cue timeline stays
section-local either way, because cues name this section's `itemRefs`.

## Cue Semantics

A cue is a window on the media timeline, a `MediaFragmentRange` (`startSeconds` and
an optional `endSeconds`), that activates one or more of the section's item refs
under a policy. A point cue omits `endSeconds`. A cue that names several items
activates them together. The activations (`TimedMediaCueActivation`):

- `reveal`: the cue's items are shown when playback reaches the cue.
- `gate`: the items are shown, playback holds until the cue's gate condition holds,
  and focus moves to the gated item.
- `metadata`: the cue records state for analytics or author-visible timeline markers
  and shows nothing; its items stay ordinary items.

Cue policy is section behavior. It is not encoded in child item models or as private
behavior of the video stimulus.

A gate releases on a gate condition over delivery state, as set out in
[Decisions, 2026-08-15](#decisions-2026-08-15). The draft's
`pause-and-require-response` pattern is the `responded` condition under an older
name. A released gate stays released, and a release never resumes playback: the
learner presses play. Cue visits and reveals are monotonic, so seeking backwards
withdraws no question the learner has seen, and seeking past a gate still trips it.

`playbackPolicy` holds three switches. `allowSeekAhead: false` clamps a forward seek
to the furthest position reached; `pauseOnRequiredCue: false` turns every gate into a
reveal; `requireMediaCompletion` decides whether aggregate completion needs the media
to have ended. A section without the block gets the restrictive defaults
(`allowSeekAhead: false`, `pauseOnRequiredCue: true`,
`requireMediaCompletion: false`).

Enforcement is conditional on the adapter. A gate holds only where the Media Time
Source reports `canPause`; where it does not, the cue still fires and records state,
and the gate degrades to advisory with a framework warning.

## Media Time Source

`MediaTimeSource`, exported from `@pie-players/pie-players-shared/timed-media`, is
the only route from the section to media. It replaces the element-shaped
`VideoStimulusHandle` the draft sketched. The draft's element events
(`media-ready`, `media-time-changed` and the rest) and its section-to-element policy
hooks are not built: the element emits no parallel media events and receives no
policy.

| Member | Purpose |
| --- | --- |
| `currentTime`, `duration`, `paused`, `seekable` | Read-only playback state, as on `HTMLMediaElement`. |
| `play()`, `pause()`, `seekTo(seconds)` | Control. `seekTo` replaces a writable `currentTime`. |
| `capabilities` | `canPause` and `canRestrictSeeking`, declared by the adapter. |
| `subscribe(listener)` | `time`, `seek`, `play`, `pause` and `ended` notifications; returns an unsubscribe function. |

A port attaches in one of two ways. The stimulus card (`SectionPassageCard`) finds
the media element its passage mounted and attaches `createMediaElementTimeSource`,
which reports both capabilities; the registration reaches `SectionController` as the
toolkit's `pie-media-time-source` registration event. A host with its own player
attaches its port through `SectionController.attachMediaTimeSource()`, and a
host-attached port outranks the card's discovery while it is attached.

The media model the draft sketched as `VideoStimulusModel` is `MediaAssetRef` in
`@pie-players/pie-players-shared/types`, ratified by the
[media asset contract](../prds/shared-contracts/media-asset-contract.md): every field
of the draft maps onto a shipped one. Authored media URLs are wire-facing and
untrusted. `@pie-players/pie-players-shared/media` holds the player-side validation:
the source-scheme allow-list, source normalization, dedupe by `src` and fragment
normalization. `video-stimulus` carries a copy of `isSafeMediaSrc` and
`normalizeMediaSources`, because an element runs under any host and takes no
dependency on a player package; parity tests in the element hold the two copies
together, the way `@pie-element/shared-types` mirrors `MediaAssetRef`. The element's
own contract is the
[video-stimulus PRD](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/prds/video-stimulus/PRD.md)
in pie-elements-ng.

## Worked Example

The section from [Section Data](#section-data), delivered:

1. The host mounts a section layout, for example `pie-section-player-splitpane`, with
   the section.
2. `SectionController` validates `timedMedia`, resolves `stimulusRef` to the
   stimulus passage and computes the timed-media projection. Both cued items are
   mounted and hidden.
3. The stimulus card renders `video-stimulus` through the item-player, finds its
   `<video>` and attaches a native Media Time Source.
4. The learner starts the video.
5. At 42.5 s, playback reaches `cue-eye-protection`, a `gate`. `SectionController`
   pauses the media through the port, and the layout reveals `q-eye-protection`,
   announces the cue and moves focus to the gated item.
6. The child multiple-choice element updates its own session and emits
   `session-changed` through item-player.
7. `SectionController` records the item session in the section item-session map.
   Once the item's formative correctness is `correct`, or `unknown`, which this
   cue's `onUnknownCorrectness: "release"` releases, the gate releases and the cue
   is complete.
8. The learner resumes playback.
9. At 118 s, `cue-spill-response` reveals `q-spill-response` without holding
   playback.
10. When every required cue and every item is complete, and the media has ended
    because `requireMediaCompletion` asks for it, `aggregateComplete` becomes true.
    `scoringPolicy` is validated and carried to the host unchanged; PIE derives no
    aggregate score from it.

## Session, Scoring, and Persistence

Child item sessions stay in the section item-session map. Media progress and cue
state are a versioned `timedMedia` slice on `SectionControllerSessionState`, the
host-facing snapshot `getSession()` returns and `applySession()` accepts, beside the
formative slice:

```ts
interface TimedMediaSectionSessionSlice {
  version: 1;
  mediaCurrentTime: number;
  maxPositionSeconds: number;
  mediaCompleted: boolean;
  visitedCueIdentifiers: string[];
  completedCueIdentifiers: string[];
  activeCueIdentifier?: string;
  aggregateComplete?: boolean;
}
```

The rules behind it:

- child responses remain child item sessions;
- media progress and cue state are section state;
- durable persistence is host-owned;
- section runtime emits canonical section events from the layout host;
- `maxPositionSeconds` is persisted because `allowSeekAhead: false` clamps against
  it, and a reload would otherwise hand the learner the whole timeline back;
- a slice with an unrecognized `version` is rejected whole, so cue progress restarts
  while the item sessions in the same snapshot apply untouched.

The slice carries no playback-attempt history.

`scoringPolicy.strategy` is `sum-child-outcomes`, `average-child-outcomes` or
`host-defined`. It is validated and persisted, PIE derives no aggregate from it, and
a section that omits it gets no default. Completion is `aggregateComplete`, separate
from score, so `all-required-cues-complete` is not a scoring strategy.
`weighted-child-outcomes` waits until weights have an authorable home, which is the
[score components contract](../prds/shared-contracts/score-components-and-section-outcomes.md)'s
question.

## Authoring Model

Timed media introduces an authoring category, composition authoring.

| Authoring layer | Author edits | Owner |
| --- | --- | --- |
| Element authoring | One element model, such as a multiple-choice question or video stimulus media metadata. | `pie-elements-ng` element packages. |
| Item authoring | Markup and models for a normal PIE item, possibly with multiple elements. | Existing item authoring hosts and product tooling. |
| Composition authoring | Section-level stimulus, item refs, cue ranges, cue-to-item bindings, playback policy, scoring policy, layout preview. | The authoring application that already owns item and passage authoring and already assembles and previews an `AssessmentSection`. |
| Assessment authoring | Assembly of sections into a test, activity or larger assessment definition. | Host product or assessment authoring system. |

The video stimulus authoring UI edits sources, poster, captions, transcript and media
accessibility metadata. It does not edit cue bindings.

The composition authoring UI edits cues, binds them to existing or newly created item
refs, configures playback and scoring policy, and previews the timeline. It may invoke
normal item authoring surfaces for child questions and does not own child item
internals. The authored artifact is PIE-native `timedMedia`, and the editor requires
the stimulus media resolvable to a playable URL while authoring. The
composition-authoring PRD belongs in pie-players beside the contract; the contract's
[Composition Authoring](../prds/timed-media-section-contract.md#composition-authoring)
holds the decisions it starts from.

Host products remain responsible for item banks, media asset storage, content
workflow, permissions, review, publishing and durable persistence.

## QTI 3 Mapping

QTI 3 supports many ingredients of this shape, but has no native primitive for
section-level cue-to-item orchestration.

| QTI 3 concept | PIE field / concept | Gap or profile need |
| --- | --- | --- |
| `qti-assessment-section` | `AssessmentSection` | Good fit for grouping child item refs and shared context. |
| `qti-assessment-item-ref` | `assessmentItemRefs` | Good fit for normal child questions. |
| `qti-rubric-block` / shared stimulus | `rubricBlocks` / stimulus reference | Can represent shared context, but not cue orchestration by itself. |
| `qti-media-interaction` | Item-level media interaction | Useful for media as an item interaction; not enough for section-level cue-to-item behavior. |
| `qti-time-limits`, item session control, branching | Section/test controls | Related but not expressive enough for media timeline cue semantics. |
| PCI / custom interaction | Opaque custom item wrapper | Can wrap the whole experience, but hides normal child item, session and outcome structure. Not preferred. |
| PIE timed-media profile | `sectionType: "timed-media"` and `timedMedia` | Needed to preserve cues, playback policy, child item bindings and aggregate behavior in import and export. |

PIE uses QTI-like section data as the base and carries timed-media behavior as a PIE
profile. The authored artifact is `timedMedia`, and QTI is an export concern in
[pie-qti](https://github.com/pie-framework/pie-qti).

A live import path already constrains the media vocabulary: the PIE API backend's
Learnosity importer writes `accessibilityCatalogs` carrying `MediaAssetRef`-shaped
media, and `transcript` joined the known catalog types because that importer emits
it.

## Accessibility and Toolkit Implications

Timed-media delivery is held to WCAG 2.2 AA and works with section tools and
accommodations:

- captions and subtitles are first-class model fields, not optional decorations;
- transcripts are available for video content when policy requires them;
- all media controls are keyboard accessible and expose clear labels;
- cue activation is announced to assistive technology;
- focus moves predictably when playback pauses and an item appears;
- reduced-motion and autoplay preferences are respected;
- read-aloud and media playback do not conflict;
- captions and transcripts stay available during paused cue questions;
- seek-lock policy does not trap keyboard or assistive-technology users;
- high-contrast and zoom layouts support the video, cue list, transcript and child
  item region.

Four of these rest on decisions made for signing and recorded audio. Two are
settled and two are partly open:

- **Read-aloud versus media playback (settled).** The action the learner just took
  wins: starting one pauses the other. The rule comes from the
  [sign-language PRD](../prds/sign-language-asl-support.md) and is stated once in
  code, as `bindTtsAudioHandoff` and `pauseTtsForMediaAudio` in
  `@pie-players/pie-assessment-toolkit` (exported from `tools/registration`). The
  signing region binds them against its own video; `PieAssessmentToolkit` binds them
  for a stimulus it reaches through the Media Time Source, with
  `SectionController.pauseMediaForCompetingAudio()` as the section's half. A read
  still loading counts as playing on both sides. Recorded audio needs no such seam,
  because it is `TTSService` playing a file. A stimulus is in the signing region's
  position, since it plays media the TTS service does not own. One shared statement
  of the rule keeps "which states count as speaking" from drifting between surfaces
  that share nothing else.
- **Media region styling (partly open).** Three `--pie-section-player-item-media-*`
  tokens (aspect ratio, min height, max height) are registered in
  `packages/theme/src/token-registry.json` and owned by
  `@pie-players/pie-tool-sign-language`, which sizes its own content, so
  `check:theme-tokens` holds them to the registry rule. They keep the
  `pie-section-player` prefix because hosts set them by those names: a capability's
  tokens are named for the host surface they are set on. The region stacks, and its
  divider withdraws, below a 560px card width. A timed-media stimulus is a different
  scale and needs its own tokens, registered the same way. These tokens size the
  region; the media controls are the browser's default `<video>` chrome, unstyled,
  so control styling and keyboard labeling are open. They build against the
  [broad theming contract](../prds/pie-727-broad-theming-contract.md): canonical
  resolution, ten complete built-in schemes, `color-scheme` polarity stamped from
  the resolved scheme, and `--pie-fixed-hue-collapse`, through which a pinned accent
  resolves into a palette under an accommodation.
- **Playback failure (open for the stimulus).** Recorded audio that will not play
  degrades to the docked node's `content` card, because QTI and APIP keep the reading
  script beside the recording as a real text twin. A signing card does not use
  `content`, so a signing clip that fails has nothing to fall back to, and a stimulus
  is in signing's position. The audio path plays only the first source and leaves
  the rest unread: an `<audio>` element fed alternative `<source>` children reports
  failure through a path too unreliable to detect, and a dependable fallback was
  worth more than encoding negotiation. A stimulus with several encodings needs that
  negotiation, so it needs failure detection that survives `<source>` fallback, one
  of the things a wrapped player buys over a bare element.
- **Suppression (settled).** Signing has no equivalent of `data-tts-suppress`, by
  decision: suppression is per content node, a signed alternate is one video per
  item, and the only available rule would withhold a deaf candidate's whole
  translation over one word. Read-aloud suppression ships as `data-tts-suppress` on
  the content element, mapping QTI's `data-qti-suppress-tts`. Cue-scoped suppression,
  if it comes up, follows the signing reasoning.

Two placement surfaces ship and are the precedents for a stimulus's captions and
transcript: `content-lead`, where the audio-transcript capability renders a text
alternate full width above the card body, in document flow, on item and passage
cards; and the side-docked `content-media`, which signing uses. Media-control focus
and reading-tool coordination build on the line-reader window view and the inline
TTS work.

Timed media reuses section-level tool coordination. The toolkit's timed-media roles
are listed in [Layer Ownership](#layer-ownership).

## Video Player Dependency Decision

`video-stimulus` renders a native `<video controls>`, and no player library is a
dependency. The [video-stimulus PRD](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/prds/video-stimulus/PRD.md)
records the decision: `@videojs/html` remains a future option, but Video.js v10 is in
beta and its package is too large to adopt before the native seam is proven under the
browser bundle budget.

Dependency isolation holds whichever player renders: the section talks to the Media
Time Source and never to a player library, so adopting a library changes an adapter
and nothing in the section.

PIE renders learner-facing media on native elements in two places: the stimulus, and
the signing region (`SignLanguageMediaRegion.svelte` in
`@pie-players/pie-tool-sign-language`), which is native because signing clips are
seconds long; the [sign-language PRD](../prds/sign-language-asl-support.md) records
that reasoning. A wrapped player has to beat the native baseline on what a stimulus
needs and a signing clip does not: seek-range gating, caption and transcript UI,
quality and track selection, and a control surface a playback policy can disable. If
one lands, the signing region either stays native by stated decision or migrates;
two media stacks in one player without a stated reason is the outcome to avoid.

Candidates evaluated before the native decision:

- **Video.js v10**, a modular rewrite with HTML custom elements through
  `@videojs/html`, TypeScript and ESM oriented, and the effort Vidstack, Media Chrome
  and Plyr are converging into; reported as Apache-2.0.
- **Vidstack**, MIT licensed, accessible, ESM oriented and friendly to web components
  and Svelte.
- **Media Chrome**, MIT licensed and web-component native, a lower-level control
  layer close to the native media element API.

Links:

- [Vidstack, Media Chrome, and Plyr are merging forces](https://github.com/vidstack/player/discussions/1747)
- [Video.js v10 Beta: Hello, World (again)](https://videojs.org/blog/videojs-v10-beta-hello-world-again)
- [`@videojs/html` package](https://www.npmjs.com/package/@videojs/html)

Adopting any of them first verifies the exact package license, version maturity,
package size, browser support and API stability.

## Relationship to Sign Language

Sign-language (ASL) delivery is video and accessibility-driven, and it is a different
contract: an item-level alternate representation of many short recordings, each
docked to one content node, played on learner demand and gating nothing. Section-player
renders it through the accessibility-catalog rail (`sign-language` catalog cards
docked via `data-catalog-idref`, gated by the `signLanguage` PNP support). The
[sign-language PRD](../prds/sign-language-asl-support.md#relationship-to-section-player-and-to-timed-media)
owns the comparison and the reasons signing is not a passage or a section type.

| | Timed media | Sign language |
| --- | --- | --- |
| Scope | Section | Content node inside an item |
| Media count | One shared stimulus | Many short recordings |
| Purpose | Orchestrates items | Translates language |
| Timeline role | Reveals, gates, sequences items | None |
| Trigger | Playback position | Learner demand |
| Granularity | Item refs | Prompt, and plausibly answer choices |
| Section type? | Yes | No |
| Runtime host | Section-player (existing layouts) | Section-player (existing catalog rail) |

The two share the [media asset contract](../prds/shared-contracts/media-asset-contract.md)
and time-ranged playback. `MediaAssetRef` and its companions are in
`@pie-players/pie-players-shared/types`, with a time range carried beside the asset
as a `MediaFragmentRange`, because a range describes one use of a recording. Cue
ranges reuse it in that position in both point and ranged forms. QTI 3 expresses
signing time slices with Media Fragments URIs, so one recording can serve several
content nodes. The range type carries no playback meaning: a cue's activation window
is not signing's "play only this slice".

## Rejected Alternatives

- **Leaf element container:** cue orchestration, child item sessions, section tools
  and aggregate completion are section concerns.
- **Only a passage:** a plain passage does not own playback policy, cue-triggered
  item reveal, seeking rules or child session aggregation.
- **Full assessment player:** the unit is one section with one shared media stimulus
  and child items; assessment-level routing stays above it.
- **Opaque PCI or custom item:** it would hide normal PIE child questions and make
  scoring and session reuse harder.
- **`settings` escape hatch:** rejected for core composition data. Rendering knobs
  may live in settings, but cue-to-item bindings and playback and scoring policy are
  typed section contract fields.
- **A dedicated layout element (`pie-section-player-timed-media`):** hosts pick the
  layout tag and the existing layouts render the projection; see
  [Section Type and Layouts](#section-type-and-layouts).
- **Cue policy in `ToolPolicyEngine`:** its decision domain is tool eligibility.
- **Media inline in `timedMedia.media`:** see option 3 in
  [Video Stimulus Mapping](#video-stimulus-mapping).

## Pre-implementation State

The design predates the code. It was drafted in June 2026 and checked against
`develop` three times before implementation, and its core assumptions held:
`sectionType` was unused in `packages/`, so the section data landed additively; the
four layout custom elements existed; and `@pie-players/pie-players-shared` and
`@pie-players/pie-assessment-toolkit` were the right owning packages. These moved
underneath the draft:

- **Delivery path.** The assessment player has no data-driven renderer selection,
  so the draft's dispatch step had no seam. See
  [Section Type and Layouts](#section-type-and-layouts).
- **Stimulus payload.** `RubricBlock` is passage-typed, which first read as weakening
  the passage mapping; a passage payload is a PIE config, so the mapping holds. See
  [Video Stimulus Mapping](#video-stimulus-mapping).
- **Toolkit engine layer.** The toolkit grew a policy and runtime engine layer:
  `SectionRuntimeEngine`, `SectionControllerBinding`, `SectionEngineCore`, engine
  state, transition and stage derivation, `RuntimeRegistry`, `SectionEngineAdapter`,
  an instrumentation bridge, and `ToolPolicyEngine` with `PolicySource`,
  `compose-decision` and provenance tracking. It sits beneath the standalone
  section-player path as well as the assessment player. The draft put cue
  orchestration in a layout custom element, and the engine then looked the better
  home; cue and playback policy went to the pure `timed-media` module with live
  state in `SectionController`. See [Section Type and Layouts](#section-type-and-layouts).
- **Media vocabulary.** The [media asset contract](../prds/shared-contracts/media-asset-contract.md)
  is `Accepted`, ratified against this design's shapes before the release that first
  published the types. Recorded audio, as `SpokenAudioCardPayload`, a `spoken`
  alternate, exercised the same shape for `kind: "audio"` with no field change. The
  media half of this design is inheritance, and what the section contract adds is
  what a cue range means. See [Media Time Source](#media-time-source).
- **Native media precedent.** Signing renders through a minimal native
  `<video controls>`, so the player decision has a working baseline to beat. See
  [Video Player Dependency Decision](#video-player-dependency-decision).
- **Theming and placement.** The broad theming contract is `Accepted`, and the
  `content-lead` surface is a second placement precedent beside `content-media`. See
  [Accessibility and Toolkit Implications](#accessibility-and-toolkit-implications).
- **A media producer.** The PIE API backend's Learnosity importer emits
  `MediaAssetRef`-shaped media. See [QTI 3 Mapping](#qti-3-mapping).
- **Interaction events.** The interaction-event shared-contract PRD is partly overtaken by shipped code: `players-shared/src/instrumentation/` ships a provider abstraction (DebugPanel, NewRelic, Console, Composite), and `players-shared/src/pie/instrumentation-event-map.ts` maps source events to telemetry event *names* behind a bridge. Neither is the projection envelope that PRD designs: there is no source-reference shape, category or version. The PRD's [Problem](../prds/shared-contracts/interaction-event-contract.md#problem) records the boundary.
- **Element framework.** The passage element is in pie-elements-ng's
  `packages/elements-react/` and `video-stimulus` in `packages/elements-svelte/`, so
  they share no framework or code; the sibling framing is conceptual.
- **Sign language.** Signing came up as a use for this section type and was scoped
  into its own contract. See [Relationship to Sign Language](#relationship-to-sign-language).

## Open Questions

The PRD's [Open Questions](../prds/timed-media-section-contract.md#open-questions)
are the record for the contract, among them captions end to end and score
projection. Beyond them, this design leaves open:

- the composition-authoring PRD, including a cue-timeline MVP versus a full visual
  editor;
- how the PIE timed-media profile is serialized beside QTI-like section, item-ref and
  stimulus data in import and export;
- media-control styling and keyboard labeling for the stimulus;
- a fallback for a stimulus that fails to play, which has no text twin;
- scorer, proctor and review views for cue-linked child items.
