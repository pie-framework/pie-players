# P0 Shared Contracts Architecture

Status: Architecture proposal

This note is the origin record for the shared PIE contracts that timed media,
branching, simulations, learner evidence, score aggregation and standards
adapters build on. It is for contributors writing or reviewing those contracts.
P0 marks them as first-priority foundation work: several capabilities need the
same building blocks before any of them can ship. The note is directional. The
PRDs in [`../prds/shared-contracts/`](../prds/shared-contracts/) own exact
TypeScript names, exports, wire fields and migration details, and their
[README](../prds/shared-contracts/README.md) tracks each contract's status.

## Context

Several higher-value capabilities need the same building blocks:

- video-linked and timed-media assessment;
- section and assessment outcome rollups;
- branching scenarios and role-play;
- simulations and process-capture workflows;
- learner evidence capture;
- adapter-friendly outputs suitable for QTI/PCI, LTI, xAPI, and Caliper adapters.

PIE provides stable interactions, player and container behavior, sessions,
outcomes, accessibility behavior and event projections that host systems
consume, and stops short of a complete assessment platform. Host systems own
item banks, content workflow, storage, identity, privacy, scheduling, reporting,
gradebooks, standards certification, and product policy.

## Goals

- Preserve current PIE element and item-player contracts.
- Reuse existing `pie-players` session, completion, and scoring primitives before adding new shapes.
- Define additive shared contracts that make host-built assessment systems
  possible without requiring them to use a complete PIE assessment-player
  solution.
- Establish enough vocabulary and boundaries for future PRDs to implement timed
  media, branching, simulations, evidence capture, and score rollups
  consistently.
- Keep standards language adapter-oriented until a tested adapter claims conformance.

## Non-Goals

- No changes to the PIE element runtime/controller interfaces.
- No changes to the `pie-item-player` host-facing interface.
- No item bank, media repository, catalog, workflow, rostering, scheduling,
  gradebook, reporting, evidence review, or backend storage contract.
- No new full assessment-player product surface.
- No generic untyped persistence bag for future section behavior.
- No new production names based on planning labels such as `P0*`, `*V1`, or
  proposal wording such as `Normalized*` as the primary public contract name.

## Compatibility Rules

The shared contracts are additive by default.

| Surface | Rule |
| --- | --- |
| PIE elements | Keep model/session/environment/controller APIs as defined by the [PIE element contract](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/PIE_ELEMENT_CONTRACT.md) in pie-elements-ng. |
| Element events | Preserve canonical `session-changed` and `model-set` events from `@pie-element/shared-player-events`. |
| `pie-item-player` | Keep existing properties, events, and imperative APIs. Richer host/adapter projections observe this surface; they do not replace it. |
| `section-player` | Additive extensions are acceptable. Breaking changes require a later PRD to prove urgent need. |
| `assessment-player` | A reference assembly and one possible host runtime layer. Production assessment players are host-built from the section player and toolkit, and no consumer of PIE building blocks needs it. |
| Naming | Use durable domain names in code. Put versioning in wire/schema fields or package semver, not in exported interface names. |

Custom-element tag names are the exception to the naming rule above: versioned
`pie-*--version-*` tag names are authored/runtime identity, not interface-name
versioning. Any projection, adapter, sanitizer, or source reference that carries
PIE element identity must preserve the full rendered tag name and pass through
contract attributes such as `id`, `model-id`, `session-id`, `slot`, `data-*`,
`aria-*`, `pie-*`, `config-*`, and `context-*` unchanged.

## Layer Ownership

![Proposed P0 layer ownership: the host application passes content, persistence, policy and identity to the optional assessment player, uses the section and item players directly, and sends event and outcome projections to optional standards adapters; the assessment player passes section sessions and route state to the section player layouts, which exchange section state, tools and completion with the assessment toolkit and pass child item refs and sessions to the item player; the item player sets model, session and env on PIE elements, which report session-changed and model-set](../img/design-shared-contracts-layers.excalidraw.svg)

| Layer | Owns | Does not own |
| --- | --- | --- |
| Host application | durable persistence, identity, policy, storage, standards mapping, reporting, privacy, product workflow | element internals or section runtime mechanics |
| Standards adapters | mapping PIE projections into QTI/PCI, LTI, xAPI, Caliper, or product analytics | PIE runtime state ownership or certification claims without testing |
| `assessment-player` | assessment routing, section session rollup, submission state for consumers that choose it | item scoring, section-specific orchestration, backend reporting |
| `section-player` layouts | section layout, child item orchestration, section completion, section-type behavior such as timed media | leaf element contracts, backend persistence, product policy |
| `assessment-toolkit` | section controller contracts, attempt/session helpers, tools and accommodation coordination | complete assessment product behavior |
| `pie-item-player` | item rendering, element loading, item session forwarding, local per-element scoring preview | section/assessment rollups, standards mapping |
| PIE elements | authored model, learner session, view model, element outcome, accessibility metadata | assessment routing, child item aggregation, media cue orchestration |

## Existing Contracts To Reuse

The shared contracts start from the contracts already present in the repositories.

| Concern | Existing contract |
| --- | --- |
| Element runtime | [`PIE_ELEMENT_CONTRACT.md`](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/PIE_ELEMENT_CONTRACT.md): model, session, environment, controller helpers, custom element property API |
| Element events | `SessionChangedEvent` and `ModelSetEvent` in `@pie-element/shared-player-events` |
| Leaf outcome | `OutcomeResult` in `pie-elements-ng`, `OutcomeResponse` in `@pie-players/pie-players-shared/types` |
| Local item scoring | `scorePieItem(...)` in `players-shared/src/pie/scoring.ts` and `pie-item-player.provideScore()` |
| Item session normalization | `ItemSessionContainer`, `NormalizedItemSessionChange`, `normalizeItemSessionChange(...)` |
| Section attempt state | `TestAttemptSession`, `TestAttemptItemSession`, `upsertItemSessionFromPieSessionChange(...)` |
| Section persistence snapshot | `SectionControllerSessionState` |
| Section runtime completion | `SectionControllerRuntimeState`, `item-complete-changed`, `section-items-complete-changed` |
| Assessment session rollup | `AssessmentSession` and `AssessmentSectionSessionState` in `@pie-players/pie-players-shared/types`, toolkit `upsertSectionSession(...)` |

Important current limits:

- `pie-item-player.provideScore()` and `scorePieItem(...)` return per-element
  outcomes, not an accepted rolled-up item score. One consumer now rolls them up
  for a bounded purpose: the [formative delivery
  contract](../prds/formative-delivery-contract.md) derives a four-valued
  correctness per Try, always browser-derived and carrying no provenance or
  authority. A general score projection must stay able to express it, including
  its "excluded because not auto-scorable" state.
- Item and section completion aggregation exist today. Assessment-player exposes
  routing, progress, submission state, and per-section snapshots, but not an
  accepted assessment-completion or assessment-score rollup.
- Section and assessment session snapshots carry responses and
  navigation/completion-related state, not score summaries.
- Assessment session types have one home,
  `@pie-players/pie-players-shared/types`, re-exported from the
  `assessment-toolkit` root; assessment-level fields are added there.

## Contract Families

### Event Projection

The event work is a host and adapter projection over existing runtime events. It
must not rename or replace:

- element `session-changed`;
- element `model-set`;
- `pie-item-player` events or methods;
- `SectionControllerEvent`;
- assessment-player controller/public events.

The projection should make existing runtime behavior easier for hosts and
standards adapters to consume. It can be produced by a host adapter, section
runtime adapter, assessment-player adapter, analytics bridge, or standards
bridge.

Event projections need stable source references:

- assessment;
- section;
- item;
- element;
- media asset;
- cue;
- tool;
- scenario;
- branch;
- simulation;
- step;
- evidence;
- rubric.

Element source references must preserve PIE element identity verbatim. They
must not collapse a rendered `pie-*--version-*` tag to its base tag, synthesize a
replacement identifier, or normalize contract attributes that the item/player
runtime uses for model and session binding.

Event projections should separate state-bearing events from analytics-only
events. Hosts can then decide what belongs in durable attempt state, what
belongs in telemetry, and what should be dropped for privacy or policy reasons.

Branching, simulations, and replay/debug need a small process vocabulary:

- attempt and run identifiers;
- parent-child causality between events;
- decision and path events;
- ordered process steps;
- resumability markers;
- externally graded outcome references.

Final event PRDs should use typed, discriminated payloads per event family.
Generic `Record<string, unknown>` payloads may be acceptable for telemetry
extension points, but they should not become the primary public event API.

Documentation sketch only:

```ts
interface InteractionEventProjection {
  version: 1;
  id: string;
  type: string;
  timestamp: number;
  source: InteractionSourceRef;
  category: "state" | "analytics" | "debug";
  payload?: TypedEventPayload;
}
```

This sketch is not an implementation naming recommendation. Score and outcome
projections are a distinct contract family; generic interaction events should
not imply that a score exists until an explicit scoring surface has run.

### Session And Completion

The existing section snapshot shape remains the base:

```ts
interface SectionControllerSessionState {
  currentItemIndex?: number;
  visitedItemIdentifiers?: string[];
  itemSessions: Record<string, unknown>;
}
```

Section profiles add named, typed slices only when their PRDs ratify them. Two
have shipped this way: `formative`, from the [formative delivery
contract](../prds/formative-delivery-contract.md), and `timedMedia`, from the
[timed-media section contract](../prds/timed-media-section-contract.md). Each is
optional and versioned, and a slice with an unrecognized `version` is rejected
whole while `itemSessions` in the same snapshot still applies. Slices this note
anticipated:

- `timedMedia` for media progress and cue state;
- `branching` for path state and reachable item/step state;
- `simulation` for process state or externally graded checkpoints.

There should not be a universal `profileState` bag. Each slice needs:

- a named owner PRD;
- explicit merge and replace semantics;
- clear persistence expectations;
- explicit hydrate, persist, and assessment-rollup behavior;
- compatibility behavior for hosts that do not know that profile;
- a statement of whether the slice is scoring state, delivery state, or telemetry.

Unknown hosts must not preserve future section behavior by inventing a generic
bag, alias map, fallback normalizer, or duplicate dispatch path. A slice PRD
must choose the exact unknown-host behavior for that named slice: reject it,
ignore/drop it, or round-trip it under its ratified key with typed owner-defined
merge semantics. The PRD should include replace, merge, hydrate, persist, and
round-trip tests for the chosen behavior.

Completion projections need their own provenance and authority rules. Later
PRDs must state whether completion is sourced from item session metadata,
`OutcomeResponse.completed`, media watch state, cue completion, branch/process
state, section aggregation, assessment submission, or host policy, and whether
that completion state is provisional, derived, or terminal.

Documentation sketch only:

```ts
interface TimedMediaSectionState {
  mediaCurrentTime: number;
  mediaCompleted: boolean;
  visitedCueIdentifiers: string[];
}

interface ExtendedSectionControllerSessionState {
  currentItemIndex?: number;
  visitedItemIdentifiers?: string[];
  itemSessions: Record<string, unknown>;
  timedMedia?: TimedMediaSectionState;
}
```

This sketch illustrates additive typed slices. The shipped slice is `TimedMediaSectionSessionSlice`.

### Score And Outcome Projection

The score family defines the missing section and assessment score projection and
leaves leaf scoring unchanged.

Leaf scoring remains element-owned:

- element controllers return `OutcomeResult` / `OutcomeResponse`;
- multi-element items can produce multiple leaf outcomes;
- rubric/manual-scored items may not have meaningful auto-score outcomes;
- partial scoring is governed by element model and environment rules;
- server-side scoring may remain authoritative for persisted host attempts.

The score projection should wrap existing leaf outcomes and optional aggregate
fields. It should not add score fields to existing session snapshots unless a
later PRD explicitly ratifies that additive change.

Documentation sketch only:

```ts
type LeafOutcome = OutcomeResponse;

interface ScoreComponent {
  source: InteractionSourceRef;
  outcome?: LeafOutcome;
  points?: number;
  max?: number;
}
```

Rules for later PRDs:

- `OutcomeResponse` is the leaf source.
- `points` and `max` are aggregate/projection fields mapped from existing scoring vocabulary.
- Score components must distinguish absent score, zero score, not scorable,
  manual score pending, preview score, external score, and final/authoritative
  score.
- Score projections need explicit provenance and authority fields, such as
  auto, manual, external, preview, or server-authoritative, before section or
  assessment aggregation can treat them as comparable.
- Denominator and serialization policy must state how `undefined`, `null`, `0`,
  omitted `outcome`, and omitted `max` are interpreted.
- A score rollup must state its aggregation policy, such as sum, average,
  weighted, or host-defined.
- Completion rollup policies are separate from score aggregation policies and
  must define their own source, authority, and terminal/provisional semantics.
- Watch completion, cue completion, branch completion, and child correctness
  must remain distinguishable.
- Persisted score storage remains host-owned unless a specific player PRD
  introduces an additive score snapshot field.

### Media Asset Metadata

Stimulus media needs a shared metadata vocabulary broader than video and
sufficient for the `video-stimulus` element, which has shipped in
pie-elements-ng. The [media asset
contract](../prds/shared-contracts/media-asset-contract.md) ratified it.

Fields this note set out:

- media kind: image, audio, video, or other;
- one or more source URLs with MIME type;
- poster or thumbnail where relevant;
- duration when known;
- captions or subtitles, preferably WebVTT when browser playback is involved;
- transcript reference or inline transcript;
- accessible label or description;
- language and track metadata.

Host responsibilities:

- asset storage;
- signed URLs;
- CDN and CSP policy;
- virus scanning;
- authorization;
- retention;
- privacy and consent;
- transcoding;
- availability guarantees.

### Learner Evidence Metadata

Learner-submitted evidence is separate from stimulus media. PIE may provide a
thin capture or reference UI later, but host systems own the hard parts.

The evidence family reserves vocabulary for:

- modality: audio, video, image, file, or mixed;
- captured asset reference;
- MIME type;
- size;
- duration;
- transcript or caption metadata when available;
- rubric or scoring-context linkage;
- source item, section, step, branch, simulation, or scenario reference.

Host systems own:

- upload;
- malware scanning;
- signed URLs;
- retention;
- permissions;
- privacy;
- review workflow;
- audit logs;
- reviewer identity and comments.

### Adapter-Friendly Hooks

PIE should expose stable source data that adapters can map to standards. PIE
should not claim standards conformance until a concrete adapter is tested.

| Standard / ecosystem | PIE contribution | Host or adapter responsibility |
| --- | --- | --- |
| QTI / PCI | stable section, item, element, outcome, media, and profile references | exact XML/profile mapping and validation |
| LTI | outcome and completion projections | launch, identity, grade passback, AGS mapping |
| xAPI | event projection with source refs and process vocabulary | actor, verb/object mapping, statement authority, LRS policy |
| Caliper | event projection with assessment context | sensor mapping, entity normalization, event certification |

Adapter-facing contracts should be precise enough to avoid lossy mappings, but
not so standards-specific that PIE runtime code becomes coupled to one reporting
system.

Adapter package direction:

- QTI/PCI mapping belongs in
  [pie-qti](https://github.com/pie-framework/pie-qti), consuming PIE projection
  contracts.
- LTI, xAPI, and Caliper may become separate `@pie-players/*` adapter packages
  after the shared projection contracts exist.
- SCORM is out of scope for the shared contracts.

### Accessibility Runtime Patterns

The accessibility family captures reusable accessibility expectations for
cross-cutting player behavior:

- predictable focus handoff when new child content appears;
- keyboard completion paths for media controls, overlays, toolbars, and child items;
- screen-reader announcements for cue, branch, pause, completion, and error states;
- captions and transcripts as first-class media metadata;
- overlay safety so questions do not obscure captions or essential media;
- side-panel options for longer prompts and assistive technology workflows;
- seek or navigation restrictions that allow accommodation overrides;
- TTS/media handoff rules so speech tools and media audio do not compete unexpectedly;
- high-contrast, zoom, and reduced-motion behavior;
- non-video alternatives where video itself is not an accessible source.

These patterns should reuse existing assessment-toolkit and accessibility
catalog infrastructure where possible.

## Timed-Media Alignment

The [timed-media section contract](../prds/timed-media-section-contract.md)
consumes the shared contracts instead of redefining them:

| Timed-media need | Shared contract |
| --- | --- |
| `media.*` and `cue.*` events | event projection source refs and typed event families |
| media progress and cue state | named `timedMedia` section slice |
| cue-linked child questions | existing `itemSessions` and future score projections |
| playback completion versus correctness | score/outcome projection rules that keep completion and correctness separate |
| video sources, captions, transcripts | media asset metadata |
| forced pauses and focus handoff | accessibility runtime patterns |
| xAPI/Caliper media analytics | adapter-friendly event projection without conformance claims |

The `video-stimulus` element remains a media stimulus. Cue-to-question
orchestration, child item sessions, playback policy and section completion
belong to the section controller, and the existing section-player layouts render
a section whose `sectionType` is `"timed-media"`; the [timed-media architecture
note](./timed-media-section.md#section-type-and-layouts) records why no separate
layout exists.

## How Hosts Build On This

The shared contracts make these host patterns possible:

1. A host can use only `pie-item-player` and still receive the current
   item-level events and per-element score preview behavior.
2. A host can use `section-player` and receive existing section
   session/completion state without adopting assessment-player.
3. A host can use the reference `assessment-player` assembly and receive
   routing, submission and per-section session rollup. Production assessment
   players are host-built from the section player and toolkit ([product
   scope](./architecture.md#product-scope)).
4. A host can add an adapter that observes existing runtime events and explicit
   scoring surfaces, emits product analytics and standards statements, and emits
   score projections only from controller, server, or `provideScore()` results
   with declared provenance and authority.
5. A host or a future PRD can add section behavior, such as branching, through
   typed additive section slices, as timed media did.

PIE stays a toolkit, and the built-in assessment player is one supported architecture among several.

## Future PRDs

Detailed PRDs live in [`../prds/shared-contracts/`](../prds/shared-contracts/),
whose [README](../prds/shared-contracts/README.md) tracks each contract's
status. Recommended PRD split:

1. `interaction-event-contract`
   - Event projection vocabulary, source refs, typed event families,
     privacy/telemetry rules, process/path fields.
2. `score-components-and-section-outcomes`
   - Alignment to `OutcomeResponse`, item completion, `TestAttemptSession`,
     `SectionControllerSessionState`, and `AssessmentSession`; missing
     section/assessment rollup projection.
3. `media-asset-contract`
   - Stimulus media sources, captions, transcripts, poster, accessibility
     metadata, and host storage boundary.
4. `branching-and-process-events`
   - Branching, simulations, replay/debug, resumability, externally graded outcomes, and path state.
5. `evidence-capture-metadata`
   - Learner evidence metadata and host-owned storage/review/audit responsibilities.
6. `accessibility-runtime-patterns`
   - Focus handoff, media/tool/TTS coordination, overlays, keyboard behavior,
     accommodation overrides.
7. Timed-media PRDs
   - The [timed-media section contract](../prds/timed-media-section-contract.md)
     and the [video-stimulus
     PRD](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/prds/video-stimulus/PRD.md)
     in pie-elements-ng, both Accepted, consume the above contracts. Composition
     authoring gets its own PRD; the timed-media contract's [Composition
     Authoring](../prds/timed-media-section-contract.md#composition-authoring)
     section lists the decisions it inherits.

## Open Questions

- Which package should own the eventual public event projection types?
- Should section score projections be controller methods, helper functions, host
  adapters, or a separate package?
- Which score aggregation defaults, if any, should PIE provide?
- Which future profile slices should unknown hosts reject, drop, or round-trip
  under an explicit typed owner contract?
- Which media metadata belongs in shared contracts versus individual element models?
- What is the minimum useful evidence metadata contract that does not imply storage ownership?
- Which accessibility patterns belong in toolkit services versus section-player layouts?
