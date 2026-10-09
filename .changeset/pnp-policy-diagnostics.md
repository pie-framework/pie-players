---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
---

The section-player layout elements take an `assessment` property, forwarded to the coordinator their toolkit builds; a section carrying `personalNeedsProfile` logs a warning, since policy reads the profile from the assessment. The toolkit coordinator logs `tool-policy.unknownSupportId` and `tool-policy.requiredToolBlocked` once per code and tool. `unknownSupportId` covers every policy list and names the fields that list the id, and `FeaturePolicyDecision.diagnostics` carries it on feature decisions. Passage-level decisions skip item settings and raise `tool-policy.itemSettingNotApplied`, as section and assessment toolbars do. `ToolSurfaceRenderContext.granted` is `false` for a section-placed capability with no grant. `AssessmentSettings` and `ItemSettings` drop their `[key: string]: any` index signatures, and `toolConfigs.textToSpeech` its typed shape. The PNP debugger decides item and passage levels under the section's real ids, shows the decisions' diagnostics and the coordinator's enforcement override, and lists only the policy inputs present.
