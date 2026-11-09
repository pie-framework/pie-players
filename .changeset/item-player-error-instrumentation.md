---
"@pie-players/pie-item-player": patch
---

The item player reports each failed load (`ITEM_PLAYER_LOAD_ERROR`) and each config carrying binding warnings (`ITEM_PLAYER_CONFIG_BINDING`, `recoverable: true`) to its instrumentation provider, and logs binding warnings as errors. A config with binding warnings still renders.
