---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

The overwide image and table wrap no longer runs in author mode, and leaves
content inside a `contenteditable` editing host alone. In a ProseMirror editor
holding an image, such as a configure editor or extended-text-entry's response,
the wrap and the editor undid each other continuously, logging over a thousand
DOM mutations a second on an idle page.
