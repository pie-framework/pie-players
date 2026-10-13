# 0004 — Screen-reader use is a profile support that withholds read-aloud

Status: Accepted, 2026-10-12

Owner: PIE Players maintainers

Read with: [ADR 0003](./0003-elements-read-accessibility-settings-from-a-host-neutral-context.md),
whose one-id-per-value route and math review this record keeps.

## Decision

A student's screen-reader use reaches PIE only from the student's profile, as the support id
`screenReader`. PIE never detects assistive technology.

- **Ids.** `screenReader` is AfA PNP 3.0 `spoken` with `reading-type` `screen-reader`, the value AfA
  assumes when `reading-type` is absent. `textToSpeech` is `spoken` with `reading-type`
  `computer-read-aloud`. This is the one-id-per-value route ADR 0003's **Trade-off** names, so the
  context value keeps its type. Autoplay of item audio is the feature `autoplayAudio`, a PIE id,
  since AfA has no autoplay term.
- **Resolution.** `screenReader` and `autoplayAudio` resolve through the eight-level precedence
  like every support id. No tool carries either: the student's own screen reader does the speaking,
  and autoplay is a setting on the item's models. The toolkit recognizes both without a
  registration, and a profile listing `screenReader` raises no `tool-policy.unknownSupportId`.
- **Conflict.** While `screenReader` resolves enabled, `textToSpeech` and `autoplayAudio` resolve
  blocked at precedence 4, the profile-prohibition level, under a rule of their own,
  `support-conflict`. A placement, a `true` test-administration override, an item or district
  requirement and a profile support all lose to it. A district block, a `false` override and an
  item restriction rank above it and keep the block they already make. Every read-aloud entry point
  follows the decision, the annotation toolbar's selection read-aloud included, which offers itself
  only while `canRequestTool("textToSpeech")` answers yes.
- **Self-starting audio.** A block of `autoplayAudio` holds an item's audio until the student
  starts it. It reaches an element only where that element keeps the audio playable without
  autoplay: a keyboard-operable play control, and an audio-completion requirement that playing the
  audio meets. An element version without both keeps its authored autoplay for every student, as
  today. The hold applies before the item first renders, since elements read autoplay at mount, and
  outranks the `autoplay-audio-enabled` attribute set to `true`. The channel that carries the
  decision to elements is an open question of the
  [Audio Accommodations PRD](../prds/audio-accommodations.md#open-questions).
- **Markup.** Nothing rendered depends on `screenReader`. Hidden MathML, math control names and the
  rest of the accessibility tree are the same for every student, and ADR 0003's math review stands:
  no math mode derives from the `screen-reader` reading type. The id changes only what makes sound.
- **Reporting.** Each withdrawal raises `tool-policy.supportConflict`, naming `screenReader`, the
  withheld id and what would otherwise have served it: for `textToSpeech` the placement or the
  granting rule, for `autoplayAudio` the granting rule, the attribute set to `true` or an authored
  `true`. It replaces `tool-policy.overrideBlocked` for an override the conflict withdraws, so one
  withdrawal raises one diagnostic. An id that nothing would have served raises none, so an item
  without self-starting audio reports nothing.

## Constraint

A screen reader runs outside the page, and PIE can neither see nor control it. Whatever sound PIE
makes, read-aloud or audio an item starts on its own, talks over the screen reader's speech of the
same page. The screen reader is the channel the student cannot do without, since it also carries
navigation and braille. Coordination therefore comes from what PIE is told about the student, and it
withdraws PIE's channel.

## Supporting reasons

- **AfA PNP 3.0** models both as one preference, `spoken`, whose `reading-type` takes one value and
  defaults to `screen-reader` ([AfA PNP 3.0](https://www.imsglobal.org/spec/afa/v3p0/info)).
- **WCAG 2.2 SC 1.4.2 Audio Control** (Level A) requires a way to pause or stop audio that plays
  automatically for more than three seconds. Its Understanding text names screen-reader users as
  the people that audio drowns out and prefers audio the user starts
  ([Understanding 1.4.2](https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html)).
- **Assessment platforms** keep the two apart. Pearson states that its text-to-speech is not
  intended for students who are blind or visually impaired
  ([accommodations list](https://support.assessment.pearson.com/as/accommodations-list-160038937.html))
  and resolves competing accommodations by a form hierarchy
  ([form hierarchy](https://support.assessment.pearson.com/as/client-settings%3A-accommodations-form-hierarchy-161185876.html)).
  NWEA delivers screen-reader users a separate screen-reader-compatible test
  ([visual impairments](https://connection.nwea.org/articles/Knowledge/Testing-students-with-visual-impairments-in-MAP-Growth))
  and offers text-to-speech to sighted students
  ([assigning text to speech](https://connection.nwea.org/articles/Knowledge/How-to-assign-text-to-speech-to-a-student)).
  CAASPP delivery takes screen-reader use as a student setting made before testing
  ([assistive technology](https://ca-toms-help.ets.org/accessibility-guide/configuring-resources/integration-with-assistive-tech)).
- **Precedence 4** is where a support is withdrawn for a reason about the student. The conflict is
  such a reason, so it ranks with the profile's own prohibitions: above every grant, below the
  blocks that withdraw either id for reasons of their own.
- **Autoplay as a feature** puts the hold on the precedence every support uses: the conflict is one
  rule against two ids, and a district, a test administration, an item or a profile that sets
  autoplay takes the same route.
- **The precondition** follows from elements in delivery. A listening prompt can be an `<audio>`
  without controls that an image link plays, and the shared prompt renderer replaces that audio's
  id, so the link plays nothing; an item that requires audio completion then never completes.
  Autoplay is that audio's only working start, and holding it would cost the student the prompt and
  the item.
- **A diagnostic for the conflict alone.** A prohibition that outranks a requirement raises none,
  because a person recorded it. The conflict is a rule PIE applies against what a person set, an
  assigned support or authored autoplay, so the host needs to report what was not delivered, and
  why.

## Rejected alternatives

- **Detecting a screen reader.** No signal reliably reports one, and the W3C TAG directs that a page
  not learn that assistive technology is in use
  ([§2.11](https://w3ctag.github.io/design-principles/#do-not-expose-use-of-assistive-tech)). An
  inferred support is one no person assigned.
- **A separate rendering for screen-reader students**, as NWEA's separate test is. PIE's markup
  already serves both channels: the screen reader reads the hidden MathML and control names, and
  read-aloud voices the same MathML. A second rendering is a form to author and keep equivalent
  that serves no student the first one misses.
- **The conflict as data in each host**, a host listing `textToSpeech` in `prohibitedSupports` for a
  screen-reader student. Every host would carry the rule, and the decision trail would credit the
  profile with a prohibition no person made.
- **A grant of `textToSpeech` outranking the conflict.** An assessment that places read-aloud for
  every student, as early-grade assessments do, would then give it to screen-reader students too,
  and assigning both is the competing assignment platforms direct against.
- **A screen-reader flag from the toolkit to the item player**, which would hold autoplay itself.
  The one rule would take a second route, and an autoplay setting from a district or a profile
  would need a third.
- **The model override `autoplayAudioEnabled: false` on every element version**, the route the
  `autoplay-audio-enabled` attribute takes. Every element in delivery honors it, including the
  versions whose audio then has no working start.
- **Lifting the audio-completion requirement under the hold.** No item would block, but where the
  audio has no working start the student would never hear the prompt.
- **Elements reading `screenReader` from the ADR 0003 context** to hold their own audio. Each
  element version would freeze the conflict rule into itself, which ADR 0003's **Constraint** rules
  out.
- **A `spoken: { readingType }` field on the context value.** ADR 0003 rejects a field per consumer:
  an id per value changes no type.

## Trade-off

A deliberate trade: PIE needs no coordination with a speech engine it cannot see, at the cost of a
student who would pause a screen reader to use PIE's read-aloud and word highlighting losing both
while the profile lists `screenReader`. A profile without `screenReader` keeps read-aloud, and the
student's screen reader still reads the page.

The precondition is a second deliberate trade: no student loses access to an item's audio, at the
cost of a screen-reader student hearing autoplay over the screen reader on element versions that
do not meet it.

## Consequences

- No code ships with this record. The toolkit implementation recognizes `screenReader` in
  `PnpPolicySource` without a registration, evaluates `textToSpeech` and `autoplayAudio` whenever
  `screenReader` resolves enabled, including when no policy input names them, adds
  `support-conflict` to the decision rules and `tool-policy.supportConflict` to
  `ToolPolicyDiagnosticDetails`. Which rules besides the conflict set `autoplayAudio`, and how a
  host states them, is outside this record.
- The item player takes the toolkit's `autoplayAudio` decision for its item scope. Only it reads
  the attribute and the models, so it reports a withdrawal against the attribute set to `true` or an
  authored `true`. The pie-elements-ng elements with an authored `autoplayAudioEnabled` setting are
  categorize, drag-in-the-blank, ebsr, hotspot, image-cloze-association, mc-populated-blank and
  multiple-choice. Each needs a release that meets the precondition before a hold reaches it, and
  the first fix is the shared prompt renderer pointing an authored play link at the id it generates
  for the audio. The ADR 0003 context gains no consumer, so its provider still does not ship.
- The tool registry's AfA table maps `spoken` to `textToSpeech` only for `reading-type`
  `computer-read-aloud`
  ([Support ids](../../packages/assessment-toolkit/docs/TOOL_REGISTRY.md#support-ids)). A host that
  mapped `spoken` alone granted read-aloud to every student AfA presumes uses a screen reader.
- `data-tts-suppress="screen-reader"` stays the host's
  ([Suppressing Read-Aloud](../accessibility/accessibility-catalogs-integration-guide.md#suppressing-read-aloud)).
  Page markup withholds a node from assistive technology only through `aria-hidden`, which withholds
  it from braille as well as speech, so muting content for a screen reader is that screen reader's
  configuration. Texas permits only JAWS on its braille reading tests because JAWS can mute
  passages
  ([assistive technology for braille tests](https://txassessmentdocs.atlassian.net/wiki/spaces/ODCCM/pages/2793213313/Testing+with+Assistive+Technology+for+Braille+Tests)).
- AfA's `restriction-type`, with values such as `directions-only` and `skip-math-equations`, is not
  honored, so read-aloud of directions alone or with math skipped has no support id. It is a
  separate decision.
