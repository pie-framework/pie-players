---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

The toolkit's custom elements, which the section player bundles, now ship
production Svelte. Players no longer patch `Array.prototype` on the host page or
run Svelte's dev-only checks.
