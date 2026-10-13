---
"@pie-players/pie-players-shared": patch
---

`setLocale` selects a locale that only `customMessages` covers when a `loadCatalog` is configured. The loader is asked only for tags in `availableLocales`, so it no longer rejects such a locale and strands the previous one; missing keys resolve through the fallback locale.
