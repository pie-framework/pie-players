# Safe Custom Tool Configuration

`createToolsConfig()`, strictness, and the per-tool `sanitizeConfig` and
`validateConfig` hooks are documented in the
[assessment toolkit README](../../packages/assessment-toolkit/README.md#safe-custom-tool-configuration).
This page covers the two section-player concerns beside them.

## Registry on the layout

The coordinator's registry decides policy; a section player's toolbars render from
the layout's `toolRegistry` property, which defaults to the packaged registry. A
custom tool registered only with the coordinator passes policy and never renders,
so a section-player host also passes the registry to the layout:

```ts
layout.runtime = { ...(layout.runtime ?? {}), coordinator };
layout.toolRegistry = registry;
```

## Overlay safety in section-player

`enabled-tools` (the section-toolbar override) is normalized in section-player and validated in toolkit initialization. Per-region placement is configured directly on `tools.placement.{item,passage}` (or `runtime.tools.placement.{item,passage}`) and validated through the same path; `item-toolbar-tools` / `passage-toolbar-tools` aliases are not supported. Invalid IDs in any of these surfaces produce diagnostics (or throw in strict `error`).

## Related docs

- [framework-owned-error-handling.md](./framework-owned-error-handling.md)
- [assessment-toolkit README](../../packages/assessment-toolkit/README.md#safe-custom-tool-configuration)
