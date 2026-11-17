# Non-Embedded Dictation

Platform dictation into a PIE response surface is a supported accommodation, and
[`packages/item-player/tests/item-player-dictation.spec.ts`](../../packages/item-player/tests/item-player-dictation.spec.ts)
is what keeps it that way. This page is for host integrators: it states what the
spec verifies, where a dictated response commits, and what the host must do.

State assessment programs split speech-to-text into two forms. **Embedded** means
the test delivery system supplies the recognizer; PIE has none, and
[`../prds/speech-to-text.md`](../prds/speech-to-text.md) scopes it. **Non-embedded**
means the learner's own platform does it — ChromeOS Dictation, Windows Voice
Access, macOS Dictation, Dragon — and PIE delivers that form today by not
obstructing it. State programs classify both as accommodations requiring an IEP
or 504 plan. PIE's part in the non-embedded one is entirely negative: the
platform writes into the focused editable, the response editor's input pipeline
runs, and the element commits its own session.

Nothing here is a PIE feature: the spec asserts properties that must not regress.

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

## Commit Boundary

**A constructed response commits to the session when the editor loses focus.**
Nothing commits while the editor holds focus; the spec asserts this for inserted
text two seconds after input.

A host that snapshots session state on a timer therefore captures nothing while
the learner is still in the editor, so autosave is driven by the
`session-changed` stream. A listener on `<pie-item-player>` receives the
player's canonical `session-changed`, which bubbles and is composed:
`detail.session` carries the response, or `session: null` with
`intent: "metadata-only"` for a change to metadata such as `complete` alone. The
player projects the response onto `pie-item-player.session` before it
dispatches, so the property is current inside the handler. The element's own raw
`session-changed` stops inside the player. [Session
management](../item-player/overview.md#session-management) has the full event
contract.

The spec asserts the pre-blur state deliberately: a debounce would change
constructed-response persistence, and the failing test is its signal. The player
commits each element's pending session at a `config` change, a page hide and its
own teardown ([Session commit](../item-player/overview.md#session-commit)), so a
response the editor committed on blur reaches the host while its notification is
still deferred.
Text in an editor that still has focus when its element is torn down is not in the
session, so it survives only if the editor blurs first.

## Host Responsibilities

- Permit platform dictation in whatever secure-browser or kiosk posture the program
  ships. This is the gating question for the accommodation, and PIE cannot answer
  it.
- Verify the learner's dictation tool processes audio on-device. Test-delivery
  guidance for the non-embedded path is that cloud processing be disabled before
  use so student audio does not reach third parties; the same applies here.
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
