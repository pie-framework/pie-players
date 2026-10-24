---
"@pie-players/pie-players-shared": patch
---

`SearchMetaData` and `SearchMetaDataEntity` are removed, and `ItemEntity`, `PassageEntity`, `AssessmentItemRef`, `AssessmentSection` and `AssessmentEntity` no longer declare `searchMetaData`. It is one backend's search index, which no player reads; content that carries it still passes through at runtime. A host that writes the field into these types now gets a type error and drops it or types it on its own entity.
