---
"@pie-players/pie-i18n-generated": patch
---

The remaining roadmap waves land, fifteen locales in one tier expansion — the tier is now **thirty-six reviewed catalogs**.

**Big US wave**: Russian (`ru`, Slavic one/few/many/other with numeral rules verified against sampled `Intl.PluralRules`), Filipino (`fil`, CLDR `fil` categories verified programmatically; exam register with deliberate homonym rejections — `regla` and `lupa` rejected), Haitian Creole (`ht`, reformed orthography, generic-`ou` impersonal).

**Second RTL wave**: Urdu (`ur`), Persian (`fa`, full ZWNJ orthography), Hebrew (`he`, the wave's only CLDR `two` category, geresh/gershayim conventions pinned). These inherit the audited RTL layout contract — no new layout work.

**Script variant**: `zh-Hant` — Taiwan-register Traditional Chinese authored from `en-US`, deliberately **not** a character conversion of the Simplified catalog, with the term divergences from a naive conversion (軟體/資訊/網路/朗讀…) documented in the brief. Regional tag: bare `zh` stays Simplified; `zh-TW`/`zh-HK` widen onto it.

**State/regional wave**: Somali (`so`), White Hmong (`hmn`, RPA orthography, CLDR-undersourced), Khmer (`km`), Lao (`lo`), Bengali (`bn`), Punjabi (`pa`, Gurmukhi; Shahmukhi documented out of scope), Nepali (`ne`, Devanagari numerals pinned deliberately), Amharic (`am`, Ethiopic punctuation). Each brief carries a **Terminology confidence** section listing judgment calls made without strong evidence, and those README rows state that native review is strongly advised.

All fifteen carry agent generation-and-review provenance in the manifest and English snapshots — regeneration is surgical from here.
