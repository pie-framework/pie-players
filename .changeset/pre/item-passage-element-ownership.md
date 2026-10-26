---
"@pie-players/pie-item-player": patch
"@pie-players/pie-players-shared": patch
---

Reject an item and passage that assign different executable packages to the same full element tag, before metadata requests or loading. Previously the passage silently replaced the item's package. Both now use the shared aggregation contract; identical declarations still deduplicate and distinct versioned tags remain independent. Existing ItemEntity arrays remain accepted by aggregateElements.
