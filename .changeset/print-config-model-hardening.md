---
"@pie-players/pie-print-player": patch
---

Keep the latest print config authoritative when asynchronous resolutions finish out of order, clear obsolete output on resolver failure, and retain plain markup when a config has no elements. Preserve authored floater models and match model IDs and element tags literally. The print resolver/config contract and the defaultResolve return fields used by the reference host remain unchanged.
