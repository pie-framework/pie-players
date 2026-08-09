---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-text-to-speech": patch
---

Resolve a selection's spoken catalog by climbing to the nearest ancestor that actually holds spoken content.

`data-catalog-idref` names a whole card array, not a spoken card. The TTS tool took the nearest docked ancestor of a selection and passed its id straight to `speak()`, which was correct while spoken cards were the only kind that got docked. They are not any more: `SignLanguageExtractor` docks a signing catalog onto the element wrapping a marked video, and that element can sit inside a node the author docked to a catalog carrying the SSML. The inner reference then wins, the lookup finds no spoken card, and the selection is read as generated speech — plausible enough that nobody notices the authored pronunciation was dropped.

`TTSService.hasSpokenAlternate(catalogId, language?)` answers whether a catalog holds speakable content, and the tool walks up from the selection until one does, falling back to the nearest docked id when the service cannot answer (no resolver attached), which is the previous behaviour. The composed-speech path never had this problem — it descends into children when a card has no string form — so only the selection path changes.
