---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-tool-annotation-toolbar": patch
---

Tool failures that only reached the console now reach `framework-error`, recoverable and once per tool and phase: a toolbar that throws opening or hosting a requested tool (`tool-request`), a registration's relevance or applicability check that throws (`tool-registration`), annotation highlights that fail to save or restore (`tool-state-save`, `tool-state-load`), and speech that fails after it started (`tool-playback`). `reportToolModuleFailure(toolId, error)` is replaced by `reportToolFailure(toolId, phase, error)`.
