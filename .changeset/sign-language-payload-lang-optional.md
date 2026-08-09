---
"@pie-players/pie-players-shared": patch
---

`SignLanguageCardPayload.signLang` is optional, matching how it has always been read.

The card's `language` is QTI's `xml:lang` on the card entry and the only field catalog resolution selects on — resolution runs before anything knows the card is a signing card, so it can only key on the generic field. `signLang` is read afterwards, to name the language in the media region's accessible label and to refuse a card in a sign language the learner did not ask for, and it has always fallen back to the card's `language` when absent. Typing it required made the redundant case look mandatory: nearly every card carries the same code twice, and authors had no way to tell which copy mattered.

It earns its place only where the two differ — a card tagged with the item's content language (`language: "en-US"`, `signLang: "ase"`) so resolution reaches it by the default-language rung. The sign-language demo drops it accordingly.
