---
"@pie-players/pie-section-player": patch
"@pie-players/pie-players-shared": patch
---

Section pre-warm now loads and asserts the view the item players render: ESM honours `loaderOptions.view` and author `mode`, a hosted IIFE player skips controllers, and a preloaded author section asserts the `-config` tags. A rejected pre-warm shows an error in place of the loading message, and `policies` accepts a partial object.
