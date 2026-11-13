---
"@pie-players/pie-section-player": patch
---

Stop marking the section player's current item card `aria-current="true"` (PIE-1466). The attribute sat on a wrapper with no role around the whole item, so screen readers repeated it inside the card: JAWS said "current current" after every formula in a multiple-choice item's answer choices. The current item is still marked by the card host's reflected `is-current` attribute, and the navigation status region and the item headings still tell a screen-reader user where they are. A host that selected the current card through `[aria-current]` should select `pie-section-player-item-card[is-current]` instead; a host with its own question-number navigation or pager puts `aria-current="step"` on the control for the current item.
