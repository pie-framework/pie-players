---
"@pie-players/pie-assessment-toolkit": patch
---

Honour `data-tts-suppress` so content can be shown but never spoken.

Read-aloud is not universally safe. Where reading *is* the construct — a decoding
item ("which word begins with the same sound as *cake*"), a spelling item where
synthesized speech voices both options identically — speaking the node hands over
the answer. Nothing in PIE could express that: the learner's
`PersonalNeedsProfile` carries `prohibitedSupports`, but that is the learner
saying "not for me", not the item saying "not here, for anyone", and this case has
to override an entitlement rather than yield to it. The workaround was disabling
read-aloud for a whole item, which also costs the candidate the directions —
content that was never the construct.

`data-tts-suppress` on a content element marks it and its subtree not-to-be-spoken.
It takes one value: `computer-read-aloud` or `all` suppress PIE's TTS, while
`screen-reader` targets assistive technology only and stays machine-read aloud.
An unrecognized or empty value suppresses anyway and logs why — a token that fell
through on a typo would leak an answer with no visible symptom, whereas
over-suppressing only withholds speech an author had already marked as withheld.

Enforced in every path that produces speech, since a filter on one of them is a
filter a candidate can walk around: the composed catalog path (before card
resolution, so suppression beats an authored `spoken` card on the same node), the
generated-speech and visible-text collectors, structural pause boundaries, and
`speakRange`. That last one mattered most and was the actual hole: the annotation
toolbar's selection read-aloud is a text-in path that hands `range.toString()`
straight to the provider, and `Range.toString()` honours no DOM filter at all, so
selecting a word and pressing read-aloud would have walked around a filter applied
only to the DOM walk. It now filters the range, and derives the highlight offset
from the same filtered text so word highlighting stays aligned when suppressed
content precedes the selection.

The shape follows QTI 3's `data-qti-suppress-tts` — same vocabulary, same
placement on the content element rather than on a catalog card — under PIE's own
`data-tts-*` attribute name. PIE reads one spelling; an importer converting QTI
content maps the attribute on the way in.
