# Speech To Text (Dictation)

Status: Draft

Owner: PIE Players maintainers

Jira: [PIE-473](https://illuminate.atlassian.net/browse/PIE-473) Speech to Text (STT), under
[PIE-500](https://illuminate.atlassian.net/browse/PIE-500) PIE Tools and Accommodations Master List.

Related architecture:

- [What Counts As A Tool](../tools-and-accomodations/architecture.md#what-counts-as-a-tool) — the
  eligibility / content-dependency / placement split this PRD applies to an input-side capability
- [Capability Ownership Layers](../tools-and-accomodations/architecture.md#capability-ownership-layers) —
  why this capability ships as its own package and stays out of the packaged registry
- [PIE Element Integration](../tools-and-accomodations/architecture.md#pie-element-integration) — the
  data-attribute contract the dictation target extends
- [Sign Language (ASL) Support](./sign-language-asl-support.md) and
  [Audio Accommodations](./audio-accommodations.md) — the two shipped accommodations whose shape this
  one deliberately breaks from
- [Non-Embedded Dictation](../tools-and-accomodations/non-embedded-dictation.md) — the guarantee from
  [Rollout](#rollout-and-release-notes) step 2, landed: what platform dictation into a PIE response
  surface is verified to do, and the blur commit boundary it exposed
- [SchoolCity Tool Parity Report](../tools-and-accomodations/schoolcity-tool-parity-report.md) — the
  row that produced this ticket

## Problem

Every accommodation PIE ships is a **presentation** accommodation. Signing, transcript, read-aloud,
line reader, colour scheme, answer eliminator: PIE resolves an alternate representation of authored
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
   microphone affordance anywhere in `pie-players`. The parity report's classification — response
   editor / host service, Missing — is accurate.
3. **PIE already has one input-side accommodation, and it is invisible to policy.**
   `spellCheckEnabled` is an authored model field on `extended-text-entry` and friends, passed
   straight to the delivery editor's `spellCheck` attribute. No support id is consulted, so district,
   test-administration, item, and student precedence cannot reach it and the PNP debugger cannot show
   it. That is the same defect shape as the `.rli-with-audio-transcript` class the
   [audio PRD](./audio-accommodations.md) replaced. Dictation must not be built the same way, and
   spell check should follow it out (see [Non-Goals](#non-goals)).

There is also a capability PIE has **for free** and could lose without noticing. Platform dictation —
ChromeOS Dictation, Windows Voice Access, macOS Dictation, Dragon — writes into the focused editable
as if typed, so it already flows through the editor's input pipeline and the element's change
handler. That is what state programs call *non-embedded* speech-to-text, and it is what Learnosity
relies on. It is currently untested and undocumented in this repo, which makes it an accommodation
held by accident.

## Comparables

### QTI 3 And AfA PNP 3.0: No Term Exists

The [AfA PNP 3.0 information model](http://www.imsglobal.org/spec/afa/v3p0/info) enumerates the
learner-needs vocabulary QTI 3 consumes. Its on-screen tool attributes cover writing support
generously — `spell-checker-on-screen`, `homophone-checker-on-screen`, `thesaurus-on-screen`,
`dictionary-on-screen`, `glossary-on-screen`, `outliner-on-screen`, `visual-organizer-on-screen`,
`note-taking-on-screen`, `calculator-on-screen` — and contains **no term for speech-to-text,
dictation, voice input, or scribe**. The
[QTI 3.0 profile checklist](http://www.imsglobal.org/spec/afa/v3p0/qti_profile) confirms the same
absence on the QTI side.

The only input-side hooks are `input-requirements` (`fullKeyboardControl`, full-mouse-control) and
`at-interoperable` — both statements about compatibility with the learner's **own** assistive
technology, not a feature the delivery system provides. QTI 3 catalogs are alternate
*representations* of content, so there is structurally nowhere to put an input method: a catalog card
answers "what else can this content look like", and dictation is not a form of content. QTI 3.0
(May 2022) remains current; there is no 3.1.

Two consequences. A `speechToText` support id is a **PIE extension with no standards counterpart**,
and must be presented as one rather than as an AfA support. And the omission is dictation
specifically, not input-side tools generally — `spell-checker-on-screen` establishes that an
on-screen writing support is a legitimate PNP member, so the extension is consistent with the
vocabulary's grain rather than against it.

### Learnosity: Stay Out Of The Platform's Way

Learnosity ships no dictation feature. Its advertised accessibility set is presentation plus
tooling — colour contrast, keyboard control, screen-reader support, accessible math with a spoken
math engine, captions, line reader — and its statement of scope is that it works with "system-level
screen-readers, braille displays, and keyboard helpers behind the scenes" alongside configurable
in-built options. Its VPAT covers question types and the assessment player, not an input
accommodation.

Its voice-related question type, `audio` (audio recorder), captures a recording *as* the response and
does not transcribe. That is voice-as-response, which is
[PIE-489](https://illuminate.atlassian.net/browse/PIE-489) Alternative Input Methods, not this
ticket — a distinction the parity report already draws and this PRD keeps.

So Learnosity's answer to STT is the non-embedded one: the platform's AT does it, and the player is
built not to obstruct it. That is a real position, cheaply available to PIE, and it is why the
non-embedded guarantee below is the first deliverable rather than a footnote.

### Cambium TDS: The Embedded Reference

Cambium's Test Delivery System — the delivery engine behind Smarter Balanced and many state
programs, and SchoolCity's closest comparable — is the one benchmark that ships embedded dictation.
Its student-facing model, from the
[TDS Speech-to-Text/Dictation guide](https://test-guides.cambiumast.com/TDS_Proctor/Oregon/Content/7-OverviewoftheStudentTestingSite/STTTool.htm),
is worth adopting nearly unchanged:

- Microphone button in the toolbar **of the item response area**, for students whose profile grants it.
- Selecting it starts dictation; selecting it again stops. It also stops automatically after a period
  of no sound.
- Five minutes of dictation per session. A new session **appends** to the text already there.
- Transcription appears in the response area as the student speaks, with a progress indication during
  the lag.
- Punctuation may be applied automatically, and spoken commands ("New Paragraph") control some of it.
  Accuracy, grammar, and punctuation remain the student's responsibility.
- Formatting-toolbar buttons are **disabled while dictation is on**, and the student **cannot
  navigate away from the test page** while it is on.
- It serves text-response items **and note-taking**.

### Smarter Balanced UAAG: Tier And Scope

The [Usability, Accessibility, and Accommodations Guidelines](https://portal.smarterbalanced.org/hubfs/usability-accessibility-and-accommodations-guidelines.pdf)
(June 30, 2026) classify speech-to-text, English and Spanish, as an **accommodation** — the tier
requiring documentation in an IEP or 504 plan, with one exception for a recent physical injury — in
both embedded and non-embedded forms. Embedded STT is scoped to ELA and math open-ended items and ELA
performance-task full writes; Spanish to math open-ended items.

Two requirements in that entry are design constraints rather than policy colour. A student using STT
must be able to **develop planning notes by STT**, and must be able to **see what they produce while
composing**. The first says dictation is not a property of the essay box; the second is a layout
constraint on the affordance.

### Privacy: The Constraint That Picks The Provider

Cambium's guidance for the *non-embedded* path is explicit about cloud recognition:

> "Many STT providers send a student's audio recording to the cloud for processing. This should be
> disabled before use so sensitive testing data is not sent to third parties."

An embedded implementation inherits that requirement rather than escaping it. On-device recognition
is therefore the default and remote recognition is the exception a host opts into, not the reverse.

### Browser Reality

From MDN's browser-compat data for `SpeechRecognition`, and the
[on-device explainer](https://github.com/WebAudio/web-speech-api/blob/main/explainers/on-device-speech-recognition.md):

| Surface | Support |
| --- | --- |
| `SpeechRecognition` (unprefixed) | Chrome 139, Edge mirrors, Safari 14.1 as `webkitSpeechRecognition`, Firefox 142 behind a flag |
| `processLocally`, `SpeechRecognition.available()`, `install()` | **Chrome 139+ only** — not Firefox, not Safari, not Chrome Android |
| `continuous` | Chrome 33, Safari 17 — **false on Chrome Android** |
| `phrases` (contextual biasing) | Chrome 142 |
| `unspokenPunctuation` | Chrome 151 |

Chrome's default path is server-based: audio goes to a Google service. `processLocally = true` is what
makes the guarantee that "neither audio nor transcriptions leave the user's device", at the cost of a
per-language model download (~60MB) through `install()`, across roughly 17 Chrome languages. The
Intent to Ship targeted desktop Windows, macOS, and Linux first, with ChromeOS later and Android
excluded.

**ChromeOS is therefore the question that decides feasibility**, because Chromebooks are the primary
K-12 testing device and Chrome Android is excluded outright. It is in
[Open Questions](#open-questions), to be answered by testing a managed Chromebook rather than by
reading release notes.

Safari exposes the prefixed API and no `processLocally`, so locality cannot be *asserted* there —
which is why the provider interface below reports locality rather than assuming it.

## Goals

- Keep non-embedded dictation working, deliberately: document that platform dictation into a PIE
  response surface is supported, and test it, so the accommodation PIE holds by accident becomes one
  it holds on purpose.
- Give dictation a policy identity, so eligibility resolves through the existing six-level precedence
  and appears in the PNP debugger — including item-level restriction, which matters more here than for
  any presentation accommodation.
- Define the insertion contract: how a transcript reaches a response without the player mutating
  element DOM or writing element session state.
- Keep the recognizer swappable behind one capability — on-device Web Speech, platform AT, host
  service — with locality declared and enforced rather than assumed.
- Make dictation target any declared editable surface rather than "the essay box", so notes
  ([PIE-470](https://illuminate.atlassian.net/browse/PIE-470)) inherit it when they ship.

## Non-Goals

- **Voice as the response.** Audio recording, storage, and playback as the scored artifact is
  [PIE-489](https://illuminate.atlassian.net/browse/PIE-489) and Learnosity's `audio` question type.
  Different feature, different scoring, different retention. Named here to fence it out.
- **Human scribe.** A designated-support/accommodation delivered by a person, with no runtime surface.
- **Spell check.** [PIE-495](https://illuminate.atlassian.net/browse/PIE-495) is the same layer and
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
  live. That is progression control and belongs to section-player beside the timed-media gate. Named
  because the reference implementation has it and someone will ask.

## Package And Export Ownership

- Owning package: a new `@pie-players/*` capability package, `pie-tool-speech-to-text`, for the
  registration, the `DictationProvider` interface and its Web Speech implementation, and the
  microphone element.
- `@pie-players/pie-assessment-toolkit` gains only the generic seam — the `speechToText` entry in the
  support vocabulary and whatever `ToolContext` needs so a predicate can see the scope element. No
  capability id in core; `bun run check:capability-neutrality` is the enforcement.
- Public export path: package root for the registration and provider types, matching
  `pie-tool-sign-language`.
- Composition: **deliberately absent from `createPackagedToolRegistry()` and from
  `UNIVERSAL_SUPPORTS_PRESET`.** Accommodation-tier, device-dependent, and requiring a cross-repo
  content declaration — the same three reasons signing is opt-in. A deployment installs and registers
  it as it would one of its own.
- Consuming packages or apps: section-player (item-level toolbar), PNP debugger, `section-demos`.
- Runtime environment: browser, secure context, microphone permission.
- Outside this repo: `pie-elements-ng` declares dictation targets on its response surfaces. That is
  the gating dependency — without it there is nothing to dictate into.

## Contract Shape

### Support Id

`speechToText`, added to `packages/assessment-toolkit/src/services/pnp-standard-features.ts` under
`motor`, with a comment recording that it has **no AfA PNP 3.0 or QTI 3 counterpart** and is a PIE
extension.

It is specifically **not** `voiceControl`, which already exists in that file's `motor` group.
`voiceControl` is schema.org's `accessibilityControl` sense — operating the interface by voice — and a
learner who needs to dictate an essay and a learner who needs to drive the UI by voice are different
populations with different grants. Conflating them would make one grant deliver the other.

### Dictation Target: The Element's Half

The element declares which of its surfaces accept dictated text, extending the existing
data-attribute contract that `data-highlightable`, `data-readable`, and `data-eliminatable` already
use:

```html
<div
  data-dictation-target="response"
  data-dictation-insert="beforeinput"
  contenteditable="true"
  role="textbox"
  aria-label="Your response"
></div>
```

Presence is the resource-side declaration — the DRD half of the AfA pair, arrived at from the
rendered element rather than from a catalog card, because the resource here is an input surface and
not authored content. Absence means the capability declines at this item, which is what keeps a
learner with the accommodation from meeting a dead microphone on a multiple-choice item.

### Insertion: Synthesized Input, Not DOM Mutation

The tool inserts by dispatching an `InputEvent` with `inputType: "insertText"` at the current
selection — `beforeinput`, then `input` — so the surface's own editor pipeline runs the change as a
transaction and the element's `onChange` fires normally. This is synthesizing **input**, not editing
the DOM, and that distinction is what keeps `Zero DOM Mutation` intact: the player never touches the
element's tree, and the element's document model stays the single source of truth for the response.

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

`custom-event` is not only a fallback: it is the mode for response surfaces that are not standard
editables — `math-inline`, `drawing-response`, `explicit-constructed-response` — where "insert at the
caret" has no generic meaning and only the element knows what dictated text should do.

### Registration

```ts
export const speechToTextRegistration: ToolRegistration = {
  toolId: "speechToText",
  name: "Speech to Text",
  description: "Dictate a response instead of typing it",
  icon: "microphone",

  // Item level only. A section has no response surface, and dictation targets one.
  supportedLevels: ["item"],

  pnpSupportIds: ["speechToText"],

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

One core addition this needs, and it is a real one: `isVisibleInContext` receives a model-based
`ToolContext`, and a dictation-target check is a DOM-presence question. The alternative — answering it
from the model by listing which element types accept dictated text — puts a list of element type
names in core, which is the smell `check:capability-neutrality` exists to prevent and which
`hasChoiceInteraction` already carries. Recommended: give `ToolContext` the scope element and let the
predicate query it, accepting that the affordance can appear one frame after the element renders.
Catalog observation already tolerates exactly that.

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

**No silent fallback to remote recognition.** `requireOnDevice` defaults to `true` and a provider that
cannot assert on-device processing refuses to start, surfacing a recoverable framework warning rather
than quietly sending student audio to a vendor. This is the one piece of provider security the
framework enforces itself, the same role `assetOrigins` plays for server-backed TTS; everything else —
which languages are provisioned, whether a remote provider is acceptable, what the fleet's managed
policy is — is the host's.

### Behavior

Adopted from Cambium, with the ownership boundaries PIE actually has:

- One microphone control per item, in the item toolbar, dictating into the **focused** dictation
  target. Not one control per field: that is what lets notes inherit dictation without the capability
  knowing notes exist.
- Interim results render in place and are visibly provisional; final results commit.
- Append, never replace. A second session continues the response rather than restarting it.
- Auto-stop on silence, and a session cap. Both configurable, defaults matching the reference.
- **Formatting controls during dictation are the element's call.** Cambium disables its formatting
  toolbar while the microphone is live; PIE's response-area toolbar belongs to the element, so the
  tool can only publish dictation state and let the element decide. Recorded as a limitation, not
  designed around.

## Compatibility

This PRD touches:

- **Contract attributes.** Adds `data-dictation-target` and `data-dictation-insert`, authored in
  `pie-elements-ng`, read by the toolkit. Additive; absence is a valid state meaning "no dictation
  here".
- **PIE element runtime contracts.** Response-bearing elements gain a target declaration and, for
  `custom-event` mode, a handler. No model field changes, and no element learns anything about
  policy — the element declares a capability of its surface, not an accommodation.
- **The support vocabulary.** One new id in `pnp-standard-features.ts`. Additive.
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
session, deliberately — a response is a response, and flagging its input method in the response
invites scoring bias against the students the accommodation exists for.

A program that needs to know dictation was used wants a **process record**, not a session field:
[evidence capture metadata](./shared-contracts/evidence-capture-metadata.md) and the
[interaction event contract](./shared-contracts/interaction-event-contract.md) are where that belongs.
Stated because it will be asked for, and because answering it in the session would be the easy wrong
move.

## Accessibility

- Insertion happens at the caret and must not move focus. A dictating learner who loses their caret
  position has lost the accommodation.
- Recording state is announced through a live region. Interim results are **not** announced — partial
  results fire continuously and would flood a screen reader — so only state changes and final commits
  are.
- Stopping must not require typing. Silence auto-stop is therefore an accessibility mechanism rather
  than a convenience: for a learner dictating because they cannot use a keyboard, it is the reliable
  stop.
- The affordance must not cover the response area, per the UAAG requirement that a student can see
  what they produce while composing.
- Microphone permission state needs a visible, non-modal explanation when denied. A silent no-op
  reads as a broken accommodation.
- WCAG 2.2 AA: the affordance introduces no new failure. Worth stating the other direction too —
  dictation is *how* some learners satisfy the motor-input expectations, which is why the tier
  question below is a construct decision rather than a compliance one.

## Standards Or Adapter Impact

No QTI or AfA conformance claim is available, because no term exists to map to. A QTI adapter carries
`speechToText` as a vendor extension, and PIE must not present it as an AfA support id in
documentation, the debugger, or a PNP export.

The terms a PNP importer should read are `input-requirements` and `at-interoperable`: a profile
asserting either is describing a learner who brings their own AT, which is the non-embedded path and
needs no PIE feature — only PIE not obstructing it.

## Test Plan

- **The non-embedded guarantee.** An e2e that drives a PIE response surface with
  platform-dictation-shaped input (composition and `beforeinput` sequences, not synthetic
  `keydown`) and asserts the element's session value updates. This is the test that protects the
  accommodation PIE already has, and it is worth landing before any of the rest.
- Insertion-contract fixtures per declared mode, including a `custom-event` target that applies text
  itself.
- Policy precedence, including `item-restriction` denying dictation on an item whose construct is
  transcription or spelling — the case the UAAG scoping rule exists for.
- Locality enforcement: the provider refuses to start when `requireOnDevice` is set and locality is
  `"remote"` or `"unknown"`, and reports a recoverable warning rather than failing the section.
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

- Changeset required: yes — minor for the core seam, and for the new package when it lands.
- Sequencing, in dependency order rather than value order:
  1. **Prototype the insertion path** against `extended-text-entry`'s TipTap editor. Whether
     ProseMirror honors an untrusted `beforeinput` decides which mode is the default and how much of
     the rest is even buildable.
  2. **Land the non-embedded guarantee** — the doc statement plus the e2e above. Independently
     shippable, cheap, and it converts an accidental accommodation into a supported one. **Done:**
     [`non-embedded-dictation.md`](../tools-and-accomodations/non-embedded-dictation.md) and
     `packages/item-player/tests/item-player-dictation.spec.ts`. It also established the commit
     boundary the rest of this PRD has to design around — a constructed response reaches the session
     on blur and not before, so a dictation affordance that keeps focus in the editor keeps the
     response out of the session for as long as it runs
     ([PIE-916](https://illuminate.atlassian.net/browse/PIE-916)).
  3. **Support id and policy identity**, so eligibility is auditable before any recognizer exists.
  4. **The capability package**, behind the on-device Web Speech provider only.
  5. **A remote provider**, only if a program needs a language on-device recognition does not cover on
     the platforms the program ships.
- Release risk: low through step 3, then gated on the ChromeOS answer below. Steps 4 and 5 should not
  start until it is known.
- Documentation updates: this PRD, the parity report row, and a section in
  `docs/tools-and-accomodations/` on the non-embedded guarantee once step 2 lands.

## Open Questions

- **On-device Web Speech on ChromeOS: available, and in which languages?** Chrome Android is excluded
  outright and ChromeOS shipped after desktop. If the answer is no, embedded dictation is
  undeliverable on the primary K-12 device and the non-embedded path is the whole answer. Test a
  managed Chromebook; do not infer this from release notes.
- **Language-pack provisioning on a managed fleet.** ~60MB per language through `install()`. Is that
  an admin-pushed artifact or a per-device download, and what happens when a student triggers it
  mid-assessment on school wifi?
- **Does Renaissance's secure-browser posture permit the microphone, and separately, permit OS
  dictation?** These are independent answers with opposite consequences: if OS dictation is permitted,
  most of the need is already met at near-zero cost.
- **Spanish.** The UAAG requires Spanish STT for math open-ended items. Chrome's on-device language
  list includes Spanish; per-platform verification is needed before committing.
- **Does TipTap/ProseMirror honor an untrusted `beforeinput`?** Step 1 above. Everything else in the
  contract shape is contingent on it.
- **Program tier and item scope.** Confirm Renaissance treats STT as accommodation-tier, and get the
  item-scope rule from assessment product. Which items may be dictated is a construct-validity
  decision — dictation on an item measuring transcription measures something else — and it is not an
  engineering call.
- **Where the microphone lives.** Cambium puts it in the response-area toolbar. PIE's response-area
  toolbar belongs to the element, so PIE's version sits in the item toolbar unless that ownership
  moves. Choosing the element's toolbar would put an accommodation affordance inside an element, which
  the architecture has consistently refused; choosing the item toolbar separates the control from the
  surface it acts on. Neither is free.
