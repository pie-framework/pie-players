---
"@pie-players/pie-tool-ruler": patch
"@pie-players/pie-tool-protractor": patch
"@pie-players/pie-tool-line-reader": patch
"@pie-players/pie-tool-theme": patch
"@pie-players/pie-tool-text-to-speech": patch
"@pie-players/pie-tool-calculator-inline-desmos": patch
"@pie-players/pie-tool-answer-eliminator": patch
---

Re-register a tool with the coordinator when the coordinator instance changes,
so stacking and visibility keep working after a runtime-context republish.

Six tools registered once and never again. The guard was a `$state` boolean
flipped inside a tracked `$effect` — `if (coordinator && toolId && !registered)`
— so the first coordinator to arrive won permanently. The coordinator does not
arrive once: it is read from the runtime context (a prop, for text-to-speech),
and a republish hands over a new instance. After one, the tool's z-index layer,
`bringToFront` and visibility-restore were all still pointing at a coordinator
nobody consults, and the new one had never heard of the tool — so a ruler would
not raise above a protractor, and a tool hidden and reshown lost its position.
Teardown had the mirror fault: it unregistered `toolId` from whichever
coordinator happened to be current, which after a swap is not the one holding
the registration.

Each of the six now tracks the coordinator and id it actually registered
against, unregisters from that one before re-registering when either changes,
and unregisters from it on destroy. The bookkeeping moved from `$state` to plain
`let`, because a reactive write inside a tracked effect body is what AGENTS.md's
Svelte Subscription Safety section rules out; the effect is now idempotent and
compares stable identities rather than relying on a one-shot flag.

`pie-tool-answer-eliminator` already re-registered correctly and is unchanged in
behaviour. Its bookkeeping moves to plain `let` for the same reason, so all
seven tools now carry one pattern.

No public surface changes. A host that never republishes the runtime context
sees exactly what it saw before.
