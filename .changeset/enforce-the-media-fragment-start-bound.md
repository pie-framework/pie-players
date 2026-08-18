---
"@pie-players/pie-assessment-toolkit": patch
---

Seek recorded read-aloud audio to its media fragment's start, so a recording
sliced across several nodes plays the slice it was asked for.

`MediaFragmentRange` describes one use of a recording, which is how a single file
serves several docked nodes. `applyMediaFragment` writes that range onto the
source URL as a `#t=start,end` Media Fragments URI, but the URI is a hint: the
shared contract requires the player to enforce both bounds itself, because
browsers honour neither reliably. `SignLanguageMediaRegion` does, seeking forward
on `loadedmetadata` and pausing on `timeupdate`. Recorded `spoken` audio enforced
only the end, on the written belief that the start offset was honoured — the
reading the contract itself records as corrected. A browser that ignored `#t=`
therefore played from 0, and read-aloud spoke the wrong node's audio while
highlighting the right node.

`TTSService.playRecordedAudio` now seeks to `startSeconds` once metadata is
available, forward only, so a browser that did honour the URI is not rewound.
Recordings with no fragment, or a fragment starting at 0, behave exactly as
before. The two false claims about start-offset support — in `playRecordedAudio`
and in `applyMediaFragment`'s own docblock — are corrected, since the helper's
comment was the reason the wrong reading spread.

Covered by `tests/tts-recorded-audio.test.ts`, which pins the seek and its
forward-only guard; the existing test asserted only the URL the fragment
produced.
