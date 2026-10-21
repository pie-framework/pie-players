---
"@pie-players/pie-item-list": patch
---

`<pie-item-summary>` takes an `i18n` provider and passes its provider to the expanded `<pie-item-player>`, so the player's chrome follows the row's `locale`. A failed locale load fires `framework-error`. The outer margins of authored stem, prompt, option and answer fragments no longer add to the view's own spacing.
