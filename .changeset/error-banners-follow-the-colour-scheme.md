---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-theme": patch
---

Fold the player error banners into the palette when a colour scheme asks for one.

The three banners — two in `players-shared`'s `PieItemPlayer`, one in
`pie-item-player` — were painted with a pinned `#d32f2f` edge, `#ffebee` fill and
`#c62828` ink. That was never a contrast failure, since fill and ink were pinned
together and measure about 6.2:1 wherever they render. It was a palette failure: a
learner on White on Black or Yellow on Navy met a pale pink box in the middle of
the scheme they chose in order to be able to read the screen.

All three now use `--pie-fixed-hue-collapse`, exact at 0% for every Base Theme and
folded at 100% for every scheme. The collapsed ink is `--pie-text`, not
`--pie-incorrect`: the error hue against this tint drops to 4.14:1 under Black on
White, where the page's own ink holds at 6.18:1 or better on all ten schemes. That
pair is now a declared contrast relationship, `incorrect feedback surface text`, so
`assertCanonicalThemeDefinitions` keeps it true for any scheme added later rather
than it having been measured once.

`--pie-incorrect-secondary` is a tint of the page, roughly 1.1:1 from it, so the
collapsed banner reads as a banner by its `--pie-incorrect` edge — which clears
4.53:1 against every scheme's page. This is the division of labour the periodic
table's collapsed cells already rely on.

The colours moved out of the inline `style` attributes into each component's
`.pie-player-error` rule. An inline declaration outranks any stylesheet, so a host
could not have restyled the banner without `!important`; it now behaves like the
rest of the players' chrome.
