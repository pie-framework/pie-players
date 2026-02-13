---
"@pie-players/pie-section-player": patch
"@pie-players/pie-tool-answer-eliminator": patch
---

Fix section player entry point and answer eliminator TypeScript error

- Removed redundant static tool imports from section-player entry point (tools are loaded dynamically by assessment-toolkit)
- Fixed TypeScript error in answer-eliminator by removing reference to non-existent currentQuestionId property
