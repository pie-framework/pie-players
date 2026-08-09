---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
---

Play recorded audio as a `spoken` alternate.

PIE's `spoken` card was a string, so it could carry a reading script but never
"play this file for this node" — and some programs prefer a human voice to
synthesis. QTI 3 treats the two as the *same* support, with recorded audio
referenced by file and MIME type on a `spoken` card, so this adds a form of an
existing accommodation rather than a new one. No new PNP entitlement: a recording
played by the player is still computer-delivered speech.

`SpokenAudioCardPayload` carries a `MediaAssetRef` of `kind: "audio"` plus an
optional time range. `resolveSpokenAudioMedia` validates it with the same
"absent, never partially valid" posture as sign-language cards, refusing
non-audio media so signing and speech cards cannot quietly swap roles, and
staying silent for a plain script card — which arrives on that path routinely,
since form resolution is a preference.

Highlighting is the docked node as a block for the clip's duration. A recording
emits no word-boundary events, and deriving them from its duration would
highlight the wrong words confidently rather than the right region vaguely; word
-level highlighting stays available on the synthesized path. The rate setting
applies through `playbackRate`, a time range becomes a Media Fragments URI with
the end bound enforced by the player, and the first source is used because an
`<audio>` element with alternative `<source>` children reports failure through a
path that is awkward to observe reliably.

A clip that will not play degrades to the node's `content` card through the
existing speak-time fallback — which is the concrete reason QTI's guidance keeps
the script alongside the audio. With no script, the failure is reported rather
than silently skipped. `stop()` and seeking cancel a playing clip and settle its
pending playback, so a superseded run cannot wedge the chunk loop, and
`data-tts-suppress` withholds a recording exactly as it withholds a script.

Also extracts the media-URL allow-list, source and fragment normalization shared
by signing and spoken-audio cards into one module, rather than keeping two copies
of a security-relevant allow-list.
