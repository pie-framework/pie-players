---
"@pie-players/tts-client-server": patch
---

Keep server-TTS word highlighting on the spoken word, and stop printing item
content to the console.

`startWordHighlighting`'s 50ms interval fired at most one boundary per tick: it
scanned for the first timing past the cursor whose time had arrived, called
`onWordBoundary`, and broke. Highlighting was therefore capped at 20 words per
second, so wherever timings fall closer together than 50ms — dense speech marks,
or a host raising `playbackRate` on the element — the highlight fell behind the
audio and never caught up. Read-aloud highlighting that drifts off the spoken
word is worse than none for the learners the accommodation exists for. The same
loop restarted from index 0 on every tick, walking the whole passage each time
until it reached a word to fire, and `resume()` restarted the scan with no
cursor at all, replaying the passage from its first word at 20 words per second
until it caught up to where playback actually was.

A tick now resolves straight to the last timing whose time has arrived and
reports that one word. Words a tick crossed over are skipped rather than fired
in order: the callback names the word being spoken and its consumer repaints a
single range per call, so replaying a backlog would paint highlights the learner
never sees and leave the final paint behind the audio. The scan resumes at a
cursor that survives pause/resume, which costs the number of words crossed
instead of the length of the passage, and a backward jump in `currentTime` — a
seek, or a replay on the same element — discards the cursor so an earlier word
is reported again.

The interval stays at 50ms, now as a stated choice. 50ms is below the perceptual
threshold for word-level sync at a fifth of the wake-ups a 60Hz
`requestAnimationFrame` loop would spend on the same job, and `timeupdate` fires
at browser discretion — commonly 150-250ms — so it would need a timer behind it
to interpolate. The interval also degrades better while the tab is hidden:
browsers clamp it to roughly 1s where they suspend rAF outright, and because a
tick resolves to the word that is current, one clamped tick resyncs the
highlight.

Ten raw `console.*` calls in the file now route through the shared
`createPieLogger` / `isGlobalDebugEnabled` gate. Five of them put content into
the console above debug level. Two carried item text directly: one printed the
spoken word, its character offset and its timings on every boundary — 20 times a
second — and one printed the first three speech marks with their word values
whenever highlighting started. Three sat on the synthesis failure path: a
120-character preview of the text under synthesis, the parsed error body, and 500
characters of a non-JSON error body, and a provider's error body can echo the
SSML it rejected.

The diagnostics that remain carry status, URL, backend, payload lengths, word
indices, character offsets, and the error message that is thrown to the caller
regardless. Content appears only when `window.PIE_DEBUG` is set, and no spoken
text is logged at any level. Warnings and errors keep their level and lose their
inline `[ServerTTSProvider]` prefix, which the logger namespace now supplies.

`@pie-players/tts-client-server` gains a dependency on
`@pie-players/pie-players-shared` for that logger. The provider is reachable
only through `@pie-players/pie-assessment-toolkit`, which already depends on it,
so no consumer resolves an additional package.
