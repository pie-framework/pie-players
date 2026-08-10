---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-sign-language": patch
---

Accept `signLanguage` as an input alias for a sign-language card's `payload`, so cards from the two producers that already shipped resolve.

`CatalogCard.payload` was the only accepted name for a signing card's structured media. Two landed implementations disagree with that: `pie-elements-ng` declares the payload as `signLanguage` (PIE-879), and the `pie-api-aws` Learnosity importer emits `signLanguage` (PIE-881). A card from either validated, imported, stored and then resolved to `null` — no signing video, no error a learner or proctor would ever see. That is the exact failure mode the accommodation model exists to prevent, and it is invisible precisely to the people who depend on it.

`CatalogCard.signLanguage` is now accepted and folded into `payload` at the one point where `AccessibilityCatalogResolver` projects a card, so a single field still reaches every consumer and nothing downstream learns two names. `resolveSignLanguageMedia` reads the alias too, for callers that hand it a raw card. `payload` wins when a card somehow carries both.

Tolerated on input, never canonical. Which name the three repos settle on is a separate decision; this stops content from silently losing its accommodation while that decision is made.
