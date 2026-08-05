---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-calculator": patch
"@pie-players/pie-calculator-desmos": patch
"@pie-players/pie-tts": patch
"@pie-players/tts-client-server": patch
"@pie-players/tts-server-core": patch
---

Keep every runtime dependency external in the assessment toolkit's custom-element build, and stop publishing sourcemaps.

Inlining a dependency into a prebuilt custom-element chunk creates a copy a consumer's bundler cannot deduplicate, because its module id is the chunk file rather than the dependency's path in `node_modules`. `speech-rule-engine` was reaching the section player twice for exactly that reason — once through `services/tts/math-speech.js` and once inside the prebuilt chunk — about 1.3 MB of duplicate payload. Externalizing the manifest's dependencies collapses that to one copy. It asks nothing new of consumers: these artifacts already emitted bare `@pie-players/*` specifiers, so they always required a bundler or an import map.

Publishable packages ship only `dist`, so a usable sourcemap also required `inlineSources`, which embedded every TypeScript source into the tarball. That cost roughly 2.5 MB across the tsc-built packages while every Vite-built package in the repo already shipped none. Sourcemaps are now off everywhere.
