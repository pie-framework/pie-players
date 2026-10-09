---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-tool-calculator-desmos": patch
"@pie-players/pie-tool-calculator-shared": patch
"@pie-players/pie-tool-sign-language": patch
---

Tool elements read the toolkit's services from the runtime context only, so the calculator, annotation toolbar, answer eliminator and sign-language elements drop their coordinator, service and `providerId` properties. Providers register under their tool's id (`calculator`, `textToSpeech`), and the toolkit reports a tool by that id as `toolId` only: lifecycle hooks pass it as their first argument, `ToolkitErrorContext.providerId` becomes `toolId`, and `ProviderLifecycleContext.providerId`, `ToolConfigDiagnostic.providerId` and the `providerId` telemetry repeated beside `toolId` are removed. `ToolProviderApi.providerId`, `getProviderId`, `resolveToolProviderId`, `ToolkitCoordinator.getToolProvider` and `AnswerEliminatorToolConfig` are removed, and `sanitizeConfig` / `validateConfig` move from the provider descriptor to `ToolRegistration`.
