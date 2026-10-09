---
"@pie-players/pie-theme": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-section-player": patch
---

The `.table` grid rules (`.table`, `.table-bordered`, `thead`, `tbody + tbody`)
in `components.css` now paint `--pie-text`, where they used a 15% mix of it.
The mix measured 1.41:1 on white, short of the 3:1 SC 1.4.11 requires for a
grid rule against the page. `--pie-text` is held to 4.5:1 against the page, so
the rules clear 3:1 on every theme and scheme. Authored tables using these
classes show text-coloured rules where they showed faint grey ones. Under a
color scheme, the rules around a filled cell the scheme inverts take its page
colour, so adjacent filled header cells stay apart.

Consumer impact: Host V loads its own copy, scoped to its item container. Its
item tables get the stronger rules once it upgrades `pie-theme`; until then they
keep the fixed `#dee2e6` grey used before 0.3.66.
