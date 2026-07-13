---
"@pie-players/pie-players-shared": patch
---

Preserve distinct full custom-element tags when multiple PIE element versions coexist, while keeping the established tag encoder and existing single-version behavior unchanged. Legacy IIFE bundles now reject unrepresentable maps containing multiple specs for one package instead of aliasing distinct tags to one constructor.
