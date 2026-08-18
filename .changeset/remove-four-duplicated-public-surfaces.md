---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-tool-calculator-desmos": patch
---

Remove four duplicated public surfaces. Each was audited against all three
consumer checkouts first; none of the removed names is consumed by any of them.

**The toolkit's forked `DesmosCalculatorProvider` is gone** from the
`./tools/client` subpath. `@pie-players/pie-calculator-desmos` owns that class,
and the toolkit's own runtime path already instantiated *its* copy — the fork was
reachable only as public API. The two were not interchangeable: the canonical
provider takes `initialize({ apiKey, proxyEndpoint, onTelemetry })` and documents
`proxyEndpoint` as the way to keep the key server-side, while the fork accepted
only `{ apiKey }` and otherwise read `process.env.DESMOS_API_KEY` or
`window.PIE_DESMOS_API_KEY`. So the published subpath offered the one variant with
no server-side key path, and a host serving a Desmos proxy endpoint could not use
it. `tool-calculator-desmos`'s setup docs now point at the canonical package and at
`proxyEndpoint` rather than at a bare key.

**`TTSToolConfig` is now defined in terms of `TTSRuntimeSettings`** instead of
redeclaring its 23 fields. They had drifted in both directions, which is how
`mathTokenHighlighting` came to be honoured at runtime while being unnameable on
the coordinator's public `ensureTTSReady` except through an index signature. It is
nameable now, along with `showSingleSpeedOption` — the change is additive on the
host-facing surface and removes nothing. It is an intersection rather than an
interface because `ToolConfig.provider` is `unknown` where the runtime settings
narrow it to the three provider ids, and an interface cannot inherit a member two
parents type differently.

**`AuthoringValidationResult` is re-exported from `pie-item-player`** rather than
redeclared there. The local copy widened `validatedModels` to `any[]` while
`validateModels()` is implemented against `players-shared`'s
`Array<PieModel & { validation?: unknown }>`, so a consumer typing against this
package lost the model typing the implementation actually returns. The name still
exports from here; only its precision changes.

**The `highlighter` capability is removed** from `default-tool-loaders`, along with
`highlighterToolRegistration`. It mounted `pie-tool-annotation-toolbar` through the
same loader as `annotationToolbar`, carried the same `"Highlighter"` name and
`highlighter` icon, and was placed at the same four levels, so an exhaustive host
rendered two identically-labelled buttons opening the same element. That collision
was already known: the placement test excluded `highlighter` from one preset by
hand.

No grant is lost. `annotationToolbarRegistration.pnpSupportIds` already accepted
all three of the removed capability's ids, and its three `universalSupportIds`
(`highlighter`, `textHighlight`, `annotation`) moved onto the surviving capability,
so a profile granted any of them still gets highlighting. What does change is that
annotation highlighting is now reached only through the selection gateway, not
additionally through a toolbar toggle. `PACKAGED_TOOL_ORDER` and
`PACKAGED_TOOL_PLACEMENT` lose the id, and their hand-written tuple casts were
corrected to match — left alone they would have declared a capability the runtime
arrays no longer contain.
