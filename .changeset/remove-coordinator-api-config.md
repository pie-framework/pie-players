---
"@pie-players/pie-assessment-toolkit": patch
---

`ToolkitCoordinatorApi` no longer declares `config`, so code typed against the
interface that reads `config.tools.providers` stops compiling; call
`getToolConfig(toolId)` instead. `ToolkitCoordinator` keeps its public `config`.
