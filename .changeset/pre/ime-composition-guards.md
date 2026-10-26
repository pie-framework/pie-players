---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-magnifier": patch
---

Keys that commit or cancel an IME composition no longer act on player chrome: the annotation toolbar's keyboard shortcuts, Escape in a focus trap, and the magnifier's Escape ignore them, including Safari's committing Enter, which reports `keyCode` 229 with `isComposing` false. `@pie-players/pie-players-shared` exports the check as `isComposingKeyEvent`.
