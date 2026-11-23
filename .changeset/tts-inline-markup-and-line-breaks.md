---
"@pie-players/pie-assessment-toolkit": patch
---

Read-aloud reads inline markup and line breaks the way they look.

- It no longer pauses mid-sentence where inline markup begins. The speech plan cuts the spoken text where it enters another block, and pauses there, but it never recorded the block of a block's first text run, so the second run of every block was cut off as if it opened a new one. In a prompt such as `A mother bear has <u>cubs</u>. They are small.`, the speech stopped and paused before the underlined word. A block's inline markup — `<u>`, `<i>`, `<strong>`, a `<span>` — now stays in the one segment, and the cut falls only where the text enters another block: a paragraph, a list item, a heading, a table cell, or an element with `data-tts-break-ms`.
- A `<br>` now reads as a space and pauses the speech. Having no text, it was dropped, gluing the lines it breaks: `food.<br /><br />What` was spoken as `food.What`, which server voices read as "food dot what". The spoken text now has a space there, and the speech plan cuts at the `<br>` with the pause of a minor block, so lines without end punctuation, such as a poem's, pause as well. A `<br>` that is hidden or suppressed adds nothing, as does one before the first line or after the last.

Text from authored SSML or a catalog is spoken as before.
