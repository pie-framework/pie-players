---
"@pie-players/pie-assessment-player": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-section-player-tools-event-debugger": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-section-player-tools-session-debugger": patch
"@pie-players/pie-section-player-tools-shared": patch
"@pie-players/pie-theme": patch
"@pie-players/pie-tool-theme": patch
"@pie-players/pie-tool-line-reader": patch
"@pie-players/pie-tool-text-to-speech": patch
"@pie-players/tts-client-server": patch
"@pie-players/tts-server-core": patch
"@pie-players/tts-server-google": patch
"@pie-players/tts-server-polly": patch
"@pie-players/tts-server-sc": patch
---

A second full-codebase review turned up more drift, duplication, and interface
problems than the first sweep caught, concentrated in the TTS provider stack and
the debugger-tool family. No public surface changes; behaviour fixes are called
out explicitly.

**TTS rate and pitch.** Polly and Google both advertised `supportsRate` /
`supportsPitch` while never reading `request.rate` / `request.pitch` — a caller
asking for a different speech rate got normal-speed audio with no error.
`BaseTTSProvider.applyProsody` / `buildProsodyAttrs` now wrap plain-text requests
in an SSML `<prosody>` envelope on both providers; already-SSML input is left
alone. `pitch` follows this repo's existing 0-2 multiplier convention (the TTS
settings UI's `normalizePitch`), converted to SSML's relative percentage form.

**SchoolCity speech-mark timing.** `tts-client-server`'s custom-transport parser
reimplemented SchoolCity's JSONL wire format from scratch, with none of the
offset/time-unit corrections `SchoolCityServerProvider` applies — reproducing the
mistiming bug that correction was built to fix. `normalizeSpeechMarks` moves to
`tts-server-core` so both share one implementation.

**TTS error-mapping granularity.** Polly collapsed every AWS SDK error to
`PROVIDER_ERROR`; SchoolCity did the same for every HTTP failure. Both now map
to `TEXT_TOO_LONG` / `INVALID_REQUEST` / `RATE_LIMIT_EXCEEDED` /
`AUTHENTICATION_ERROR` where the underlying exception name or HTTP status
says so, matching the granularity Google already had. A documented consumer maps
these four `TTSErrorCode` members onto HTTP responses, so Polly's
`TextLengthExceededException` reaching `TEXT_TOO_LONG` is newly correct handling
on a path that previously always fell through to a generic error.

**Rate-to-speedRate bucketing.** `SchoolCityServerProvider` and
`ServerTTSProvider` each bucketed a numeric rate into `slow`/`medium`/`fast`
with different thresholds, disagreeing for rate 1.1-1.49.
`resolveSpeedRateBucket` in `tts-server-core` is now the one implementation,
on the server's deliberate 0.95-1.5 tolerance band.

**Shadow-DOM-blind theme lookup.** `tool-color-scheme`'s host lookup called
`closest('pie-theme')` from inside its own open shadow root, which
`Element.closest()` can never cross — on any page with more than one
independently-scoped `<pie-theme>` it silently always picked the wrong one.
`resolvePieThemeHost` in `pie-theme` walks out through each shadow root's host
to find the real ancestor. The same change adds `applyPieColorScheme` as the one
canonical "resolve host, set scheme, persist" sequence, replacing both
`tool-color-scheme`'s own copy and `apps/section-demos`' independently-drifted
version.

**Debugger-panel subscription lifecycle.** `EventPanel` and `SectionSessionPanel`
each reimplemented the same subscribe/detach/resubscribe scaffolding;
`SectionSessionPanel`'s read and wrote reactive state directly inside a tracked
`$effect` body instead of wrapping it in `untrack()`, and its lifecycle handler
always resubscribed instead of distinguishing the disposed and same-target cases
`EventPanel` already handled. `createSectionControllerSubscriptionManager` in
`section-player-tools-shared` is now shared by both. The same change wires
`persistence-scope` / `persistence-panel-id` through for `PnpPanel` and
`SectionSessionPanel`, which had neither despite `SharedFloatingPanel` supporting
layout persistence and two sibling debuggers already exposing it.

**Pointer-drag tracking.** `tool-line-reader` and `tool-text-to-speech` each
hand-rolled identical pointer-capture drag-position tracking.
`createPointerDragController` in `players-shared/ui` covers the shared position
math; `tool-line-reader`'s separate resize handling stays where it is.

**Custom-element registration.** `pie-print` bypassed its own package's guarded
registry and called Lit's `@customElement` decorator directly, which throws an
uncaught `NotSupportedError` on double-bundling where every other player
no-ops. It now goes through the same guard. `defineCustomElementSafely`
(players-shared) and print-player's registry also shared the same
duplicate-define handling with different collision coverage; consolidated into
one implementation, which incidentally fixes a latent bug where an
already-registered tag not tracked locally hit a doomed wrapped-subclass retry
instead of short-circuiting.

**Everything else.** `coerceBooleanLike` had three different, disagreeing
implementations across `section-player` and `assessment-player` for the same
attribute-coercion job; unified in `players-shared`. `sanitize-item-markup` and
`sanitize-svg-icon`'s DOMPurify forbid-lists had drifted despite a comment
claiming parity; now share one list. `AssessmentPlayerDefaultElement` swallowed
TTS teardown errors in empty catch blocks instead of reporting them through
`ToolkitCoordinator.reportFrameworkError`. `item-player`'s `"player-error"` event
now has an exported constant matching the pattern `section-player` and
`assessment-player` already use (no wire-value change).
