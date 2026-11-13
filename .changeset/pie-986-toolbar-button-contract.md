---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-tool-calculator-shared": patch
"@pie-players/pie-theme": patch
---

Toolbar buttons follow one appearance contract (PIE-986).

- Under `ndsIcons`, every packaged tool's toolbar button now renders as `<pie-nds-icon-button>`, not only the calculator's: `pie-default-tool-loaders` gives each built-in icon name a FontAwesome glyph, so the toolbar is no longer a mix of circular NDS buttons and square framework buttons. The protractor takes `compass-drafting`, since FontAwesome draws no protractor.
- An open tool's NDS toolbar button is now visibly on. The `tertiary` variant painted on and off alike, so the open state reached assistive tech only (WCAG 1.4.1, 1.4.11); it now takes the fill and glyph the plain button's on state paints.
- The toolbar's on state, plain and NDS, honours `--pie-tool-trigger-active-background`, `-color` and `-border-color`, the hooks the inline TTS and calculator triggers already honour, so a host styles every open tool with one set. Unset, it paints what it painted before. Hovering an open plain button no longer swaps its glyph to the off-state hover colour.
- The inline TTS trigger's open-state accent hook now applies under `ndsIcons`: its rule keyed off `aria-expanded` on the host, which only the inner button carries, so it never matched.
- The inline calculator trigger's border and ink read `--pie-button-border` and `--pie-button-color` ahead of `--pie-border` and `--pie-text`, like the toolbar's buttons, and its hover glyph follows `--pie-button-hover-color` through the theme instead of a fixed `#667eea`. A host that sets the button tokens now restyles this trigger with the toolbar; one that set only `--pie-border` or `--pie-text` sees it follow the button tokens instead. Of the recorded hosts, one sets `--pie-button-border`, `--pie-button-color`, `--pie-border` and `--pie-text`, so its trigger border and ink move to its button values, matching its toolbar; the other sets both pairs to `inherit` under a colour scheme, so it is unaffected. The trigger fill keeps reading `--pie-button-background-color` ahead of `--pie-button-bg`, the order a recorded host's `initial` override relies on.
- The vendored NDS icon button is refreshed to NDS `v5.6.0` by a new `bun run sync:nds-icon-button` script, which builds it from an NDS checkout with this repository's toolchain and applies PIE's patches. The button now forwards `button-aria-pressed`, `expanded` and `controls` to its inner `<button>` itself, so the toolbar and the inline TTS trigger stop mirroring them by hand.
