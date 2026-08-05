---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

Minify and code-split the assessment toolkit custom-element bundles. The three CE artifacts are now produced by a single bundler invocation that shares code through `dist/components/chunks/`, so the Svelte runtime, services layer, and policy engine are no longer duplicated per artifact, and `SectionToolBar` no longer inlines a second copy of `ItemToolBar`. Splitting also restores the lazy `speech-rule-engine` boundary that `math-speech.ts` already asked for: it moves to a chunk fetched only when math speech runs, instead of being flattened into the eager bundle. Eager CE bytes drop from 1,993 KB to 346 KB, and the section player's main bundle drops from roughly 2.6 MB to 1.4 MB. Entry filenames, the `exports` map, and per-entrypoint custom-element registration side effects are unchanged.
