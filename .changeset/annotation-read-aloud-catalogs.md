---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-tts-inline": patch
---

The annotation toolbar's read-aloud reads spoken cards. A `data-catalog-idref` node the selection holds whole reads its card, from the cards the selection's shell registered and then the assessment's, as tts-inline reads it; a selection holding part of a node reads the selected text. `speakRange` takes a `catalogContext`, and `catalogContextHolding` gives a tool serving several shells the context of the shell holding a node. The read button stays focused while it reads; it used to disable itself, which dismissed the strip and stopped the read a frame after it started.
