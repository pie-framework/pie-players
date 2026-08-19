---
"@pie-players/pie-assessment-toolkit": patch
---

Keep a host-installed TTS highlight target resolver until its disposer runs, so
a resolver installed once keeps remapping.

`setHighlightTargetResolverProvider` returns a disposer, which says the caller
owns the registration, but the service also cleared the field in `stop()` and on
both exits of `restartFromSeekIndex`. A host that installs once — the
install-before-mount case a late-bound provider exists for — therefore got
remapping for exactly one playback and then fell back to identity for the rest of
the service's life, silently. `speak()`'s own end path never did this, so three of
four playback-termination paths disagreed with the fourth.

The disposer is now the only thing that clears it. Nothing in-repo depended on the
old behaviour: `tool-tts-inline` reinstalls per playback and disposes at every one
of its five termination paths. A stale provider cannot paint outside its scope
either, since targets are validated by containment in `context.scopeElement` and a
failing one falls back to its native range.
