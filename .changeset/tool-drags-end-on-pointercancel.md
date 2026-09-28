---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-line-reader": patch
"@pie-players/pie-tool-text-to-speech": patch
---

Dragging the line reader, the text-to-speech panel or a floating tool shell
now ends when the browser cancels the touch, as iPadOS does when it takes a
touch over for a system gesture, and a second finger landing mid-drag no
longer moves the panel. The text-to-speech panel also claims touch drags, which
previously scrolled the page instead.
