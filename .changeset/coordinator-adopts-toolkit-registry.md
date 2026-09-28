---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

A `ToolkitCoordinator` constructed without `toolRegistry` adopts the registry of the toolkit it is bound to, such as the section player's, so its config is validated and its tool providers register: server text-to-speech and a placed calculator work without passing the registry to the coordinator. A registry passed at construction is never replaced, and the missing-registry warnings appear only once a coordinator is known to have none.
