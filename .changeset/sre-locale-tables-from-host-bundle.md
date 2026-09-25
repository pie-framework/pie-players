---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-section-player-tools-event-debugger": patch
"@pie-players/pie-section-player-tools-instrumentation-debugger": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-tool-theme": patch
"@pie-players/pie-tool-graph": patch
"@pie-players/pie-tool-line-reader": patch
"@pie-players/pie-tool-periodic-table": patch
"@pie-players/pie-tool-protractor": patch
"@pie-players/pie-tool-ruler": patch
"@pie-players/pie-tool-text-to-speech": patch
---

Math speech no longer fetches speech-rule-engine's locale tables from jsDelivr.
In a browser the toolkit hands SRE a loader over the `base`, `en` and `es`
tables from `speech-rule-engine/lib/mathmaps`, which the host's bundler emits as
lazy chunks served from its own origin. Math in any other locale is spoken with
English words, and SRE logs `Unable to load locale`, unless
`mathSpeech.engineOptions.json` or `.custom` names a source for its table. Either
option now also covers `base` and `en`, the two tables SRE loads at start-up,
which had come from jsDelivr regardless.

The section player, its three tool panels and the nine `pie-tool-*` bundles that
inline math speech now import `speech-rule-engine` from the host's
`node_modules` rather than each shipping a private copy, so every PIE bundle a
host loads shares one SRE. Each of those packages is about 670 KB smaller.

A build that inlines every dynamic import into one file gains the three tables
(0.8 MB) and loses the duplicate SRE copies: Host A's initial bundle goes from
13.4 MB to 10.3 MB.
