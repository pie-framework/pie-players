# Tool Provider System

This guide describes the current tool-provider integration model for `pie-players`.

For the authoritative registry details, see `packages/assessment-toolkit/docs/TOOL_REGISTRY.md`.

## Overview

The tool-provider system is centered on `ToolkitCoordinator`.

- The host creates one `ToolkitCoordinator` for the assessment surface.
- Tool placement lives under `tools.placement`.
- Tool-specific runtime config lives under `tools.providers`.
- The section player receives the coordinator through the `coordinator` property.
- Item- and passage-level tool rendering is derived from the section-player runtime, not wired manually per card.

Use this document together with:

- [`../architecture/architecture.md`](../architecture/architecture.md)
- [`../section-player/client-architecture-tutorial.md`](../section-player/client-architecture-tutorial.md)
- [`./tool_host_contract.md`](./tool_host_contract.md)

## Core Model

```ts
type CanonicalToolsConfig = {
  placement: {
    section?: string[];
    item?: string[];
    passage?: string[];
  };
  providers?: Record<
    string,
    {
      enabled?: boolean;
      settings?: Record<string, unknown>;
      provider?: {
        id?: string;
        init?: Record<string, unknown>;
        runtime?: {
          authFetcher?: () => Promise<Record<string, unknown>>;
          request?: (request: unknown) => Promise<unknown>;
          emit?: (eventName: string, payload?: Record<string, unknown>) => void | Promise<void>;
          subscribe?: (
            eventName: string,
            handler: (payload: unknown) => void,
          ) => (() => void) | void;
        };
      };
    }
  >;
  policy?: {
    allowed?: string[];
    blocked?: string[];
  };
};
```

### Canonical tool IDs

Use the current semantic tool IDs in docs and examples:

- `textToSpeech`
- `calculator`
- `annotationToolbar`
- `answerEliminator`
- `lineReader`
- `ruler`
- `graph`
- `periodicTable`
- `protractor`
- `theme`

## Basic Integration

```ts
import { ToolkitCoordinator } from "@pie-players/pie-assessment-toolkit";

const coordinator = new ToolkitCoordinator({
  assessmentId: "demo-assessment",
  tools: {
    placement: {
      section: ["theme", "graph", "periodicTable", "lineReader", "ruler"],
      item: ["calculator", "textToSpeech", "answerEliminator"],
      passage: ["textToSpeech"],
    },
    providers: {
      textToSpeech: {
        settings: { backend: "browser" },
      },
      calculator: {
        enabled: true,
      },
    },
  },
});

const sectionPlayer = document.querySelector(
  "pie-section-player-splitpane",
) as any;

sectionPlayer.coordinator = coordinator;
sectionPlayer.section = section;
```

The same coordinator can be reused across section-player instances for a shared assessment scope when that matches the host architecture.

## Placement Rules

- `section` tools render in the shared section toolbar.
- `item` tools render in each item card.
- `passage` tools render in each passage card.
- Tools omitted from placement are not shown, even if provider config exists.
- Placement overrides from layout props are normalized on top of the runtime config.

## Runtime Tool Context Resolvers

Some tool decisions depend on the current item, not just static provider
configuration. For example, a host may read item metadata and show a basic or
scientific calculator only on items that request one. Section-player hosts can
provide `runtime.toolContextResolvers` alongside the existing `runtime.tools`
object:

```ts
const sectionPlayerRuntime = {
  assessmentId: "demo",
  tools: {
    placement: {
      item: ["calculator", "textToSpeech"],
    },
    providers: {
      calculator: {
        provider: {
          runtime: { authFetcher: fetchDesmosAuthConfig },
        },
      },
    },
  },
  toolContextResolvers: {
    calculator: ({ context }) => {
      const calculatorType = readCalculatorTypeFromItemMetadata(context);

      if (!calculatorType) {
        return {
          visible: false,
          reason: "Current item does not request a calculator.",
        };
      }

      return {
        visible: true,
        params: {
          calculatorType,
          availableTypes: [calculatorType],
        },
      };
    },
  },
};
```

Direct `<pie-assessment-toolkit>` consumers can pass the same resolver map as a
JS property, or provide it when constructing `ToolkitCoordinator` explicitly.

Resolver order is deliberately narrow:

1. `tools.placement`, `tools.policy`, provider `enabled`, custom
   `PolicySource`s, and PNP/profile rules decide the candidate tool set.
2. A host resolver, when registered for a surviving tool, may hide that tool
   for the current scope or attach render params.
3. If no host resolver is registered, the tool registration uses its built-in
   `isVisibleInContext` relevance check.
4. The tool's `renderToolbar` receives params through
   `toolbarContext.getToolRenderParams(toolId)`.

This means host item metadata can decide calculator type without overriding
the packaged tool registry, while district/test/PNP blocks still win earlier
in the pipeline.

## Provider Configuration

### Browser TTS

```ts
const coordinator = new ToolkitCoordinator({
  assessmentId: "demo",
  tools: {
    placement: {
      item: ["textToSpeech"],
      passage: ["textToSpeech"],
    },
    providers: {
      textToSpeech: {
        settings: {
          backend: "browser",
          defaultVoice: "en-US",
          layoutMode: "expanding-row",
        },
      },
    },
  },
});
```

`layoutMode` can be configured directly on `tools.providers.textToSpeech` (either top-level or inside `settings`). When omitted, the default is **`expanding-row`**. Supported values are:

- `reserved-row`
- `expanding-row`
- `floating-overlay`
- `left-aligned`

Example using top-level provider fields:

```ts
providers: {
  textToSpeech: {
    enabled: true,
    backend: "browser",
    layoutMode: "left-aligned",
  },
}
```

The `@pie-players/pie-section-player-tools-tts-settings` package is optional and only provides a runtime settings dialog UI. Hosts do not need that package to use TTS layout modes.

`speedOptions` (inline toolbar speed multipliers, excluding 1.0×) can be set on `tools.providers.textToSpeech` at the top level or under `settings`, same as `layoutMode`. Defaults are `0.8` and `1.25`; an explicit empty array hides speed buttons. The optional TTS settings dialog edits both `layoutMode` and `speedOptions` in one global toolbar section.

### Calculator With Host Auth

```ts
const coordinator = new ToolkitCoordinator({
  assessmentId: "demo",
  tools: {
    placement: {
      section: ["calculator"],
      item: ["calculator"],
    },
    providers: {
      calculator: {
        provider: {
          runtime: {
            authFetcher: async () => {
              const res = await fetch("/api/tools/desmos/token");
              return res.json();
            },
          },
        },
      },
    },
  },
});
```

## Host Responsibilities

The host owns:

- `assessmentId`, `sectionId`, and `attemptId`
- authentication for external tool services
- persistence policy
- any product-specific rules that affect whether users may advance, resume, or submit

The toolkit and section-player runtime own:

- tool placement normalization
- tool provider lifecycle
- section-level runtime wiring
- controller and event streams for the active section

## Section-Player Boundary

The modern host boundary is:

```ts
sectionPlayer.coordinator = coordinator;
```

Assign the coordinator through the canonical `coordinator` property.

The public layout custom elements are:

- `pie-section-player-splitpane`
- `pie-section-player-vertical`

Prefer those elements and the `coordinator` property over older orchestration patterns.

## Advanced Host Access

Hosts that need direct access to runtime events or controller state should subscribe through the coordinator or section controller rather than coupling to internal component details.

```ts
// Subscribe after the first `getOrCreateSectionController(...)` resolves.
// The listener follows the toolkit's active section cohort across navigation.
const unsubscribeItem = coordinator.subscribeItemEvents({
  listener: (event) => {
    console.log("item event", event);
  },
});

const unsubscribeSection = coordinator.subscribeSectionLifecycleEvents({
  listener: (event) => {
    console.log("section event", event);
  },
});
```

See [`../section-player/client-architecture-tutorial.md`](../section-player/client-architecture-tutorial.md) for the current controller and host-integration patterns.

## Backend Notes

Provider runtime hooks are where hosts bridge tool packages to authenticated backend services.

Typical examples:

- `/api/tools/desmos/token`
- `/api/tts/synthesize`
- `/api/tools/tts/google/token`

Those endpoint names are host-owned. The tool system only requires that the configured provider runtime functions return the data the provider expects.

For the production security contract these endpoints must meet
(authentication, rate-limiting, secret boundaries, `assetOrigins`), see
[`./tool_host_contract.md#backend-endpoints-for-tool-providers`](./tool_host_contract.md#backend-endpoints-for-tool-providers).

## Related Docs

- [`./architecture.md`](./architecture.md)
- [`./tool_host_contract.md`](./tool_host_contract.md)
- [`../section-player/client-architecture-tutorial.md`](../section-player/client-architecture-tutorial.md)
- [`../../packages/section-player/README.md`](../../packages/section-player/README.md)
