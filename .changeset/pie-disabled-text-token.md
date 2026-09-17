---
"@pie-players/pie-theme": patch
---

Publish `--pie-disabled-text`: a canonical token for text that is disabled but still has to be read

`--pie-disabled` is a state fill, correctly held to the 3:1 non-text minimum. Text that
is disabled but still has to be read - a non-editable label rather than a control - has
had no token to take, so it borrows that fill and lands under the 4.5:1 text minimum:
measured against `--pie-background`, `--pie-disabled` is below 4.5:1 in seven of the
twelve palettes, the default light theme among them at 3.95:1.

Registered like `--pie-dropdown-background` - canonical, required of every scheme, with a
value in both base themes and all ten built-in schemes. Each value is derived from that
palette's own text and background: the largest step toward the background that still
clears 5:1, so the dimming stays visible where the palette has room for it and gives up
dimming rather than contrast where it does not. A palette that omits the token falls back
through canonical `--pie-text`.
