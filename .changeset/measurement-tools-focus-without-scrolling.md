---
"@pie-players/pie-tool-ruler": patch
"@pie-players/pie-tool-protractor": patch
---

Reveal the ruler and protractor without scrolling the pane they sit in.

Both auto-focus their container 100ms after becoming visible, and did so without
`preventScroll`. Where the tool's own box starts outside the visible part of a
scrollable pane, the browser scrolled that ancestor to bring it into view — in
the split-pane section demo, 73px of the items pane, moving the item the learner
was reading. Focus now passes `preventScroll: true`, matching the line reader.
