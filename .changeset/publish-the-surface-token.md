---
"@pie-players/pie-theme": patch
---

Publish `--pie-surface` as a canonical, required Scheme Participant.

The raised-surface colour that `@pie-lib/drag`'s placeholder reads through
`color.surface()` was never declared by this package, so every consumer fell
through to the hardcoded `#E0E1E6` in `pie-lib` — a light grey that stayed light
grey on the dark, high-contrast, and coloured schemes. It now resolves from the
theme, tracking the dropdown surface tint rather than the page colour, so a
raised surface keeps its edge against `--pie-background` on every scheme.

Declared in the light and dark Base Themes and all ten built-in schemes, mapped
from DaisyUI `base-300`, and recorded in `token-registry.json` as
`canonical-semantic` / `surface`. A host that was already setting
`--pie-surface` keeps its override; a host that was not now inherits a
scheme-correct value where it previously got `pie-lib`'s constant.
