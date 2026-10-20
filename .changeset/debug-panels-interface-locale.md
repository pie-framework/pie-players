---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-section-player-tools-event-debugger": patch
"@pie-players/pie-section-player-tools-instrumentation-debugger": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-section-player-tools-session-debugger": patch
"@pie-players/pie-section-player-tools-shared": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
---

The developer panels render their visible strings through the interface catalog, closing out the hardcoded-string scan entirely: event/instrumentation/pnp/session-debugger chrome, the session-db payload labels, and the TTS settings' format, sample-rate and example placeholders. Instrumentation record-kind identifiers and session-db payload field names are keyed but carried verbatim across locales — they name the emitted data — while generic labels and status sentences translate. Two dev-panel strings normalize to their catalog forms in English (`dupes:` becomes `Duplicates:`, matching `debug.fieldDuplicates`), and the TTS settings preview mode keeps `SSML` verbatim per the product-name rule.
