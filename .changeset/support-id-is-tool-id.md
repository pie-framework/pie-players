---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-tool-sign-language": patch
---

A tool's PNP support id is its tool id. `ToolRegistration.pnpSupportIds`, `ToolRegistry.getToolsByPNPSupport` and `generatePNPSupportsFromTools`, and the dictionary factories' `pnpSupportIds` option are gone, so a profile, district policy or item setting names a tool by `toolId`: `lineReader` for `readingMask`, `annotationToolbar` for `highlighting`, `answerEliminator` for `answerMasking`, `theme` for `colorContrast`, `dictionarySpanish` for `spanishDictionary`. Any other id still produces `tool-policy.unknownSupportId`. `createUniversalPersonalNeedsProfile()` grants tool ids. The render context, the content-dependency context and `resolveContentCapabilities` results drop `featureId`; `granted` tells an accommodation from authored presentation.
