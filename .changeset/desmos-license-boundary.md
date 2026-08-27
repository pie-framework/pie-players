---
"@pie-players/pie-calculator": patch
"@pie-players/pie-calculator-desmos": patch
"@pie-players/pie-calculator-geogebra": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-theme": patch
"@pie-players/pie-tool-calculator-desmos": patch
"@pie-players/pie-tool-calculator-geogebra": patch
"@pie-players/pie-tool-calculator-inline-desmos": patch
"@pie-players/pie-tool-calculator-inline-geogebra": patch
"@pie-players/pie-tool-calculator-shared": patch
---

Add a separately packaged GeoGebra calculator suite with provider, full tool,
inline trigger, tests, documentation, and a section-player demo. Basic requests
map to GeoGebra Scientific, while scientific and graphing use their matching
embedded apps.

Move calculator lifecycle and UI into a provider-neutral shared package, keep
vendor settings in their implementation packages, and select implementations
through the same `provider.init`, `provider.runtime`, and `settings` schema.
Desmos remains the no-configuration default and preserves its unkeyed legacy
load for existing clients.

Document that PIE bundles only MIT-licensed adapter code, not either vendor
application. Clarify the separate Desmos and GeoGebra license obligations,
runtime credential boundary, attribution, and self-hosting restrictions.
