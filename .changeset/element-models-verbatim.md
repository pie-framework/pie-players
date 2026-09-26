---
"@pie-players/pie-players-shared": patch
---

PIE elements receive their models as authored again. Since 0.3.49 the player
rewrote every model string holding an `<img>` or `<table>` to insert the
overwide scroll wrapper, and elements that copy model strings into the session
stored that markup: image-cloze-association scored correct answers 0, and
select-text misplaced its tokens when its text held an image. The wrapper is now
applied to the rendered DOM only, and `wrapModelRichContent` is removed from the
package root and its `./security` entry. Host A strips the wrapper from answer values before preview
scoring; new sessions no longer carry it, so that strip becomes a no-op.
