---
"@pie-players/pie-item-player": patch
---

Move the backend delivery and authoring state machine out of `PieItemPlayer.svelte`
into `src/backend/orchestrator.svelte.ts`, and load the built-in pie-api transport
on demand.

No behaviour change. The custom-element surface — 45 props, the imperative
`loadFromBackend`/`saveSession`/`score`/`saveContent`/`releaseContent` methods, and
the `backend-*` event payloads and their emission order — is identical; the exported
methods are now one-line delegations to the orchestrator.

The component was carrying 233 lines of backend orchestration spread across most of
its length: two config/session overrides, five signature and generation counters,
three request-token race guards, four effects and the autosave debounce, none of
which render anything. `createBackendOrchestrator` owns that state and takes getters
over `backend`, the two configs, `env` and the session container plus three
callbacks — run the element-load pipeline, dispatch a player event, commit refreshed
models to the rendered elements. Those three callbacks are the whole DOM contract:
the module imports neither the renderer, the element loader nor the style scoping, so
the component keeps sole ownership of the DOM and the orchestrator is readable
without it. The config selectors stay statically imported, because the signature
computations that drive the effects are synchronous reads over the backend config
object.

`stableStringifyForKey` moves to `src/utils/stable-stringify.ts`: the component's
config and renderer keys and the orchestrator's session signatures have to agree on
what "unchanged" means, and a copy in each would let them drift.

`pie-api-client.ts` is dead weight for any host that supplies its own
`delivery.client`, and every call site was already async, so `delivery.ts` and
`authoring.ts` reach it through `await import("./pie-api-client.js")`. It leaves the
entry for its own chunk — the endpoint table, token resolution and fetch wrapper are
no longer in `dist/pie-item-player.js`. Not a meaningful size win at ~3 KB gzipped
against a 51 KB entry; it is the boundary that matters, in that the transport a host
has replaced is now provably unreferenced.

Covered by the existing backend unit tests and the backend delivery, section,
authoring-contract and authoring-media e2e specs.
