# Non-Embedded Dictation

Platform dictation into a PIE response surface is a supported accommodation, and
[`packages/item-player/tests/item-player-dictation.spec.ts`](../../packages/item-player/tests/item-player-dictation.spec.ts)
is what keeps it that way.

State assessment programs split speech-to-text into two forms. **Embedded** means
the test delivery system supplies the recognizer; PIE has none, and
[`../prds/speech-to-text.md`](../prds/speech-to-text.md) scopes it. **Non-embedded**
means the learner's own platform does it — ChromeOS Dictation, Windows Voice
Access, macOS Dictation, Dragon — and PIE delivers that form today by not
obstructing it. Smarter Balanced classifies both as accommodations requiring an
IEP or 504 plan, and PIE's part in the non-embedded one is entirely negative: the
platform writes into the focused editable, the response editor's input pipeline
runs, and the element commits its own session.

That was true by construction rather than by design until PIE-473, which is why it
is now asserted. Nothing here is a PIE feature; it is a set of properties that must
not regress.

## Verified Behavior

Against the published `@pie-element/extended-text-entry@latest` (TipTap/ProseMirror
over `contenteditable`), in Chromium:

- **Inserted text reaches the session.** A trusted `beforeinput`/`input` pair with
  no key events — the shape the platform IME path produces, and what CDP
  `Input.insertText` and Playwright's `keyboard.insertText` generate — is handled
  the same as typing. An editor that only handled `keydown` would pass a typing
  test and fail dictation.
- **A composition commits.** macOS and ChromeOS dictation arrive as
  `compositionstart`/`compositionupdate`/`compositionend`. Interim text renders
  during the composition, and the commit replaces it rather than appending to it.
- **Insertion lands at the caret**, so a learner who repositions the caret to
  correct a mis-transcription overwrites in place instead of appending.
- **Successive bursts accumulate in order**, which is how dictation is actually
  used: speak, read, resume.
- **The response surface is a keyboard-reachable `contenteditable`.** OS dictation
  targets the focused element, so a response that cannot take focus without a
  pointer is unreachable for a learner who dictates for motor reasons.

## The Commit Boundary Is Blur

**A constructed response commits to the session when the editor loses focus, and
not before** — no commit while focused, verified to 20 seconds, for typed and
inserted text alike.

Two consequences, both host-facing:

- A host that snapshots session state on a timer captures nothing while the
  learner is still in the editor. Autosave has to be driven by the
  `session-changed` stream, not by a clock.
- The payload-carrying `session-changed` is dispatched on the element's inner
  wrapper and on `window`. A listener bound to `pie-item-player` receives an
  earlier `session-changed` that carries no `session`, so binding there and
  reading `detail.session` yields nothing. Read `pie-item-player.session`, or
  listen on `window`.

The spec asserts the pre-blur state deliberately. A debounce would be a change to
constructed-response persistence, and it should surface as a failing test here
rather than land unnoticed. Tracked as
[PIE-916](https://illuminate.atlassian.net/browse/PIE-916), which also carries the
unanswered half: whether unmounting an element or navigating a section away commits
an in-progress response before the editor is torn down.

## Host Responsibilities

- Permit platform dictation in whatever secure-browser or kiosk posture the program
  ships. This is the gating question for the accommodation, and PIE cannot answer
  it.
- Verify the learner's dictation tool processes audio on-device. Cambium's guidance
  for the non-embedded path is that cloud processing be disabled before use so
  student audio does not reach third parties; the same applies here.
- Do not intercept keystrokes or input events on the response surface, and do not
  re-render it on a timer. Either can break insertion or reset the caret.

## Scope

Nothing in this document covers an embedded recognizer, a microphone affordance, or
transcript quality. Dictation into surfaces other than
`extended-text-entry` is unverified — `explicit-constructed-response` and
`math-templated` carry their own response editors and are not covered by this spec.

```bash
bun run test:e2e:item-player:dictation
```
