---
"@pie-players/pie-players-shared": patch
---

`ItemEntity` and `PassageEntity` add optional `curriculumStandards` and `skillLevels`, and `./types` exports `CurriculumStandard` and `SkillLevel`. Both are interchange fields named after QTI 3 Curriculum Standards Metadata 1.1 and LOM classification: players carry them and never read them. The content-model page lists the provider ids and skill-level sources.
