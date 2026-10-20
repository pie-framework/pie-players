---
"@pie-players/pie-players-shared": patch
---

Adds `pseudoLocalize` with the `en-XA` and `ar-XB` pseudo-locale tags to `@pie-players/pie-players-shared/i18n`. It transforms the English catalog at runtime into accented, bracketed strings padded roughly 40% longer, with every key, plural category and `{placeholder}` untouched, so truncation, concatenation and right-to-left layout faults surface in a demo or e2e run before any reviewer sees a real locale. A host registers the result through `customMessages`; nothing ships it as a catalog.
