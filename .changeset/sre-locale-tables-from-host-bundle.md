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
In a browser the toolkit hands SRE a loader over the tables the package ships in
`speech-rule-engine/lib/mathmaps`, so the host's bundler emits each as a lazy
chunk served from the host's own origin. `mathSpeech.engineOptions.json` or
`.custom` still names another source, and now also covers `base` and `en`, the
two tables SRE loads at start-up, which had come from jsDelivr regardless.

The section player, its three tool panels and the nine `pie-tool-*` bundles that
inline math speech now import `speech-rule-engine` from the host's
`node_modules` rather than each shipping a private copy, so every PIE bundle a
host loads shares one SRE and one set of tables. Each of those packages is about
670 KB smaller.

Host A's build inlines every dynamic import into one file, so the 16 tables
(4.3 MB) join that file while nine duplicate SRE copies leave it: about 1.7 MB
smaller, and no table request at runtime. Host R's build emits the tables as
lazy chunks, and `base` and `en` (580 KB) load from its origin the first time a
formula is spoken.
