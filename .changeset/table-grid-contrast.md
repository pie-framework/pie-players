---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-theme": patch
---

The content stylesheet the players install no longer restyles host UI. Its
generic rules now apply only inside the containers the players mount authored
markup into: the item player's `.pie-item-container` and
`.pie-passage-container`, and `<pie-print>`. That covers the bare `table`, `th`
and `h1`–`h6` rules and the framework-style names `.table*`, `.text-center`,
`.h1`–`.h6`, `.center`, `.indent` and `.under`. Until now the copy applied to
the whole document, so these rules restyled host UI that shares the names, such
as DaisyUI's and Bootstrap's `.table`. The confinement uses `:where()`, so
specificity is unchanged.

Rules keyed on PIE, KDS or MathJax names, or on legacy content classes such as
`.frac` and `.numbered-paragraph`, still apply document-wide. Elements portal
menus, popovers and modals to `<body>`, outside every player container, and
authored content there keeps KDS fractions and the MathJax glyph fixes. A rule
added to the stylesheet later is confined by default unless it requires one of
those names. A host copy of `components.css` is still detected and still takes
precedence.

The `.table` grid rules (`.table`, `.table-bordered`, `thead`, `tbody + tbody`)
now paint `--pie-text`, where they used a 15% mix of it. The mix measured 1.41:1
on white, short of the 3:1 SC 1.4.11 requires for a grid rule against the page.
`--pie-text` is held to 4.5:1 against the page, so the rules clear 3:1 on every
theme and scheme. Authored tables using these classes show text-coloured rules
where they showed faint grey ones.

Consumer impact: Host R's own DaisyUI tables took these rules through the
player's document-wide copy and would have turned black. The confined rules no
longer reach them. Host V loads its own copy, scoped to its item container. Its
item tables get the stronger rules once it upgrades `pie-theme`; until then they
keep the fixed `#dee2e6` grey used before 0.3.66.
