---
"@pie-players/pie-theme": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-calculator-cortex": patch
---

The content stylesheet no longer restyles a host page's own elements: the legacy content classes that are common words (`.abs`, `.variable`, `.whole`, `.noprint`, `.passage-title` and the rest) now match only inside `[data-pie-content]`, and only `kds-*`, `mjx-*`, `TEX-*` and `.frac` stay page-wide. Authored markup a host portals outside a `[data-pie-content]` subtree loses the confined rules.

The item player and the print player adopt the content stylesheet into the ShadowRoot they sit in, through the new `adoptContentStylesInto` in `@pie-players/pie-players-shared/ui/content-styles`, so content mounted in a host's shadow tree is styled. The NDS icon button loads when `ndsIcons` is on instead of at import. The toolkit's CSS highlight names are now `pie-tts-word`, `pie-tts-sentence` and `pie-annotation-<colour>`, and the colour-scheme registry is shared across module copies on a page like the provider registry. `check:event-names` fails on a new event outside the `pie-` namespace.
