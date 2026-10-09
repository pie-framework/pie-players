# Safe Custom Tool Configuration

Use the same normalization and validation contract in host apps, demos, and runtime updates so invalid tool config fails fast with actionable diagnostics.

Baseline safety is framework-owned: hosts do not need manual try/catch to avoid blank UI.

- `pie-assessment-toolkit` logs `[pie-framework:<kind>:<source>]` errors
- emits `framework-error`
- renders a built-in fallback panel for fatal initialization failures

Tool-config validation failures surfaced during owned coordinator construction
currently use `kind: "coordinator-init"` with tool-validation details in the
message payload.

## Recommended flow

1. Register packaged + custom tools in a `ToolRegistry`.
2. Build `tools` with `createToolsConfig(...)`.
3. Pass the resulting `config` into `ToolkitCoordinator`.
4. Keep strict enforcement at `error` so invalid config fails at boundary time.
5. Optionally listen for `framework-error` to add host-specific observability/UX.
6. Under a section player, also set the same registry as the layout's `toolRegistry` property.

```ts
import {
  createToolsConfig,
  ToolkitCoordinator
} from "@pie-players/pie-assessment-toolkit";
// The packaged capability set is composition, not core: the toolkit knows
// placement levels and precedence and no capability ids.
import {
  createPackagedToolRegistry,
  DEFAULT_TOOL_MODULE_LOADERS,
} from "@pie-players/pie-default-tool-loaders";

const registry = createPackagedToolRegistry({
  toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS,
});
registry.register(wordCounterToolRegistration);
registry.register(sectionMetaInfoToolRegistration);

const toolsResult = createToolsConfig({
  source: "host.custom-tools",
  strictness: "error",
  toolRegistry: registry,
  tools: {
    providers: {
      textToSpeech: {
        enabled: true,
        backend: "browser"
      }
    },
    placement: {
      section: ["sectionMetaInfo", "theme"],
      item: ["wordCounter", "calculator"],
      passage: ["wordCounter", "textToSpeech"]
    }
  }
});

const coordinator = new ToolkitCoordinator({
  assessmentId: "demo-assessment",
  toolRegistry: registry,
  tools: toolsResult.config,
  toolConfigStrictness: "error"
});
```

The coordinator's registry decides policy; a section player's toolbars render from
the layout's `toolRegistry` property, which defaults to the packaged registry. A
custom tool registered only with the coordinator passes policy and never renders,
so a section-player host also passes the registry to the layout:

```ts
layout.runtime = { ...(layout.runtime ?? {}), coordinator };
layout.toolRegistry = registry;
```

## Custom config hooks

A tool registration can declare hooks that enforce its own schema on its
`providers.<toolId>` entry, with or without a provider:

- `sanitizeConfig(config)` to normalize input.
- `validateConfig(config)` to return diagnostics.

This keeps core validation generic while allowing custom tools to define their own safety rules.

## Canonical keys

- TTS provider key: `providers.textToSpeech`.

## Overlay safety in section-player

`enabled-tools` (the section-toolbar override) is normalized in section-player and validated in toolkit initialization. Per-region placement is configured directly on `tools.placement.{item,passage}` (or `runtime.tools.placement.{item,passage}`) and validated through the same path; `item-toolbar-tools` / `passage-toolbar-tools` aliases are not supported. Invalid IDs in any of these surfaces produce diagnostics (or throw in strict `error`).

## Demo reference

See `apps/section-demos/src/routes/(demos)/custom-tools/+page.svelte` for the safe host pattern using `createToolsConfig(...)`.

## Related docs

- `docs/tools-and-accomodations/framework-owned-error-handling.md`
- `packages/assessment-toolkit/README.md` ("Safe Custom Tool Configuration")
