---
"@pie-players/pie-theme": patch
---

Resolve provider variables from the theme being applied, so a theme change
reaches `--pie-*` on the first pass.

`<pie-theme>` read its provider before the new theme reached the target.
Provider adapters resolve by reading custom properties off that target —
daisyUI's `--color-*`, selected by `data-theme` — so a read taken while the
target still carried the outgoing theme returned the outgoing palette, and those
values were written as the new PIE token set. Every `--pie-*` landed one
selection behind.

Nothing corrected it afterwards. A host that writes only the attributes that
changed triggers one `attributeChangedCallback`, so the stale set stood until an
unrelated attribute moved, and switching again showed the theme before that one
rather than catching up. The visible result is an app whose own chrome repaints
instantly — daisyUI reads `data-theme` directly — while PIE content keeps the
palette of the theme the user just left.

The same read ran on first connect, where the target may carry no `data-theme`
at all and the provider resolves from whatever the page happens to inherit. A
host that stamps its stored theme before hydration escaped that; one that leaves
the first stamp to the element did not.

The incoming `data-theme` and `data-color-scheme` are now stamped on the target
before the read and restored immediately after. Restoring rather than leaving
them keeps two contracts intact: under `scope="document"` the ownership
arbitration decides whether this element may stamp at all, and the document
baseline needs the host's pre-existing value to have something to restore on
disconnect. Stamp and restore happen in one synchronous pass, so the transient
state is never painted.

`scope="self"` gains the behaviour it should always have had: a self-scoped host
resolves its own theme's palette rather than the ambient one, because the probe
stamps `data-theme` on the element the provider's rules match. A host with no
provider is unaffected — under `provider="none"`, or on a page with no daisyUI
palette, nothing resolves either way.
