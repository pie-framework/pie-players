---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-i18n-generated": patch
---

Toolbar glyphs no longer render blank (R-03, R-13, R-14, R-24). The FontAwesome that `<nds-icon-button>` needs comes from one place, `@pie-players/pie-players-shared/ui/fontawesome`, now used by the item toolbar, the inline TTS control and the section player's scroll hint, which under `ndsIcons` previously had no FontAwesome in its shadow root. The highlighter and strikethrough icon names gain built-in glyphs, and the answer eliminator's button draws its registration's icon. The annotation toolbar's screen-reader announcements follow the interface locale.
