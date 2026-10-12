---
"@pie-players/pie-tool-line-reader": patch
---

The line reader no longer blanks an announcement that follows another within a second: it keeps one timer for its live region, and closing the tool cancels it.
