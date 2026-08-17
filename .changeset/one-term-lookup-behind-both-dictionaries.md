---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-tool-dictionary": patch
"@pie-players/pie-tool-picture-dictionary": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
---

One term-lookup implementation behind both dictionaries, and three defaults that no longer need a host to know about them.

The two dictionaries shipped as near-copies: term normalisation and the headword guard were character-identical, the POST clients differed only in error strings, and each panel carried its own copy of the same state machine. That is now one module, `@pie-players/pie-players-shared/tools/term-lookup`, and each tool supplies only what a result of its own carries — an entry, or a picture. The subtle part, a superseded lookup not overwriting the newer one's state, exists once and is tested once. A lookup result is `{ status, items }` rather than `entries`/`pictures`.

**An endpoint alone is now the whole configuration.** The client sent `credentials: "omit"` and documented `headers` as the way to authorise, but `headers` was unreachable: the element exposed no such property and the factory taking it was never exported. A host that put its dictionary route behind the assessment's own session — which the tool host contract asks for — got a 401 on every lookup and a learner-facing "the dictionary is unavailable (401)". Endpoints are called `same-origin`, so that route answers with nothing further configured; `headers` and `credentials` are now real properties for a host authorising some other way, and neither is required.

**Plain `http:` picture URLs are refused.** The validator accepted `https?:` while its own comment said anything else with a scheme was refused, so `http://cdn.example/cat.png` reached `src` and was mixed-content-blocked on every https deployment — the broken image the guard exists to prevent. Protocol-relative and same-origin paths still pass, and "same-origin" is now checked by resolving rather than by looking for a leading slash: `/\evil.example/x.png` looks like a path and resolves to another host, because a backslash is a path separator for special schemes and a tab is stripped outright. Both still resolve to https, so neither defeated the mixed-content guard — but same-origin is what the function claims.

**A requested term is answered once per request, not once per term.** Params reach a tool through a seam reapplied on every sync, so the term alone cannot distinguish a re-render from a fresh ask. Keyed on the panel's last search, every reopen re-issued the selection that opened it and discarded the word the learner had typed since. Requests now carry a `termRequestId`, which both dictionary panels accept as an optional property; a host assigning `term` directly can leave it unset and gets term identity, enough to stop a re-render re-issuing.

**A tool-open request falls back off section scope.** Requests defaulted to `"section"` and resolved only there, so a host placing a capability at item scope only had the selection action silently vanish: the tool was granted, hosted and visible, with no action on the selection and nothing to say why. Resolution now prefers section scope and falls back to any level that hosts the capability. Naming a level in the request still makes it a constraint, honoured strictly.

Both panels' effects now write their reactive state under `untrack`, matching the rule AGENTS.md sets for effect bodies that read what they write. `check:capability-neutrality` gained `dictionary` and `pictureDictionary`, so its guard covers the packaged set its own comment claims to track.

Also: `requestTool`, `canRequestTool`, `registerToolRequestTarget` and `onToolRequestTargetsChange` are optional on `ToolkitCoordinatorApi`. They were declared required while both call sites duck-typed them away for a host coordinator predating the seam, which made such a coordinator structurally non-conformant for no benefit. Both dictionary packages dropped two declared dependencies that nothing imported.
