---
"@pie-players/pie-players-shared": patch
---

`SettingsMetaData` and `SettingsMetaDataEntity` are removed, so `AssessmentSection` no longer declares `settings`, and `ItemEntity` and `PassageEntity` no longer declare `highlights`. No player reads either: one is backend settings metadata, the other a search response's highlights. Content that carries them still passes through at runtime. A host that writes either field into these types now gets a type error and drops it or types it on its own entity.
