---
"@pie-players/pie-assessment-toolkit": patch
---

The `ToolCoordinator` class is no longer exported, and `ToolkitCoordinator.toolCoordinator` is typed `ToolCoordinatorApi`, dropping the class-only `getToolElement` and `getRegisteredTools`; read an element through `getToolState(id)?.element`. Disposing the toolkit coordinator now releases every tool entry, including unregistered ones, and the tool coordinator's debug lines print only under `window.PIE_DEBUG = true`.
