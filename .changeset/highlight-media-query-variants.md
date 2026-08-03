---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-annotation-toolbar": patch
---

Restore dark-mode, high-contrast, print, and reduced-motion styling for TTS and annotation highlights.

`HighlightCoordinator` injects the `::highlight()` rules for TTS read-along and
student annotations. A second copy of those rules also existed as
`packages/tool-annotation-toolbar/highlights.css`, imported with a plain CSS
import that never reached the page: the package builds with Vite in library
mode, so the import was extracted to a `dist` stylesheet the built JS never
referenced and no `exports` entry exposed.

The two copies had diverged in both directions. The injected copy had gained
newer TTS work (`--pie-tts-line-highlight`, element-level fallbacks, an orange
swatch) while never having the media-query blocks the file carried. So at runtime
annotation highlights had no dark-mode or high-contrast treatment, printing did
not strip transient TTS highlighting or convert annotation fills to underlines,
and reduced-motion did not drop highlight text shadows.

Those blocks now live with the rules they modify, covering all five annotation
swatches including orange. Two corrections were made rather than copying the old
file forward:

- The recovered stylesheet used `@media (prefers-contrast: high)`. `high` is not
  a valid value for that feature (the keywords are `no-preference`, `more`,
  `less`, `custom`), so an invalid query evaluates to `not all` and the block
  could never have matched in any browser even had the file loaded. It is now
  `more`.
- The TTS dark-mode and high-contrast blocks were dropped rather than restored.
  They varied only a `var()` fallback, and `applyAdaptiveTTSStyle()` writes
  `--pie-tts-*` inline on `documentElement` on every paint, so those fallbacks
  can never apply. TTS contrast adaptation is handled by that adaptive path.

`highlights.css` and its dead import are removed. Its `.pie-sr-only` and
focus-visible rules were already defined in the toolbar component's own `<style>`
block, where they do take effect.
