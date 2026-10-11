---
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-tool-periodic-table": patch
"@pie-players/pie-tool-sign-language": patch
---

The stock items and passages panes space their cards 1rem apart again, as they did before the panes became their own elements; the rule sat on `:host`, which matches nothing in light DOM. Hosts A and R render the splitpane layout and see the gap. The layout elements drop the same dead `:host` rules, which never applied. `<pie-tool-sign-language>` labels follow the toolkit's interface locale in place of always rendering English, and drops its unset `i18n` property. The periodic table gives Alkaline Earth Metal its own category class in place of `alkaline-earth` plus a stray `metal`. The item-player README describes when `backend-error` fires, and the section-player README includes the tabbed layout among those that move the toolbar to the top below `narrow-layout-breakpoint`.
