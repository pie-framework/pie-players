# Speech To Text (Dictation)

Status: Draft, 2026-08-16

Not scheduled: embedded dictation waits on the insertion prototype and the
ChromeOS answer in [Open Questions](#open-questions). The non-embedded form is
supported today.

Owner: PIE Players maintainers

This PRD designs embedded dictation (`speechToText`): the element-facing
dictation-target and insertion contract, a recognizer provider with an on-device
default, policy identity, and the delivery order. It is for maintainers of the
assessment toolkit and of the pie-elements-ng response surfaces, and for
evaluators comparing PIE with other delivery systems.

Related architecture:

- [What Counts As A Tool](../tools-and-accomodations/architecture.md#what-counts-as-a-tool) — the
  eligibility / content-dependency / placement split this PRD applies to an input-side capability
- [Capability Ownership Layers](../tools-and-accomodations/architecture.md#capability-ownership-layers) —
  why this capability ships as its own package and stays out of the packaged registry
- [PIE Element Integration](../tools-and-accomodations/architecture.md#pie-element-integration) — the
  data-attribute mechanism the dictation target reuses
- [Sign Language (ASL) Support](./sign-language-asl-support.md) and
  [Audio Accommodations](./audio-accommodations.md) — the two shipped accommodations whose shape this
  one deliberately breaks from

Integrator guide: [Non-embedded dictation](../tools-and-accomodations/non-embedded-dictation.md),
for the form PIE supports today: what platform dictation into a PIE response surface is verified to
do, and its blur commit boundary.

## Problem

Every accommodation PIE ships is a **presentation** accommodation. Signing, transcript, read-aloud,
line reader, color scheme, answer eliminator: PIE resolves an alternate representation of authored
content, or paints an overlay above it, and the learner's response model is untouched. Dictation is
the first **production** accommodation — it writes the response. That crosses the boundary the tool
architecture is built on.

Three facts fix the shape of the work:

1. **The response surface belongs to another repo, and to an editor.** Constructed response is
   `pie-elements-ng` `extended-text-entry`, whose delivery renders `@pie-lib/editable-html-tip-tap` —
   TipTap over ProseMirror over `contenteditable` — and commits through the element's own
   `changeSessionValue`. `Zero DOM Mutation` forbids the player writing into that DOM, and writing
   the element's session directly would clobber concurrent typing and bypass the editor's document
   model. There is no element-facing insertion contract today.
2. **Nothing exists yet.** No `getUserMedia`, no `SpeechRecognition`, no `allow="microphone"`, and no
   microphone affordance anywhere in `pie-players`.
3. **PIE already has one input-side accommodation, and it is invisible to policy.**
   `spellCheckEnabled` is an authored model field on `extended-text-entry` and friends, passed
   straight to the delivery editor's `spellCheck` attribute. No support id is consulted, so district,
   test-administration, item, and student precedence cannot reach it and the PNP debugger cannot show
   it. That is the defect shape of the host-placed transcript class the
   [audio PRD](./audio-accommodations.md) replaced. Dictation must not be built the same way, and
   spell check should follow it out (see [Non-Goals](#non-goals)).

PIE also has a capability **for free** that it could lose without noticing. Platform dictation —
ChromeOS Dictation, Windows Voice Access, macOS Dictation, Dragon — writes into the focused editable
as if typed, so it already flows through the editor's input pipeline and the element's change
handler. State programs call that *non-embedded* speech-to-text, and Learnosity relies on it.
[Non-embedded dictation](../tools-and-accomodations/non-embedded-dictation.md) documents it as
supported and `packages/item-player/tests/item-player-dictation.spec.ts` keeps it working.

## Comparables

Researched at drafting, 2026-08. Browser support and program guidance move, so re-verify them before
implementation starts.

### QTI 3 And AfA PNP 3.0

The [AfA PNP 3.0 information model](https://www.imsglobal.org/spec/afa/v3p0/info), the
learner-needs vocabulary QTI 3 consumes, covers on-screen writing support — `spell-checker-on-screen`,
`homophone-checker-on-screen`, `thesaurus-on-screen`, `dictionary-on-screen`, `glossary-on-screen`,
`outliner-on-screen`, `visual-organizer-on-screen`, `note-taking-on-screen`,
`calculator-on-screen` — and has **no term for speech-to-text, dictation, voice input, or scribe**.
The [QTI 3.0 profile checklist](https://www.imsglobal.org/spec/afa/v3p0/qti_profile) has none
either, and QTI 3.0 (May 2022) is the current version.

The only input-side terms are `input-requirements` (`fullKeyboardControl`, full-mouse-control) and
`at-interoperable`, both statements about compatibility with the learner's **own** assistive
technology. QTI 3 catalogs carry alternate representations of content, and an input method is not
one.

So a `speechToText` support id is a **PIE extension with no standards counterpart** and is presented
as one. `spell-checker-on-screen` establishes that an on-screen writing support is a legitimate PNP
member, so the extension fits the vocabulary's grain.

### Learnosity

Learnosity ships no dictation feature. Its accessibility set is presentation plus tooling (color
contrast, keyboard control, screen-reader support, accessible math with a spoken math engine,
captions, line reader) alongside the learner's system-level assistive technology, and its VPAT covers
question types and the assessment player. Its `audio` question type records a voice response without
transcribing it; that is voice-as-response, an alternative input method this PRD keeps separate.

Learnosity's answer to speech-to-text is the non-embedded one: the platform's assistive technology
does it, and the player does not obstruct it. That position is cheaply available to PIE, which is why
the non-embedded guarantee was the first deliverable.

### Cambium TDS

Cambium's Test Delivery System, the delivery engine behind Smarter Balanced and many state programs
and the closest comparable to the host products PIE serves, is the one benchmark that ships embedded
dictation. Its student-facing model, from the
[TDS Speech-to-Text/Dictation guide](https://test-guides.cambiumast.com/TDS_Proctor/Oregon/Content/7-OverviewoftheStudentTestingSite/STTTool.htm),
is the one this PRD adopts nearly unchanged:

- A microphone button in the toolbar **of the item response area**, for students whose profile
  grants it.
- Selecting it starts dictation and selecting it again stops; it also stops after a period of no
  sound.
- Five minutes of dictation per session. A new session **appends** to the text already there.
- Transcription appears in the response area as the student speaks, with a progress indication during
  the lag.
- Punctuation may be applied automatically, and spoken commands ("New Paragraph") control some of it.
  Accuracy, grammar, and punctuation remain the student's responsibility.
- Formatting-toolbar buttons are **disabled while dictation is on**, and the student **cannot
  navigate away from the test page** while it is on.
- It serves text-response items **and note-taking**.

Cambium's guidance for the non-embedded path is to disable cloud processing in the student's
recognizer before use, so student audio does not reach third parties. An embedded implementation
inherits that requirement: on-device recognition is the default, and remote recognition is an
exception a host opts into.

### Smarter Balanced UAAG

The [Usability, Accessibility, and Accommodations Guidelines](https://portal.smarterbalanced.org/hubfs/usability-accessibility-and-accommodations-guidelines.pdf)
(June 30, 2026) classify speech-to-text, English and Spanish, as an **accommodation** — the tier
requiring documentation in an IEP or 504 plan, with one exception for a recent physical injury — in
both embedded and non-embedded forms. Embedded STT is scoped to ELA and math open-ended items and ELA
performance-task full writes; Spanish to math open-ended items.

Two requirements in that entry are design constraints. A student using STT must be able to
**develop planning notes by STT**, so dictation is not a property of the essay box. And the student
must be able to **see what they produce while composing**, which constrains where the affordance
sits.

### Browser Support

From MDN's browser-compat data for `SpeechRecognition` and the
[on-device explainer](https://github.com/WebAudio/web-speech-api/blob/main/explainers/on-device-speech-recognition.md):

| Surface | Support |
| --- | --- |
| `SpeechRecognition` (unprefixed) | Chrome 139, Edge mirrors, Safari 14.1 as `webkitSpeechRecognition`, Firefox 142 behind a flag |
| `processLocally`, `SpeechRecognition.available()`, `install()` | **Chrome 139+ only** — not Firefox, not Safari, not Chrome Android |
| `continuous` | Chrome 33, Safari 17 — **false on Chrome Android** |
| `phrases` (contextual biasing) | Chrome 142 |
| `unspokenPunctuation` | Chrome 151 |

Chrome's default path is server-based: audio goes to a Google service. `processLocally = true` is what
guarantees that "neither audio nor transcriptions leave the user's device", at the cost of a
per-language model download (~60MB) through `install()`, across roughly 17 Chrome languages. The
Intent to Ship targeted desktop Windows, macOS, and Linux first, with ChromeOS later and Android
excluded.

**ChromeOS decides feasibility**, because Chromebooks are the primary K-12 testing device and Chrome
Android is excluded outright. It is in [Open Questions](#open-questions), to be answered by testing a
managed Chromebook.

Safari exposes the prefixed API and no `processLocally`, so locality cannot be asserted there, which
is why the provider interface below reports locality.

## Goals

- Keep non-embedded dictation working, deliberately: platform dictation into a PIE response surface
  is documented as supported and tested.
- Give dictation a policy identity, so eligibility resolves through the existing PNP precedence
  and appears in the PNP debugger — including item-level restriction, which matters more here than for
  any presentation accommodation.
- Define the insertion contract: how a transcript reaches a response without the player mutating
  element DOM or writing element session state.
- Keep the recognizer swappable behind one capability — on-device Web Speech, platform AT, host
  service — with locality declared and enforced.
- Make dictation target any declared editable surface, so notes inherit it when they ship.

## Non-Goals

- **Voice as the response.** Audio recording, storage, and playback as the scored artifact is
  alternative input and Learnosity's `audio` question type: a different feature, with different
  scoring and retention.
- **Human scribe.** A designated-support/accommodation delivered by a person, with no runtime surface.
- **Spell check.** Spell check is the same layer and
  the same defect (`spellCheckEnabled` as an authored model field), and it has an actual AfA term,
  `spell-checker-on-screen`. It should reuse the input-support seam this PRD establishes, in its own
  PRD.
- **Transcription quality, punctuation commands, and grading.** What the provider returns is what the
  learner gets; correcting it is the learner's job, per every comparable.
- **A remote STT backend.** The provider seam is specified; an `stt-server-*` package parallel to
  `tts-server-*` is not scoped here.
- **Third-party AT configuration and secure-browser policy.** Host-owned, and the non-embedded path's
  actual gating question.
- **Navigation locking during dictation.** Cambium blocks page navigation while the microphone is
  live. That is progression control and belongs to section-player beside the timed-media gate.

## Package And Export Ownership

- Owning package: a new `@pie-players/*` capability package, `pie-tool-speech-to-text`, for the
  registration, the `DictationProvider` interface and its Web Speech implementation, and the
  microphone element.
- `@pie-players/pie-assessment-toolkit` gains only the generic seam: whatever `ToolContext` needs so a
  predicate can see the scope element. The support id is the tool id, so the registration carries it
  and core names no capability id; `bun run check:capability-neutrality` is the enforcement.
- Public export path: package root for the registration and provider types, matching
  `pie-tool-sign-language`.
- Composition: **deliberately absent from `createPackagedToolRegistry()` and from
  `createUniversalPersonalNeedsProfile()`.** Accommodation-tier, device-dependent, and requiring a cross-repo
  content declaration — the same three reasons signing is opt-in. A deployment installs and registers
  it as it would one of its own.
- Consuming packages or apps: section-player (item-level toolbar), PNP debugger, `section-demos`.
- Runtime environment: browser, secure context, microphone permission.
- Outside this repo: `pie-elements-ng` declares dictation targets on its response surfaces. That is
  the gating dependency — without it there is nothing to dictate into.

## Contract Shape

### Support Id

`speechToText`, the dictation tool's id. It has **no AfA PNP 3.0 or QTI 3 counterpart** and is a PIE
extension.

It is specifically **not** `voiceControl`.
`voiceControl` is schema.org's `accessibilityControl` sense — operating the interface by voice — and a
learner who needs to dictate an essay and a learner who needs to drive the UI by voice are different
populations with different grants. Conflating them would make one grant deliver the other.

### Dictation Target

The element declares which of its surfaces accept dictated text through data attributes, the
mechanism content already uses to steer tools with `data-catalog-idref` and `data-tts-suppress`:

```html
<div
  data-dictation-target="response"
  data-dictation-insert="beforeinput"
  contenteditable="true"
  role="textbox"
  aria-label="Your response"
></div>
```

Presence is the resource-side declaration — the DRD half of the AfA pair, read from the rendered
element because the resource here is an input surface, which no catalog card describes. Absence means
the capability declines at this item, which keeps a learner with the accommodation from meeting a
dead microphone on a multiple-choice item.

### Insertion By Synthesized Input

The tool inserts by dispatching an `InputEvent` with `inputType: "insertText"` at the current
selection — `beforeinput`, then `input` — so the surface's own editor pipeline runs the change as a
transaction and the element's `onChange` fires normally. Synthesizing input keeps `Zero DOM Mutation`
intact: the player never touches the element's tree, and the element's document model stays the
single source of truth for the response.

**This is the first thing to prototype, and it decides the rest of the design.** A script-created
`InputEvent` is untrusted (`isTrusted === false`), and ProseMirror's `beforeinput` handling may ignore
untrusted events. The fallbacks are `document.execCommand("insertText")` — deprecated, and still the
only trusted-path programmatic insert in Chrome — and an element-owned imperative hook. Declaring all
three now means a failed prototype narrows the choice instead of reopening the design:

```ts
/** How a dictation target accepts text. Declared by the element, honored by the tool. */
type DictationInsertMode =
  | "beforeinput"    // synthesized InputEvent at the caret; preferred
  | "exec-command"   // document.execCommand("insertText") for editors that ignore untrusted events
  | "custom-event";  // the element applies it itself

/** Dispatched on the target for `custom-event` mode. Bubbles and composed, per the host contract. */
interface PieDictationInsertDetail {
  text: string;
  isFinal: boolean;
  /** Locale of the recognizer that produced it, for the element's own lang handling. */
  lang: string;
}
```

`custom-event` is also the mode for response surfaces that are not standard editables —
`math-inline`, `drawing-response`, `explicit-constructed-response` — where "insert at the caret" has
no generic meaning and only the element knows what dictated text should do.

### Registration

```ts
export const speechToTextRegistration: ToolRegistration = {
  toolId: "speechToText",
  name: "Speech to Text",
  description: "Dictate a response instead of typing it",
  icon: "microphone",

  // Item level only. A section has no response surface, and dictation targets one.
  supportedLevels: ["item"],

  activation: "toolbar-toggle",

  // Pass 2: is there a dictation target in this scope. Not `requiresAuthoredContent` —
  // the dependency is a rendered input surface, not an authored alternate, and the
  // catalog resolver has nothing to say about it.
  isVisibleInContext(context) {
    return hasDictationTarget(context);
  },

  renderToolbar(context, toolbarContext) { /* microphone button + recognizer session */ },
};
```

This needs one core addition. `isVisibleInContext` receives a model-based `ToolContext`, which
carries the tool's own render container at most and never the item's scope element, and a
dictation-target check is a DOM-presence question. Answering it from the model instead, by listing
which element types accept dictated text, puts element type names in core: the smell
`check:capability-neutrality` exists to prevent, and one `hasChoiceInteraction` already carries.
Recommended: give `ToolContext` the scope element and let the predicate query it, accepting that the
affordance can appear one frame after the element renders. Catalog observation already tolerates
exactly that.

### Provider

Shaped after `ServerTTSProvider`, whose configuration model already separates "what the framework
enforces" from "what the host supplies":

```ts
type DictationLocality = "on-device" | "remote" | "unknown";

interface DictationProvider {
  readonly id: string;
  /** What this provider can promise about where audio is processed. */
  readonly locality: DictationLocality;
  available(lang: string): Promise<"available" | "downloadable" | "downloading" | "unavailable">;
  /** Provision an on-device language model. Absent when the provider needs none. */
  install?(lang: string): Promise<boolean>;
  start(options: DictationStartOptions): DictationSession;
}

interface DictationStartOptions {
  lang: string;
  /** Refuse to start unless locality is "on-device". Defaults to true. */
  requireOnDevice?: boolean;
  /** Hard cap on one dictation session. Defaults to 5 minutes, per the reference implementation. */
  maxDurationMs?: number;
  /** Stop after this much silence. Defaults on. */
  silenceTimeoutMs?: number;
}

interface DictationSession {
  readonly state: "starting" | "listening" | "stopped" | "error";
  onInterim(handler: (text: string) => void): void;
  onFinal(handler: (text: string) => void): void;
  stop(): void;
}
```

`WebSpeechDictationProvider` is the default: `processLocally = true`, `continuous = true`,
`interimResults = true`, `locality` derived from `SpeechRecognition.available()` and reported as
`"unknown"` on the prefixed Safari API where `processLocally` does not exist.

**No silent fallback to remote recognition.** `requireOnDevice` defaults to `true`, and a provider
that cannot assert on-device processing refuses to start and surfaces a recoverable framework
warning. This is the one piece of provider security the framework enforces itself, the role
`assetOrigins` plays for server-backed TTS; everything else — which languages are provisioned,
whether a remote provider is acceptable, what the fleet's managed policy is — is the host's.

### Behavior

Adopted from Cambium, within the ownership boundaries PIE has:

- One microphone control per item, in the item toolbar, dictating into the **focused** dictation
  target. One control per field is the alternative; a single control is what lets notes inherit
  dictation without the capability knowing notes exist.
- Interim results render in place and are visibly provisional; final results commit.
- Append, never replace. A second session continues the response.
- Auto-stop on silence, and a session cap. Both configurable, defaults matching the reference.
- **Formatting controls during dictation are the element's call.** Cambium disables its formatting
  toolbar while the microphone is live; PIE's response-area toolbar belongs to the element, so the
  tool can only publish dictation state and let the element decide. Recorded as a limitation.

## Compatibility

This PRD touches:

- **Contract attributes.** Adds `data-dictation-target` and `data-dictation-insert`, authored in
  `pie-elements-ng`, read by the toolkit. Additive; absence is a valid state meaning "no dictation
  here".
- **PIE element runtime contracts.** Response-bearing elements gain a target declaration and, for
  `custom-event` mode, a handler. No model field changes, and no element learns anything about
  policy: the element declares a capability of its surface.
- **The support id.** `speechToText`, carried by the new tool's registration. Additive.
- **`ToolContext`.** Needs the scope element for the target predicate. Additive.

It must not change versioned `pie-*` tag names, `pie-item-player` properties/events/methods,
section-player completion state, assessment-player routing, or any persisted session shape.

## Data Ownership And Host Responsibilities

PIE owns: the support id, precedence evaluation, the microphone affordance and its state, recognizer
lifecycle, the insertion contract, and locality enforcement.

Hosts own:

- Which students have the accommodation, and the item-level restriction list that scopes it.
- Microphone permission — including pre-arming it, because a permission prompt raised mid-assessment
  is a disruption to the student least able to absorb it.
- `allow="microphone"` on any iframe the player is embedded in. PIE renders no iframes; hosts do.
- Any remote STT backend, under the same session boundary and rate limiting as the rest of the
  assessment, per the [tool host contract](../tools-and-accomodations/tool_host_contract.md#backend-endpoints-for-tool-providers).
- Retention of audio, if a remote provider is used. The recommendation is none: transcribe and
  discard.
- Secure-browser posture, and whether platform dictation is permitted inside it.

Elements own: declaring a dictation target, and applying inserted text to their session.

## Serialization And Versioning

No new persisted or wire-facing data. Dictated text is indistinguishable from typed text in the
session, deliberately: flagging a response's input method in the response invites scoring bias
against the students the accommodation exists for.

A program that needs to know dictation was used gets a **process record**:
[evidence capture metadata](./shared-contracts/evidence-capture-metadata.md) and the
[interaction event contract](./shared-contracts/interaction-event-contract.md) are where that
belongs.

## Accessibility

- Insertion happens at the caret and must not move focus. A dictating learner who loses their caret
  position has lost the accommodation.
- Recording state is announced through a live region. Interim results are **not** announced — partial
  results fire continuously and would flood a screen reader — so only state changes and final commits
  are.
- Stopping must not require typing. Silence auto-stop is therefore an accessibility mechanism: for a
  learner dictating because they cannot use a keyboard, it is the reliable stop.
- The affordance must not cover the response area, per the UAAG requirement that a student can see
  what they produce while composing.
- Microphone permission state needs a visible, non-modal explanation when denied. A silent no-op
  reads as a broken accommodation.
- WCAG 2.2 AA: the affordance introduces no new failure. Dictation is how some learners meet the
  motor-input expectations, so the program-tier question in [Open Questions](#open-questions) is a
  construct decision.

## Standards Or Adapter Impact

No QTI or AfA conformance claim is available, because no term exists to map to. A QTI adapter carries
`speechToText` as a vendor extension, and PIE must not present it as an AfA support id in
documentation, the debugger, or a PNP export.

The terms a PNP importer should read are `input-requirements` and `at-interoperable`: a profile
asserting either describes a learner who brings their own AT, which is the non-embedded path and
needs no PIE feature beyond PIE not obstructing it.

## Test Plan

- **The non-embedded guarantee.** Shipped as `packages/item-player/tests/item-player-dictation.spec.ts`,
  which drives a PIE response surface with platform-dictation-shaped input (composition and
  `beforeinput` sequences, no synthetic `keydown`) and asserts the element's session value updates.
- Insertion-contract fixtures per declared mode, including a `custom-event` target that applies text
  itself.
- Policy precedence, including `item-restriction` denying dictation on an item whose construct is
  transcription or spelling — the case the UAAG scoping rule exists for.
- Locality enforcement: the provider refuses to start when `requireOnDevice` is set and locality is
  `"remote"` or `"unknown"`, and reports a recoverable warning without failing the section.
- Availability: no dictation target in scope means no toolbar button.
- Accessibility: focus and caret preserved across insertion; state announced; interim results not
  announced; permission denial surfaced.

```sh
bun run typecheck
bun run test
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
bun run check:capability-neutrality
```

Playwright specs run outside the sandbox.

## Rollout And Release Notes

- Changeset: `patch`, for the core seam and for the new package when it lands; every changeset in
  this repo is authored as `patch`.
- Sequencing, in dependency order:
  1. **Prototype the insertion path** against `extended-text-entry`'s TipTap editor. Whether
     ProseMirror honors an untrusted `beforeinput` decides which mode is the default and how much of
     the rest is buildable.
  2. **Land the non-embedded guarantee.** Done:
     [non-embedded dictation](../tools-and-accomodations/non-embedded-dictation.md) and
     `packages/item-player/tests/item-player-dictation.spec.ts`. It established the commit boundary
     the rest of this PRD designs around: a constructed response reaches the session on blur, so a
     dictation affordance that keeps focus in the editor keeps the response out of the session while
     it runs.
  3. **Support id and policy identity**, so eligibility is auditable before any recognizer exists.
  4. **The capability package**, behind the on-device Web Speech provider only.
  5. **A remote provider**, only if a program needs a language on-device recognition does not cover on
     the platforms the program ships.
- Documentation: this PRD, and the non-embedded guide for the shipped form.
- Release risk: low through step 3, then gated on the ChromeOS answer below. Steps 4 and 5 do not
  start until it is known.

## Open Questions

- **On-device Web Speech on ChromeOS: available, and in which languages?** Chrome Android is excluded
  outright and ChromeOS shipped after desktop. If the answer is no, embedded dictation is
  undeliverable on the primary K-12 device and the non-embedded path is the whole answer. Test a
  managed Chromebook; do not infer this from release notes.
- **Language-pack provisioning on a managed fleet.** ~60MB per language through `install()`. Is that
  an admin-pushed artifact or a per-device download, and what happens when a student triggers it
  mid-assessment on school wifi?
- **Does the host's secure-browser posture permit the microphone, and separately, permit OS
  dictation?** These are independent answers with opposite consequences: if OS dictation is permitted,
  most of the need is already met at near-zero cost.
- **Spanish.** The UAAG requires Spanish STT for math open-ended items. Chrome's on-device language
  list includes Spanish; per-platform verification is needed before committing.
- **Does TipTap/ProseMirror honor an untrusted `beforeinput`?** Step 1 above. Everything else in the
  contract shape is contingent on it.
- **Program tier and item scope.** Confirm the program treats STT as accommodation-tier, and get the
  item-scope rule from assessment product. Which items may be dictated is a construct-validity
  decision — dictation on an item measuring transcription measures something else — and it is not an
  engineering call.
- **Where the microphone lives.** Cambium puts it in the response-area toolbar. PIE's response-area
  toolbar belongs to the element, so PIE's version sits in the item toolbar unless that ownership
  moves. Choosing the element's toolbar would put an accommodation affordance inside an element, which
  the architecture has consistently refused; choosing the item toolbar separates the control from the
  surface it acts on. Neither is free.
