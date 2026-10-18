---
"@pie-players/pie-players-shared": patch
---

Numeric placeholder values in interface strings now render through `Intl.NumberFormat` for the active interface locale, so digits and grouping follow CLDR locale defaults: `ar` renders Arabic-Indic digits, `fr` groups with narrow no-break spaces, `en-US` with commas. Latin-script locales with counts under 1,000 render exactly as before, and string values are untouched. A host overriding strings through `customMessages` is unaffected.
