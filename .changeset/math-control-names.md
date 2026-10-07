---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
---

The toolkit labels math inside controls with Speech Rule Engine's speech, so a
choice holding 4/12 is named "4 over 12" for screen readers, where browsers
leave its MathML out of the name. It covers everything in the toolkit's
flattened tree, a section's items and a plain item player it wraps alike, in the
content's language and with the host's `mathSpeech` style where it applies.
`TTSService.getMathSpeechOptions()` is public, and
`@pie-players/pie-players-shared/ui/flattened-tree` exports
`observeFlattenedTree`, which reports content as it enters a container's
flattened tree, slotted content and open shadow roots included.
