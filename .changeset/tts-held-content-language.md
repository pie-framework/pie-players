---
"@pie-players/pie-assessment-toolkit": patch
---

Read-aloud of a whole item speaks it in the language its content root declares. A read of a region above the item player's content root now takes the `lang` the player stamps from `env.locale`, before the toolkit's `content-language`, so an item-player host that sets `env.locale` gets the right voice.
