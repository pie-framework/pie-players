# Safe Custom Tool Configuration

Use the same normalization and validation contract in host apps, demos, and runtime updates so invalid tool config fails fast with actionable diagnostics.

Baseline safety is framework-owned: hosts do not need manual try/catch to avoid blank UI.

- `pie-assessment-toolkit` logs `[pie-framework:<kind>:<source>]` errors
- emits `framework-error` (plus `runtime-error` for compatibility)
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

```ts
import {
  createPackagedToolRegistry,
  createToolsConfig,
  ToolkitCoordinator
} from "@pie-players/pie-assessment-toolkit";

const registry = createPackagedToolRegistry();
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

## Custom provider hooks

Custom tool registrations can add provider hooks to enforce tool-specific schema:

- `sanitizeConfig(config)` to normalize input.
- `validateConfig(config)` to return diagnostics.

This keeps core validation generic while allowing custom tools to define their own safety rules.

## Canonical keys

- TTS provider key: `providers.textToSpeech`.
- `providers.tts` is invalid and rejected by validation.

## Overlay safety in section-player

`enabled-tools`, `item-toolbar-tools`, and `passage-toolbar-tools` overlays are normalized in section-player and validated in toolkit initialization. Invalid IDs produce diagnostics (or throw in strict `error`).

## Demo reference

See `apps/section-demos/src/routes/(demos)/custom-tools/+page.svelte` for the safe host pattern using `createToolsConfig(...)`.

## Related docs

- `docs/tools-and-accomodations/framework-owned-error-handling.md`
- `packages/assessment-toolkit/README.md` ("Safe Custom Tool Configuration")
