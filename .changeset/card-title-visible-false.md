---
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-player": patch
---

`hooks.cardTitleFormatter` can return `{ visible: false }` to hide an item or passage card title. The header and its toolbar stay, and the heading stays in the document, visually hidden and carrying the default title as the card's accessible name. Every other return keeps its current meaning: an empty, non-string or throwing return still shows the default title. Host C blanks item titles with a zero-width space, which keeps working until it switches to `{ visible: false }`.
