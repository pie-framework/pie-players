---
"@pie-players/pie-section-player": patch
"@pie-players/pie-item-list": patch
---

The section player's and item list's npm builds no longer inline `@pie-players/pie-assessment-toolkit`, `@pie-players/pie-players-shared` or `@pie-players/pie-context`. They import them from the host's `node_modules`, as every tool already does, so they share one copy of each with the toolkit and the tools. The item player still inlines its own players-shared and pie-context, since its one `dist` is also its CDN file. The section player's npm entry drops from about 1.1 MB to 330 KB and the item list's from 720 KB to 580 KB. `@pie-players/pie-context` moves to the section player's `dependencies`, and `speech-rule-engine` leaves them, since the toolkit owns that import. The `./browser` builds stay self-contained.
