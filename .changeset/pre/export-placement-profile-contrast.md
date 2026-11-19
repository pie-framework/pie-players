---
"@pie-players/pie-section-player": patch
"@pie-players/pie-theme": patch
---

The section player's `./browser` build exports `SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT` and `createUniversalPersonalNeedsProfile`, so a page that loads the build reads the packaged placement and universal profile from the release it renders. `@pie-players/pie-theme` exports `PIE_THEME_CONTRAST_RELATIONSHIPS` and its `ThemeContrastRelationship` type, the pairs the theme's contrast diagnostics measure. Host R keeps local copies of all three and can adopt the exports.
