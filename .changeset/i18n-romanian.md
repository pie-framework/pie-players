---
"@pie-players/pie-i18n-generated": patch
---

Add a Romanian generated locale. Registered under the bare `ro` tag so `ro`,
`ro-RO` and `ro-MD` all widen to it; standard Romanian as written in Romania,
with the imperative on controls and `tu` where a possessive is unavoidable,
comma-below diacritics, Romanian quotation marks, and all three CLDR plural
forms — `other` takes `de` before the noun (`20 de încercări`), and `102` is
`few` again. Enters as `generated` (unreviewed, freshness-gated) with a
terminology brief in `briefs/ro.md`; a Moldovan host overrides per key through
`customMessages`.
