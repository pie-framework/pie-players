---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
---

Drop the non-standard PNP support-id aliases from the packaged registrations, and report a support id no registration claims.

Each packaged capability declared its AfA 3.0 / QTI 3.0 feature ids plus two or three "common variant" aliases — 21 aliases against 19 standard ids, so the alias vocabulary was as large as the vocabulary it aliased. They were modelled on what a particular host's UI happened to call a capability rather than on a published vocabulary, which is why the set could look complete and still miss the next host's label: a delivery system sending `responseMasking` got nothing, while `highlighter` and `lineReader` happened to work. Removed: `trackingGuide`, `highContrast`, `customColors`, `highlighter`, `textHighlight`, `annotation`, `lineReader`, `basicCalculator`, `scientificCalculator`, `choiceMasking`, `measurement`, `angleMeasurement`, `coordinatePlane`, `graphingTool`, `chemistryReference`, `elementReference`, `tts`, `speechOutput`, `spanishGlossary`, `spanishIllustratedGlossary`. `theme` stays as the theme capability's canonical id and its `toolId`. The standard ids for every capability are unchanged, so a host already sending AfA/QTI feature ids is unaffected; a host sending one of the removed strings maps its own vocabulary at the boundary instead. `UNIVERSAL_SUPPORTS_PRESET` shrinks correspondingly.

`basicCalculator` and `scientificCalculator` were additionally misleading: `calculatorType` arrives through the host's render params, so both granted the same untyped calculator as `calculator` and only looked like they selected a variant.

The reason the aliases felt load-bearing was a silent failure. `PnpPolicySource.mapSupportToToolId` returns an unclaimed support id verbatim, so it becomes a feature id matching nothing in placement: the capability is absent and no channel says why, which reads as an unwired toolkit. `composeDecision` now emits a `tool-policy.unknownSupportId` diagnostic naming the id, suppressed when the registry is empty because there is then no vocabulary to check against — a host supplying no registry already gets one `tool-config-validation` warning for that. `ToolPolicyDiagnosticCode` gains the new member.
