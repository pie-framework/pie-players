---
"@pie-players/pie-theme": patch
---

Stamp `color-scheme` from a resolved colour scheme, so native controls follow the
accommodation instead of the host's theme.

A scheme replaces every colour it participates in, but nothing in CSS infers
polarity from custom properties. UA-styled controls — `input` and `select` text,
scrollbars, native form widgets — paint from `color-scheme`, which stays whatever
the host's theme declared, because a scheme changes `data-color-scheme` and never
`data-theme`. A dark accommodation on a light host therefore renders those
controls in the light-mode system colour: measured at roughly 1.1:1 for two
version pickers on a `yellow-on-blue` page, black text on `#000066`. An
accommodation that leaves a control unreadable has not been delivered.

`resolvePieTheme` now reports the keyword the palette implies as
`ThemeResolution.colorScheme`, and `<pie-theme>` writes it to the target. Chosen
by whether black or white contrasts better against the resolved
`--pie-background`, which is the same test that picks a legible foreground
elsewhere in this package.

Only a resolved scheme decides it. Without one — including a requested scheme
that turned out unavailable — the value is `null` and the host keeps ownership,
because a host's stylesheet already declared the polarity of its own themes and
restating that from PIE's base palette would take the decision away from every
host that never asked for an accommodation. `null` restores rather than removes,
so clearing a scheme returns the host's own declaration instead of deleting it,
tracked through the same document baseline that already carries `data-theme`.

A background the resolver cannot read as an opaque colour also yields `null`: a
translucent value, a `var()` reference out to a host property, or the transparent
light base leave polarity dependent on the host's backdrop, which makes it the
host's call rather than a guess.
