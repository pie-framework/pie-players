---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-sign-language": patch
---

`CatalogCard.payload` is the only name for a card's structured content; the `signLanguage` alias is removed.

`pie-elements-ng` (PIE-879) and the `pie-api-aws` Learnosity importer (PIE-881) had both landed with the signing payload under `signLanguage`, so this repo accepted that spelling on input and folded it into `payload` during resolution. That kept imported items rendering, and it introduced a worse failure than the one it prevented: only the resolution path knew about the alias, so an imported card rendered its signing video *and* reported that the item had no signed alternate to anything that enumerated alternates. One fact under two names means every read path is a place to forget one of them, and the enumeration path forgot.

Both producers now emit `payload`, on branches that land alongside this one, so the alias has nothing left to accept. It is gone from `CatalogCard`, from `resolveCard`, and from `resolveSignLanguageMedia`.

`resolveSignLanguageMedia` now warns on *any* `sign-language` card it cannot resolve, not only one carrying a string in `content`. A card written against the old spelling arrives with no payload at all, and the previous code returned `null` for it in silence — which is the shape of bug that reaches a learner and no one else. The new message names `payload` and says the card needs re-importing.

Sequencing matters for anyone landing these: a host that ships this player against content built by the older `pie-elements-ng` types or the older importer will see signing cards stop resolving, with that warning as the signal. Re-import, or take all three changes together.
