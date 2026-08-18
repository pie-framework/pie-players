---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-tool-sign-language": patch
---

Deliver timed-media sections: cues that reveal and gate questions against a media
timeline.

A section that sets `sectionType: "timed-media"` carries a `timedMedia` block with
a required `stimulusRef`, a cue timeline and a playback policy. The stimulus is a
passage — a `class: "stimulus"` rubric block whose PIE config mounts the media
element — so media keeps a Catalog Owner and its captions, transcript and signed
alternates resolve through the accessibility-catalog rail that already serves them.
`timedMedia` carries no media payload at all.

The section reaches media only through a **Media Time Source** port shaped after
`HTMLMediaElement`, never through a library API. `createMediaElementTimeSource`
adapts a native `<video>`/`<audio>` in a few lines, and a host can register its own
implementation for a third-party player through the same `pie-media-time-source`
event the stimulus card uses — so delivering timed media needs no PIE element. The
port declares `canPause` and `canRestrictSeeking`; where a capability is missing the
matching policy degrades from enforced to **advisory** — cues still fire, state is
still recorded, the projection reports `enforcement: "advisory"`, and a recoverable
framework warning of kind `timed-media` says which policy lost its teeth. A seek
lock that does not lock must not read as one that does.

Cue gate conditions name the shipped formative vocabulary rather than defining
their own: `responded` (which reads item completion, so it works in a section that
does not deliver formatively), `correct`, and `partial-or-better`. A gate on
correctness must state `onUnknownCorrectness`, because an item no controller can
score is a real state and neither answer may be assumed. Three authoring mistakes
are refused loudly rather than delivered silently: a `stimulusRef` that resolves to
nothing; a correctness gate over an item without unlimited Tries, where a learner
who spent a finite budget could never release playback again; and a `stimulusRef`
that resolves to a renderable exposing no time source, which is reported once the
section's content has loaded and no source has attached — whether a renderable
mounts media is not knowable from authored data, so that half of the rule is a
runtime report rather than a validation error. All three deliver the section with
every item visible; a cue timeline nothing can drive would otherwise leave a pane of
questions no cue can ever reveal.

New public surface: `@pie-players/pie-players-shared/timed-media` (data types, the
port, validation, the cue reduction, the session slice and the native adapter),
`sectionType` / `timedMedia` on `AssessmentSection`, `timedMedia` on the section
composition model and on the persisted session snapshot,
`attachMediaTimeSource` / `detachMediaTimeSource` / `getTimedMediaProjection` on
`SectionControllerHandle` (`attachMediaTimeSource` takes an optional
`renderableId`, checked against the renderable `stimulusRef` resolved to so a
second video passage cannot drive the timeline), `pauseMediaForCompetingAudio` on
the same handle, and four controller events — `timed-media-cue-changed`,
`timed-media-audio-started`, `timed-media-policy-degraded`, `timed-media-invalid`.
A host switching exhaustively over `SectionControllerEvent["type"]` with no
`default` gains four variants; everything else is optional and absent reads as
`null`.

Cue state joins the toolkit's composition revision key, without the clock: a cue
firing changes neither the renderables nor the item sessions, so the emit would be
coalesced away and no card would ever see it — while folding media position in
would republish four times a second for a change nothing renders.

Read-aloud and media audio never overlap, on a last-action-wins rule: starting
read-aloud pauses the media, starting media pauses read-aloud, and neither side
resumes what it silenced. The section supplies the two halves it can — the
`pauseMediaForCompetingAudio()` method and the `timed-media-audio-started` event —
and the toolkit arbitrates, because only the toolkit holds both the TTS service and
the section. A port reporting `canPause: false` cannot yield and read-aloud proceeds
over it: withholding an accommodation to protect a policy the port already said it
cannot keep is the worse failure, and that gap is already reported at attach. Media
carrying no audio still pauses read-aloud, because no portable signal distinguishes
a silent track from a narrated one.

That rule already existed for the signing region, and now has one statement instead
of two: `bindTtsAudioHandoff` and `pauseTtsForMediaAudio` are exported from
`@pie-players/pie-assessment-toolkit`, and `@pie-players/pie-tool-sign-language`
binds them in place of its own copy. Signing behavior is unchanged — the states that
count as speaking, the pause-not-stop rule, and the tolerance for a torn-down
service are the same, and now carry unit coverage neither call site had.

Two things outside timed media change. The section content service now records how
a `stimulusRef` resolves to a rendered renderable, rather than leaving each caller
to re-derive it. And the engine's controller subscription isolates the new
`onControllerEvent` handler it routes events through, so a diagnostic that throws
cannot abort the listener before the composition republish and stop every
controller event in the section behind a console warning. That guard is hardening
around the new route, not a fix for a defect on `develop`: before this the
subscription took no event and only republished.

Existing content is untouched: no `sectionType` means no projection, no session
slice and no cue behavior, and cue-gated cards are the only cards that ever carry
`hidden`.
