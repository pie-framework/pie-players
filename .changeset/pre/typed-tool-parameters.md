---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-tool-calculator-shared": patch
---

Tool parameters reach every tool policy shows, granted or not and whatever `pnpEnforcement` is: an item's `toolParameters` entry on its own toolbar and scope, else the assessment's `settings.toolParameters` entry. `ToolParameterMap` types the packaged tools' parameters, `ToolPolicyEntry.settings` is renamed `parameters`, `decideFeaturePolicy` types `parameters` by feature id, and tools read theirs through `ToolbarContext.getToolParameters`. The answer eliminator's strategy moves from `tools.providers.answerEliminator.strategy` to `toolParameters.answerEliminator.strategy`. The calculator opens the parameters' `type` when no resolver or request names one, and the inline calculator's buttons request their variant. Item `toolParameters` alone no longer turn PNP enforcement on. `AssessmentCalculatorConfig` and the `ToolRuntimeConfig` alias are removed.
