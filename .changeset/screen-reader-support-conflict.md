---
"@pie-players/pie-assessment-toolkit": patch
---

A profile listing the `screenReader` support now withholds `textToSpeech` and the `autoplayAudio` feature under the new `support-conflict` rule, at the precedence of `pnp-prohibited`. A district block, a `false` override or an item restriction still outranks it. A withdrawal raises `tool-policy.supportConflict`, which replaces `tool-policy.overrideBlocked` for an override the conflict withdraws, and neither id raises `tool-policy.unknownSupportId` any more.
