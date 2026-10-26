---
"@pie-players/pie-tool-ruler": patch
"@pie-players/pie-tool-protractor": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-player": patch
---

Expose native element types and tag-name inference for ruler, protractor, inline TTS, section layouts and the assessment player. Tool and layout inputs share their implementation's property types; host methods and assessment members derive from their implementations. Section snapshots remain nullable before the kernel binds. Existing host assignments, registration, package entrypoints and runtime exports are unchanged; hosts configuring these elements can replace local casts with the exported types.
