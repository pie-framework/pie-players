---
"@pie-players/pie-tool-calculator-desmos": patch
"@pie-players/pie-tool-dictionary": patch
"@pie-players/pie-tool-picture-dictionary": patch
---

Ship the type exports these packages' entrypoints already declared. `insertTypesEntry` derived each package's types entry from its bundle entry — a `.svelte` component with no declarations — and wrote `export {}` over the `index.d.ts` emitted from `index.ts`, so every package advertised `dist/index.d.ts` and shipped nothing in it. `@pie-players/pie-tool-dictionary` now exports `DictionaryEntry`, `DictionaryLookup`, `DictionaryLookupRequest`, `DictionaryLookupResult` and `DictionarySense`; `@pie-players/pie-tool-picture-dictionary` exports `PictureLookup`, `PictureLookupRequest`, `PictureLookupResult` and `PictureResult`; `@pie-players/pie-tool-calculator-desmos` exports `CalculatorType`. Additive — no name changed, and no consumer could import these before because they were never in a published tarball. A host supplying a dictionary or picture-dictionary endpoint can now type its response against the shape the tool reads.
