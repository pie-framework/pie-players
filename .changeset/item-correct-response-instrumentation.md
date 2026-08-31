---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

`pie-item-player` now reports when correct responses are populated.

`add-correct-response`, `env` and `mode` are public attributes on
`<pie-item-player>`, so any page script can set them, and `populateCorrectResponses`
escalates internally to `role: "instructor"` to generate the answers. With the
default `hosted={false}`, the player loads a `client-player.js` bundle, so the
controllers and the answer key are in the browser. A learner can therefore reveal
correct answers from the console.

No gate is added, because none is available at this layer. A legitimate preview
(`mode="view"`, `role="student"`, controllers client-side — a shape real hosts
ship) is indistinguishable from a tampered delivery from inside the player, so
any check strict enough to stop the second breaks the first. In-page code has
full authority over in-page state; the boundary is `hosted="true"` /
`player.js`, which keeps the controllers and the answer key server-side.

What is available is detection. The player now emits
`correct-responses-populated` whenever correct responses actually reach the
session, carrying `itemId`, `mode`, `role`, `bundleType`, `populatedCount` and
the `config.models[].element` names — never session entries, since those hold the
answers and this payload reaches a host's telemetry provider. A host that did not request correct
responses in that context can treat the event as tampering and act server-side.

The item player also gains the instrumentation bridge the section, toolkit and
assessment players already have; it previously resolved an instrumentation
provider only to pass it to the loader, so nothing it emitted itself reached
telemetry. `ITEM_INSTRUMENTATION_EVENT_MAP` maps this one event to
`pie-item-correct-responses-populated`. The item player's other events stay off
the bridge deliberately: `session-changed` carries learner responses, and
forwarding response data to telemetry by default is a host's decision.

Additive. No existing event, attribute or default changes.
