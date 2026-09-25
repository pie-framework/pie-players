---
"@pie-players/pie-calculator-cortex": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player-tools-event-debugger": patch
"@pie-players/pie-section-player-tools-instrumentation-debugger": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-section-player-tools-session-debugger": patch
"@pie-players/pie-section-player-tools-shared": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-tool-calculator-inline-cortex": patch
"@pie-players/pie-tool-calculator-inline-desmos": patch
"@pie-players/pie-tool-calculator-inline-geogebra": patch
"@pie-players/pie-tool-calculator-shared": patch
"@pie-players/pie-tool-tts-inline": patch
---

Published type declarations no longer import `svelte`, which a host without
Svelte cannot resolve: under `skipLibCheck: false` its type-check failed with
TS2307.

The section-player debugger and TTS settings panels, `tool-answer-eliminator`,
the inline calculators and `tool-tts-inline` now declare nothing from their root
entry, because importing one only registers its element. A TypeScript import of
the Svelte component that entry default-exports no longer type-checks.
`section-player-tools-shared` and `tool-calculator-shared` declare their
exported components without Svelte.
