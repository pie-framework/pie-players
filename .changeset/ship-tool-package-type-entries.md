---
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-tool-calculator-desmos": patch
"@pie-players/pie-tool-dictionary": patch
"@pie-players/pie-tool-picture-dictionary": patch
---

Make each tool package's root type entry describe what its root runtime entry actually provides. `insertTypesEntry` derives that entry from the bundle entry — a `.svelte` component — and overwrites the `index.d.ts` emitted from `index.ts`, so any package whose bundle entry is a component published a root entry that ignored its own `index.ts`.

Where `index.ts` re-exported *types*, they now ship: `@pie-players/pie-tool-dictionary` exports `DictionaryEntry`, `DictionaryLookup`, `DictionaryLookupRequest`, `DictionaryLookupResult` and `DictionarySense`; `@pie-players/pie-tool-picture-dictionary` exports `PictureLookup`, `PictureLookupRequest`, `PictureLookupResult` and `PictureResult`; `@pie-players/pie-tool-calculator-desmos` exports `CalculatorType`. Additive — no name changed, and nothing could import these before because they were never in a published tarball. A host supplying a dictionary or picture-dictionary endpoint can now type its response against the shape the tool reads, instead of declaring that shape itself.

Where `index.ts` re-exported a *value*, the re-export was removed instead. `@pie-players/pie-tool-answer-eliminator` re-exported `AdapterRegistry` from its root, but the root runtime entry is the built bundle, which exports the component and nothing named — so shipping that type export would have type-checked and then been `undefined` at run time. `AdapterRegistry` is reached through the `./adapters/adapter-registry` subpath, which its README now shows.
