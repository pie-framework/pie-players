---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-tool-tts-inline": patch
---

The toolkit drops surface that nothing constructs or calls: `ThemeProvider` with `ThemeConfig`, `FontSize` and `ThemeProviderApi`; `I18nService` and its `./services/I18nService` subpath; the Svelte context keys `TOOL_POLICY_ENGINE_KEY` and `SECTION_RUNTIME_ENGINE_KEY` with their context types; `normalizeToolAlias`; `ToolkitCoordinator.updateToolPlacement`; and the runtime context's `reportSessionChanged`. `AssessmentSettings.themeConfig` leaves the shared types. On the runtime engine, `SectionRuntimeEngine` loses `getEffectiveRuntime`, `setInstrumentationHook` and the `coordinator` and `instrumentationHook` attach options, and `runtime/internal` loses the coordinator and instrumentation bridges.

In their place: `createPieI18n` from `@pie-players/pie-players-shared/i18n` for `I18nService`, `updateToolsPlacement({ [level]: ids })` for `updateToolPlacement`, and `engine.subscribe(...)` for an instrumentation hook. The i18n types stay exported from the toolkit root.
