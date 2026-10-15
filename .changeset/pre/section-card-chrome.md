---
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-theme": patch
---

Item and passage cards collapse their header, divider included, while `hooks.cardTitleFormatter` hides the title and the card's toolbar has no tool or host button to show; the heading stays in the document as the card's accessible name. `<pie-item-toolbar>` reflects that state as `data-pie-toolbar-empty`. The card frame's border color reads the new `--pie-section-player-card-border`, falling back to `--pie-border-light`, so `transparent` removes the frame without restyling borders inside item content.
