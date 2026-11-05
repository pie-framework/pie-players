---
"@pie-players/pie-tts": patch
"@pie-players/tts-client-server": patch
"@pie-players/tts-server-core": patch
---

The word-timing wire format — `SpeechMark`, `anchorSpeechMarks`,
`normalizeSpeechMarks` and `resolveSpeedRateBucket` — moves into
`@pie-players/pie-tts`, the contract package both sides of the wire already
depend on. They were `tts-server-core` exports, which is why the browser-side
`ServerTTSProvider` imported three pure text functions from a package named
"server-core"; any future node-only addition to that root entry would have
pulled toward every browser bundle shipping the server TTS provider. The
duplicated `SpeedRateBucket` type definition (it existed in both `pie-tts` and
`tts-server-core`) converges on the contract's.

`tts-server-core` re-exports all of it, so its published surface is unchanged
and a host importing the utilities from there keeps working;
`tts-client-server` imports them from the contract now. The speech-marks test
suite moves with the code, to the contract package.
