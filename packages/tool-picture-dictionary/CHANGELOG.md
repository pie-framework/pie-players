# @pie-players/pie-tool-picture-dictionary

## 0.3.70

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.70

## 0.3.69

### Patch Changes

- e66efff: Make each tool package's root type entry describe what its root runtime entry actually provides. `insertTypesEntry` derives that entry from the bundle entry — a `.svelte` component — and overwrites the `index.d.ts` emitted from `index.ts`, so any package whose bundle entry is a component published a root entry that ignored its own `index.ts`.
  
  Where `index.ts` re-exported *types*, they now ship: `@pie-players/pie-tool-dictionary` exports `DictionaryEntry`, `DictionaryLookup`, `DictionaryLookupRequest`, `DictionaryLookupResult` and `DictionarySense`; `@pie-players/pie-tool-picture-dictionary` exports `PictureLookup`, `PictureLookupRequest`, `PictureLookupResult` and `PictureResult`; `@pie-players/pie-tool-calculator-desmos` exports `CalculatorType`. Additive — no name changed, and nothing could import these before because they were never in a published tarball. A host supplying a dictionary or picture-dictionary endpoint can now type its response against the shape the tool reads, instead of declaring that shape itself.
  
  Where `index.ts` re-exported a *value*, the re-export was removed instead. `@pie-players/pie-tool-answer-eliminator` re-exported `AdapterRegistry` from its root, but the root runtime entry is the built bundle, which exports the component and nothing named — so shipping that type export would have type-checked and then been `undefined` at run time. `AdapterRegistry` is reached through the `./adapters/adapter-registry` subpath, which its README now shows.
- @pie-players/pie-players-shared@0.3.69

## 0.3.68

### Patch Changes

- d68c01b: Add dictionary and picture dictionary tools, and make the shell's focus trap
  shadow-aware so a hosted tool's own controls are reachable by keyboard.
  
  `pie-tool-dictionary` and `pie-tool-picture-dictionary` are floating panels opened from
  the toolbar, each with a term field and a results area. Neither ships an endpoint: the
  corpus behind a dictionary is licensed per programme, so a host supplies one through
  `endpoint` for the built-in POST shaping, or assigns the element's `lookup` property to
  use its own client. With neither, the panel says no service is configured rather than
  offering a field that fails silently.
  
  Neither declares a universal support id. A dictionary is a granted accommodation, and on
  a vocabulary item it is construct-relevant, so handing it to every learner by default
  would change what the item measures.
  
  Both accept a `term` from whatever selection affordance a host offers, and neither
  depends on one. A sighted keyboard-only learner cannot originate a text selection in
  non-editable content — Chromium does not extend one with Shift+Arrow there without caret
  browsing, an OS toggle absent on mobile — so a selection-only dictionary is unreachable
  for them. The panel's field is the keyboard route, which is why it exists.
  
  That route did not work until the focus trap was fixed. `createFocusTrap` collected
  focusables with `querySelectorAll`, which stops at a shadow boundary; every tool in this
  repo renders into `shadow: "open"`, so the trap saw only the shell's own chrome. Tab
  cycled those nine controls and the hosted tool's content was unreachable by keyboard
  entirely — for the calculator, graph, periodic table and theme panels as much as for
  these two. Collection now descends into open shadow roots, and skips `tabindex="-1"`,
  which belongs to programmatic focus rather than the tab order.
  
  A lookup distinguishes "no entry for this word" from "the service did not answer",
  because collapsing them tells a learner their word is not real when the network is down.
  A term longer than four words is refused without a request. Picture URLs that are not
  `https:`, protocol-relative, or same-origin are dropped rather than rendered, and a
  picture's caption becomes its `alt` — the picture is the definition, so it is never
  decorative.
  
  Covered by unit tests over the lookup and focus-collection logic, and by
  `packages/section-player/tests/section-dictionary-tools.spec.ts`, which drives the tool
  from the keyboard alone in a browser.
- 1d9f2d3: One term-lookup implementation behind both dictionaries, and three defaults that no longer need a host to know about them.
  
  The two dictionaries shipped as near-copies: term normalisation and the headword guard were character-identical, the POST clients differed only in error strings, and each panel carried its own copy of the same state machine. That is now one module, `@pie-players/pie-players-shared/tools/term-lookup`, and each tool supplies only what a result of its own carries — an entry, or a picture. The subtle part, a superseded lookup not overwriting the newer one's state, exists once and is tested once. A lookup result is `{ status, items }` rather than `entries`/`pictures`.
  
  **An endpoint alone is now the whole configuration.** The client sent `credentials: "omit"` and documented `headers` as the way to authorise, but `headers` was unreachable: the element exposed no such property and the factory taking it was never exported. A host that put its dictionary route behind the assessment's own session — which the tool host contract asks for — got a 401 on every lookup and a learner-facing "the dictionary is unavailable (401)". Endpoints are called `same-origin`, so that route answers with nothing further configured; `headers` and `credentials` are now real properties for a host authorising some other way, and neither is required.
  
  **Plain `http:` picture URLs are refused.** The validator accepted `https?:` while its own comment said anything else with a scheme was refused, so `http://cdn.example/cat.png` reached `src` and was mixed-content-blocked on every https deployment — the broken image the guard exists to prevent. Protocol-relative and same-origin paths still pass, and "same-origin" is now checked by resolving rather than by looking for a leading slash: `/\evil.example/x.png` looks like a path and resolves to another host, because a backslash is a path separator for special schemes and a tab is stripped outright. Both still resolve to https, so neither defeated the mixed-content guard — but same-origin is what the function claims.
  
  **A requested term is answered once per request, not once per term.** Params reach a tool through a seam reapplied on every sync, so the term alone cannot distinguish a re-render from a fresh ask. Keyed on the panel's last search, every reopen re-issued the selection that opened it and discarded the word the learner had typed since. Requests now carry a `termRequestId`, which both dictionary panels accept as an optional property; a host assigning `term` directly can leave it unset and gets term identity, enough to stop a re-render re-issuing.
  
  **A tool-open request falls back off section scope.** Requests defaulted to `"section"` and resolved only there, so a host placing a capability at item scope only had the selection action silently vanish: the tool was granted, hosted and visible, with no action on the selection and nothing to say why. Resolution now prefers section scope and falls back to any level that hosts the capability. Naming a level in the request still makes it a constraint, honoured strictly.
  
  Both panels' effects now write their reactive state under `untrack`, matching the rule AGENTS.md sets for effect bodies that read what they write. `check:capability-neutrality` gained `dictionary` and `pictureDictionary`, so its guard covers the packaged set its own comment claims to track.
  
  Also: `requestTool`, `canRequestTool`, `registerToolRequestTarget` and `onToolRequestTargetsChange` are optional on `ToolkitCoordinatorApi`. They were declared required while both call sites duck-typed them away for a host coordinator predating the seam, which made such a coordinator structurally non-conformant for no benefit. Both dictionary packages dropped two declared dependencies that nothing imported.
- 2cda539: Read `image` as an alias for `url` in a picture-dictionary response, so a service that
  names the URL that way answers the packaged panel with no host resolver.
  
  A picture service may answer `{ images: [{ image }] }`, one signed object-storage URL per
  entry. The panel already accepted `images` as the array key and already POSTs
  `{ keyword, language?, max? }`, so the field naming the URL was the only thing standing
  between such a service and the packaged panel. An entry the item reader rejects is
  dropped rather than failing the response, so every lookup resolved to zero usable
  pictures and the panel reported "no picture": the learner was told their word has no
  entry when the service had answered with several.
  
  A usable `url` still wins when a payload carries both names — an empty one is an absence
  rather than a preference, so the alias still gets its turn — and the URL guard is
  unchanged: an unsafe value under `image` is dropped on the same terms, so this widens
  which payloads are readable and not which URLs are renderable.
- Updated dependencies [2d8ce6a]
- Updated dependencies [27284f8]
- Updated dependencies [d68c01b]
- Updated dependencies [3f5e968]
- Updated dependencies [67f286c]
- Updated dependencies [55016b5]
- Updated dependencies [fc71c91]
- Updated dependencies [00b8a71]
- Updated dependencies [6e1e053]
- Updated dependencies [e94b097]
- Updated dependencies [7c9fb28]
- Updated dependencies [979e643]
- Updated dependencies [1d9f2d3]
- Updated dependencies [54742db]
- Updated dependencies [cb11691]
  - @pie-players/pie-players-shared@0.3.68
