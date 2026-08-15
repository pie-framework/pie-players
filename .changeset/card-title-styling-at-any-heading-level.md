---
"@pie-players/pie-section-player": patch
---

Style the card title at whatever heading level the section player published.

Both cards render the title through `<svelte:element this={`h${level}`}>` and then
styled it as `.pie-section-player-content-card-header h2`. `base-heading-level`
defaults to 2, so the shipped default matched and the gap was invisible; a host
that published any other level — the reason the prop exists — got a title with the
browser's `h3` size and weight inside the card header, and no signal that it had
happened.

The selector takes `:is(h1, h2, h3, h4, h5, h6)`, which keeps the same specificity
as the type selector it replaces, so a host rule that already overrides the title
still wins exactly as before.
