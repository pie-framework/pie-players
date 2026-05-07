---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-print-player": patch
---

Move Svelte out of published runtime dependencies and add a release check that rejects future accidental `svelte` runtime dependency declarations. Assessment toolkit custom-element outputs now bundle their Svelte runtime helpers so consumers do not install a second Svelte runtime through player packages.
