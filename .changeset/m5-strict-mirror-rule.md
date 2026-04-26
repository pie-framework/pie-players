---
'@pie-players/pie-section-player': major
'@pie-players/pie-assessment-toolkit': major
---

Lock the **strict mirror rule** across the section-player layout custom
elements and `pie-assessment-toolkit` configuration surface (M5 of the
Coherent Options Surface track).

## What's new

- Every tier-1 configuration knob now obeys the same shape:

  ```
  kebab-attribute  ↔  camelCaseProp  ↔  runtime.<sameCamelCaseKey>
  ```

  `runtime.<key>` always wins; the top-level prop/attribute is the
  fallback; the documented default is last. One central `pick(...)` slot
  in `resolveRuntime` (in
  `packages/section-player/src/components/shared/section-player-runtime.ts`)
  resolves every key — no per-feature special-casing.

- `RuntimeConfig` carries the runtime-tier mirrors that are actually
  consumed by the kernel/scaffold/toolkit: `assessmentId`, `playerType`,
  `player`, `lazyInit`, `tools`, `accessibility`, `coordinator`,
  `createSectionController`, `isolation`, `env`, `toolConfigStrictness`,
  `enabledTools`, `onFrameworkError`, `onStageChange`, `onLoadingComplete`.

- New tier-1 props on the layout custom elements
  (`<pie-section-player-splitpane>`, `<pie-section-player-vertical>`,
  `<pie-section-player-tabbed>`, `<pie-section-player-kernel-host>`,
  `<pie-section-player-base>`):
  - `tool-config-strictness` ↔ `toolConfigStrictness` ↔
    `runtime.toolConfigStrictness`
  - `enabled-tools` ↔ `enabledTools` ↔ `runtime.enabledTools`

- `<pie-assessment-toolkit>`: `enabledTools` is the canonical tier-1
  shorthand for `tools.placement.section`; the `enabled-tools` attribute
  mirrors it. `view` is removed (was unused) and the `accessibility`
  attribute mapping is removed (the prop remains).

- Two new CI guardrails on the section-player package:
  - `tests/m5-mirror-rule.test.ts` parses every layout CE source and
    asserts every `RuntimeConfig` key is declared as a prop, every
    declared kebab attribute matches camelCase-to-kebab, and the runtime
    tier is actually read by a consumer (either `runtime?.<key>` /
    `effectiveRuntime?.<key>` or via a dedicated resolver helper). The
    key list is derived directly from the `RuntimeConfig` type, so
    adding a key without wiring its consumer fails CI.
  - `tests/section-player-runtime.test.ts` adds parametrized per-key
    precedence tests over `resolveRuntime`.

## Documented exceptions to the mirror rule

The following tier-1 surfaces have **no** `runtime.<key>` mirror by
design; the resolver does not see them:

- Identity (`section-id`, `attempt-id`, `section`): per-attempt host
  state, not configuration.
- Layout-only shell knobs (`show-toolbar`, `toolbar-position`,
  `narrow-layout-breakpoint`, `split-pane-collapse-strategy`,
  `content-max-width-no-passage`, `content-max-width-with-passage`,
  `split-pane-min-region-width`, `iife-bundle-host`, `debug`):
  layout-CE rendering / preload-host concerns. Each is a top-level
  prop / kebab attribute on the layout CE that owns it.
- Layout-shell host data (`policies`, `hooks`, `toolRegistry`,
  `sectionHostButtons`, `itemHostButtons`, `passageHostButtons`):
  consumed by the layout kernel through its top-level prop, not via
  `runtime`. They pass straight through to the kernel/scaffold and
  are not part of the two-tier mirror.
- Deprecated aliases (`item-toolbar-tools`, `passage-toolbar-tools`):
  kept as props for back-compat but absorbed at the CE boundary into
  the canonical surface (`tools.placement`).

## Deprecations

- `<pie-assessment-toolkit>`'s `view` prop and `accessibility` attribute
  mapping are removed (the `accessibility` property remains).

## Migration

For configuration that lives in `RuntimeConfig` (the canonical mirror
list above), the runtime form is preferred for hosts that compose
configuration in a single typed object:

```ts
// before (still works for all of these)
el.setAttribute("tool-config-strictness", "warn");
el.setAttribute("enabled-tools", "highlight,note");

// after (preferred for composed configuration)
el.runtime = {
  toolConfigStrictness: "warn",
  enabledTools: "highlight,note",
  onFrameworkError: (model) => console.error(model),
};
```

`runtime.<key>` always wins over the top-level attribute when both are
set.

The layout-only knobs listed under "Documented exceptions" stay on the
top-level prop / kebab attribute (e.g. `content-max-width-no-passage`,
`iife-bundle-host`, `debug`) — there is no runtime mirror for them.
