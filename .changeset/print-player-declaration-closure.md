---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-section-player-tools-instrumentation-debugger": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
---

The content surface ids `CONTENT_LEAD_SURFACE` and `CONTENT_MEDIA_SURFACE` have
one home: `@pie-players/pie-assessment-toolkit/tools/registration`. The
composition layer, the section player's card media region and print re-export or
import them from there instead of defining the same string again.

This repairs print-player's published types, which imported
`@pie-players/pie-default-tool-loaders` — a package print-player does not
declare, so a host type-checking print-player alone failed with TS2307 under
`skipLibCheck: false` and silently typed the constant `any` under
`skipLibCheck: true`. Its surface is unchanged: the constant is still exported
from the package root.

The instrumentation debugger and TTS settings panels promote
`@pie-players/pie-players-shared` and `@pie-players/pie-assessment-toolkit`
respectively from devDependencies to dependencies: their published declarations
reference them, so a host type-checking a panel needs them installed.

`check-svelte-type-imports` now enforces the whole rule its header claimed: a
published declaration reachable from a type entry may import only svelte-free
and declared-dependency specifiers. It found and this change repairs the two
panels and print-player; calculator-cortex's unreachable `dist/src`
declarations still name bundled-away vendor packages and remain outside the
reachable rule until their declarations are typed without them.
