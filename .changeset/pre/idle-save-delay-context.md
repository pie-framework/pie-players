---
"@pie-players/pie-context": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
---

Add `sessionCommitContext` and the item player's `idleSaveDelayMs` (`idle-save-delay-ms`), which sets how long a response editor waits for the learner to pause before committing; `0` commits on blur only. The section player takes it as `runtime.player.idleSaveDelayMs`.
