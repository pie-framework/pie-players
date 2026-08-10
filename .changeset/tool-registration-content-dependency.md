---
"@pie-players/pie-assessment-toolkit": patch
---

`ToolRegistration.requiresAuthoredContent` lets a capability declare the authored content it needs, so nothing in core has to know which accommodation it is resolving.

Signing needs a catalog card, braille a transcription, authored SSML a `<speak>` in that item. This is the resource half of AfA's PNP/DRD pair, and it is intrinsic to the capability — unlike eligibility tier, which is a property of the program and belongs in policy configuration.

```ts
requiresAuthoredContent: {
  description: 'a sign-language catalog card on the item',
  resolve: ({ catalogResolver, ownerContext, item }) => findSigningCard(...) ?? null,
},
```

Two independent things follow from declaring it, and both were previously done by naming ids in core.

**Availability becomes grant AND content.** A host renders only when policy granted the feature *and* `resolve` returned something. Neither half implies the other and neither is a default, so a learner who has the accommodation still sees nothing on an item that carries no resource — no dead affordance on the overwhelming majority of items. `resolve`'s return value is handed straight back through `ToolSurfaceRenderContext.content`, and the host never inspects it; that is what keeps the host and the resolver from knowing which accommodation is in play.

**It is never granted wholesale.** `ToolRegistry.getContentDependentSupportIds()` is what a host filters a default grant list on, replacing the compile-time array of ids a host could not extend. A host adding its own accommodation gets the same guarantee by declaring the dependency — no change to our code.

Registration rejects a content dependency with no `pnpSupportIds` entry. That is what a host filters on, so declaring the dependency with nothing to filter would silently drop the second guarantee.

`getToolMetadata()` reports `requiresAuthoredContent` and the optional `description`, so a policy debugger can explain why an otherwise-granted capability is absent — the one question the grant trail alone cannot answer.

Scope note: the composition package still keeps `signLanguage` out of its universal preset by id, because the packaged registrations have not moved there yet. The declaration-driven assertion replaces that id check when they do.
