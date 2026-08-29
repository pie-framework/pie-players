---
"@pie-players/pie-section-player-tools-event-debugger": patch
"@pie-players/pie-section-player-tools-instrumentation-debugger": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-section-player-tools-session-debugger": patch
"@pie-players/pie-section-player-tools-shared": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-tool-calculator-inline-desmos": patch
"@pie-players/pie-tool-tts-inline": patch
---

Stop publishing `dist/vite.config.d.ts`. Nine packages emitted a declaration for their own Vite config because the dts pass ran over an unbounded TypeScript glob, and every one of them ships `dist`, so the file reached the tarball. No `exports` entry ever pointed at it, so nothing could import it — this is tarball contents, not API. `check:pack-integrity` now rejects a packed build-config declaration, so a new package cannot reintroduce one.
