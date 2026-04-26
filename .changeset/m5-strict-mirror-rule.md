---
'@pie-players/pie-section-player': minor
'@pie-players/pie-assessment-toolkit': minor
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

- `RuntimeConfig` widened so every reachable tier-1 knob has a runtime
  mirror. New entries: `enabledTools`, `toolRegistry`, `policies`,
  `hooks`, `sectionHostButtons`, `itemHostButtons`, `passageHostButtons`,
  `iifeBundleHost`, `debug`, `contentMaxWidthNoPassage`,
  `contentMaxWidthWithPassage`, `splitPaneMinRegionWidth`,
  `toolConfigStrictness`, `onFrameworkError`.

- New tier-1 props on the layout custom elements
  (`<pie-section-player-splitpane>`, `<pie-section-player-vertical>`,
  `<pie-section-player-tabbed>`, `<pie-section-player-kernel-host>`,
  `<pie-section-player-base>`):
  - `tool-config-strictness` ↔ `toolConfigStrictness` ↔
    `runtime.toolConfigStrictness`
  - `policies` (object property) ↔ `runtime.policies`
  - layout dimension knobs (`content-max-width-no-passage`,
    `content-max-width-with-passage`, `split-pane-min-region-width`)
    now also reachable via `runtime.<key>`

- `<pie-assessment-toolkit>`: `enabledTools` is the canonical tier-1
  shorthand for `tools.placement.section`; the `enabled-tools` attribute
  mirrors it. `view` is removed (was unused) and the `accessibility`
  attribute mapping is removed (the prop remains).

- Two new CI guardrails on the section-player package:
  - `tests/m5-mirror-rule.test.ts` parses every layout CE source and
    asserts every `RuntimeConfig` key is declared as a prop, and every
    declared kebab attribute matches camelCase-to-kebab.
  - `tests/section-player-runtime.test.ts` adds parametrized per-key
    precedence tests over `resolveRuntime`.

## Documented exceptions to the mirror rule

The following tier-1 surfaces have **no** `runtime.<key>` mirror by
design; the resolver does not see them:

- Identity (`section-id`, `attempt-id`, `section`): per-attempt host
  state, not configuration.
- Layout-only shell knobs (`show-toolbar`, `toolbar-position`,
  `narrow-layout-breakpoint`, `split-pane-collapse-strategy`):
  layout-CE rendering concerns.
- Deprecated aliases (`item-toolbar-tools`, `passage-toolbar-tools`,
  `framework-error-hook`): kept as props for back-compat but absorbed
  at the CE boundary into the canonical surface (`tools.placement`,
  `onFrameworkError`).

## Deprecations

- `<pie-assessment-toolkit>`'s `view` prop and `accessibility` attribute
  mapping are removed (the `accessibility` property remains).
- The `frameworkErrorHook` alias continues to be accepted (deprecated
  since M3); migrate to `onFrameworkError`.

## Migration

If you were setting layout dimensions via top-level props, both forms
work — the runtime form is now preferred for hosts that compose
configuration in a single typed object:

```ts
// before (still works)
el.setAttribute("content-max-width-no-passage", "800");
el.setAttribute("split-pane-min-region-width", "240");

// after (preferred for composed configuration)
el.runtime = {
  contentMaxWidthNoPassage: 800,
  splitPaneMinRegionWidth: 240,
  toolConfigStrictness: "warn",
  enabledTools: "highlight,note",
};
```

`runtime.<key>` always wins over the top-level attribute when both are
set.
