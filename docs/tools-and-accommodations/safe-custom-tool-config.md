# Safe Custom Tool Configuration

This page is for section-player hosts that register custom tools. `createToolsConfig()`,
strictness, and the per-tool `sanitizeConfig` and `validateConfig` hooks are
documented in the
[assessment toolkit README](../../packages/assessment-toolkit/README.md#safe-custom-tool-configuration);
this page covers the two section-player concerns beside them.

## Registry on the layout

The coordinator's registry decides policy; a section player's toolbars render from
the layout's `toolRegistry` property, which defaults to the packaged registry. A
custom tool registered only with the coordinator passes policy and never renders,
so a section-player host also passes the registry to the layout:

```ts
layout.runtime = { ...(layout.runtime ?? {}), coordinator };
layout.toolRegistry = registry;
```

## Tool id validation

`enabled-tools`, the section-toolbar override, is normalized in the section
player and validated when the toolkit initializes. Item and passage placement
lives on `tools.placement.item` and `tools.placement.passage` (on a section
player, `runtime.tools.placement`) and is validated on the same path. Invalid
ids in any of them produce diagnostics, or throw under
`toolConfigStrictness: "error"`.

## Related docs

- [framework-owned-error-handling.md](./framework-owned-error-handling.md)
- [assessment-toolkit README](../../packages/assessment-toolkit/README.md#safe-custom-tool-configuration)
