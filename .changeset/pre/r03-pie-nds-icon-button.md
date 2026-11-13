---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-tool-tts-inline": patch
---

The vendored NDS icon button now registers as `<pie-nds-icon-button>`. On a page that also loads NDS, the shared `nds-icon-button` name left whichever copy defined second skipped or throwing, so PIE's toolbar, read-aloud and scroll-hint buttons could render with the host's version. The `./nds-icon-button` export path, the `nds-icons` opt-in and the `nds-icon-button__*` BEM classes are unchanged; a host stylesheet that selects the old element name must select `pie-nds-icon-button`.
