---
"@pie-players/pie-assessment-toolkit": patch
---

Capabilities can render into a host surface instead of a toolbar: `activation: "region"`, a `surfaces` list, and a `renderSurface` hook on `ToolRegistration`.

Not every policy-addressable capability is a toolbar surface. A signed alternate renders as its own region beside item content, so a renderer that wants to show one has had to name `signLanguage` and its renderer directly — which is why a host cannot contribute an accommodation without a PR against this repo. The registry now answers "what can fill this slot" so a renderer never has to know.

## Contract

```ts
activation: "region"
surfaces: ["item-media"]
renderSurface(context: ToolSurfaceRenderContext): ToolSurfaceRenderResult | null
```

`ToolSurfaceRenderContext` carries the granted `featureId`, the policy `parameters`, the resolved content dependency, the surface name, and the same three services a toolbar tool reaches through `ToolbarContext` — coordinator, TTS, catalog resolver — and no more. A capability that needs anything else asks the coordinator. Passing the host's own component or state would make the registration depend on which renderer mounted it. `ToolSurfaceRenderResult` returns the element plus optional `ariaLabel`, `sync()` and `destroy()`.

Surface names belong to the host. Core defines none and validates only that a region capability claims at least one, so a host can open a new surface without a change here, and a capability can say which of a host's surfaces it fits. Discovery is `registry.getToolsBySurface(surface)`, in registration order — core has no basis for a precedence between two capabilities in one slot.

A capability can be both. The annotation toolbar is a toolbar button at item and passage level *and* a section-scoped singleton, so it carries `renderToolbar` and `renderSurface` together; declaring a surface does not remove it from the toolbar path.

## Additive, not a migration

`ToolActivation` gains `"region"` and keeps `"toolbar-toggle"` and `"selection-gateway"`. `icon` and `renderToolbar` become optional on `ToolRegistration` but stay *required for the two toolbar activations*, so every existing registration validates unchanged. A region registration with no `surfaces`, or a `renderSurface` with no surface to be found under, is rejected at registration: a surface renderer nothing can discover silently never renders, which is the failure mode this mechanism exists to remove.

`ToolToolbarButtonDefinition.icon` is now optional, matching what the renderers already did — `ToolButton.svelte` and `ItemToolBar.svelte` both guard on `button.icon`, and `ToolbarItem.icon` was already optional, so requiring it claimed a guarantee nothing relied on.

## Diagnostics

Naming a region capability in `placement.{section,item,passage}` is a new `tools.unplaceableActivation` error. It would never render there, and reporting it against the config is the difference between a diagnostic and an accommodation that is silently absent. `renderForToolbar` now throws with the activation named rather than failing on a missing method, because the caller's mistake is in placement config, not in the registration.

`getToolMetadata()` reports `surfaces`, which is the PNP debugger's region-placement column.
