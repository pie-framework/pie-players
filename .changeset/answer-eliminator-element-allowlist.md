---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-tool-answer-eliminator": patch
---

A host can limit the answer eliminator to the elements whose support it has vetted with `tools.providers.answerEliminator.elements`, such as `["multiple-choice"]`. An item with no listed element loses the eliminator, even under a PNP grant, and in a mixed item only the listed elements' choices take a toggle. Omitted, every element that supports answer masking keeps it. To support this, `isApplicableToContent` receives the tool's `tools.providers` entry, which `filterDecidedToolIds` takes as a `getToolConfig` argument.
