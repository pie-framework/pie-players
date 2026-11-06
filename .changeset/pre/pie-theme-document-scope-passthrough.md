---
"@pie-players/pie-theme": patch
---

A document-scoped `<pie-theme>` with a `theme` attribute no longer redeclares the Base Theme for its subtree when `tokens.css` is loaded. The stylesheet matched the element itself, so content inside it kept Base Theme values under an active color scheme, `--pie-fixed-hue-collapse` among them. Host A, which loads `tokens.css` beside a document-scoped element, can drop its `inherit` resets for this case.
