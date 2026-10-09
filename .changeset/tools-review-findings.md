---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-tool-calculator-shared": patch
"@pie-players/pie-tool-sign-language": patch
---

An open calculator remounts on a provider that a tool-config update replaces, answer eliminations are kept per element, toolbar-seeded tools release their coordinator entries, and one `<pie-tool-calculator>` element and one loader set serve every calculator provider and host shape. Removed: the toolkit's `./tools/client` subpath, `connectAssessmentToolkitRuntimeContext`, `connectAssessmentToolkitShellContext` and `connectAssessmentToolkitRegionScopeContext` (use the `connectTool…` functions), the singular `toolComponentFactory` override, `ToolCoordinator.resetZIndices`, the loader options `calculatorProviderConfig`, `createDefaultToolModuleLoaders`, `createSectionToolModuleLoaders`, `ITEM_TOOL_MODULE_LOADERS`, `SECTION_TOOL_MODULE_LOADERS` and `registerSectionToolModuleLoaders` (use `DEFAULT_TOOL_MODULE_LOADERS` and `tools.providers.calculator`), the `pie-tool-calculator-geogebra`, `-cortex`, `-inline-geogebra` and `-inline-cortex` packages (use `<pie-tool-calculator>` and `<pie-tool-calculator-inline>`), and the answer eliminator's `globalElementId` prop, replaced by `elementStateKeys`; `ToolbarContext.getGlobalElementId` now takes the element id.
