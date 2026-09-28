---
"@pie-players/pie-assessment-toolkit": patch
---

`createToolsConfig` and `ToolkitCoordinator` take `tools` as the new `ToolsConfigInput`, where each placement level is optional, matching the normalizer, which fills a missing level with its default. A config naming only `item` placement no longer needs empty `section` and `passage` arrays to compile. `coordinator.config.tools` is typed as that input, so its placement levels read as possibly undefined.
