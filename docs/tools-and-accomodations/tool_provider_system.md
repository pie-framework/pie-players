# Configuring Tools

This guide is for host integrators. It shows how to configure tools on a `ToolkitCoordinator`: placement, provider configuration, host resolvers, and the boundary to the section player. The [tool registry reference](../../packages/assessment-toolkit/docs/TOOL_REGISTRY.md) is authoritative for tool registrations.

## Overview

The tool-provider system is centered on `ToolkitCoordinator`.

- One `ToolkitCoordinator` serves the assessment surface. The toolkit builds its own from its element inputs when none is passed; a host that needs more constructs one and passes it, on a section player as `runtime.coordinator`.
- Tool placement lives under `tools.placement`.
- Tool-specific runtime config lives under `tools.providers`.
- In a section player, item- and passage-level toolbars come from the section-player runtime, and the host wires nothing per card.
- Without a section player, the host places a `<pie-item-scope>` and a `<pie-item-toolbar>` per item inside `<pie-assessment-toolkit>`; see [Without a Section Player](../../packages/assessment-toolkit/README.md#without-a-section-player).

Use this document together with:

- [`../architecture/architecture.md`](../architecture/architecture.md)
- [`../section-player/integration-guide.md`](../section-player/integration-guide.md)
- [`./tool_host_contract.md`](./tool_host_contract.md)

## Core Model

The host-facing shape, exported as `ToolsConfigInput`. Every part is optional; a placement level left out places nothing. `CanonicalToolsConfig` is the normalized form the coordinator holds.

```ts
type ToolsConfigInput = {
  placement?: {
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
          ) => (() => void) | undefined;
        };
      };
    }
  >;
  policy?: {
    allowed?: string[];
    blocked?: string[];
  };
  pnpEnforcement?: "on" | "off";
};
```

Two provider entries are closed to the keys their tool reads, so a misplaced key fails to compile. `tools.providers.textToSpeech` takes its runtime settings (`backend`, `layoutMode`, `speedOptions` and the rest) at its top level, beside `enabled` and `provider`, and reads no `settings`. `tools.providers.calculator` takes `settings`, `restrictedMode`, `locale`, `theme`, `enabled` and `provider`.

`pnpEnforcement` sets whether toolbar decisions apply the learner's Personal Needs and Preferences (PNP) profile: `"on"`, `"off"`, or left out for auto-mode. Auto-mode applies it when the bound assessment carries profile policy or, for a decision scoped to an item, when that item's settings require or restrict a tool. [PNP configuration](../../packages/assessment-toolkit/docs/PNP_CONFIGURATION.md) covers the profile.

### Canonical tool IDs

`createPackagedToolRegistry()` registers these toolbar tool IDs:

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
- `dictionary`, `dictionarySpanish`
- `pictureDictionary`, `pictureDictionarySpanish`

It also registers `transcript`, a region capability with no toolbar button, which
`tools.placement` cannot place. Sign language is a separate package
(`@pie-players/pie-tool-sign-language`) that a host registers itself.

The tool id is the one key for a tool: its `tools.providers` entry, its
placement and policy, failure attribution, and its provider's entry in the
coordinator's provider registry. `provider.id` inside the entry selects an
implementation (for the calculator `calculator-desmos`, `calculator-geogebra`
or `calculator-cortex`) and never names a registry entry, so selecting another
through `updateToolConfig` replaces the provider under the same id.

## Basic Integration

```ts
import { ToolkitCoordinator } from "@pie-players/pie-assessment-toolkit";
import { createPackagedToolRegistry } from "@pie-players/pie-default-tool-loaders";

const toolRegistry = createPackagedToolRegistry();
const coordinator = new ToolkitCoordinator({
  assessmentId: "demo-assessment",
  toolRegistry,
  tools: {
    placement: {
      section: ["theme", "graph", "periodicTable", "lineReader", "ruler"],
      item: ["calculator", "textToSpeech", "answerEliminator"],
      passage: ["textToSpeech"],
    },
    providers: {
      textToSpeech: {
        backend: "browser",
      },
      // Desmos, the default calculator, needs an application key:
      // see "Calculator With Host Auth" below.
      calculator: {
        enabled: true,
      },
    },
  },
});

const sectionPlayer = document.querySelector("pie-section-player-splitpane");

sectionPlayer.runtime = { coordinator };
sectionPlayer.section = section;
```

The same coordinator can be reused across section-player instances for a shared assessment scope when that matches the host architecture.

## Placement Rules

- `section` tools render in the shared section toolbar.
- `item` tools render in each item card.
- `passage` tools render in each passage card.
- Tools omitted from placement are not shown, even if provider config exists.
- Placement a layout element receives as a property is normalized on top of the runtime config.

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
   `isVisibleInContext` relevance check. Section toolbars skip it, and so does a
   tool a PNP grant marks required or always available.
4. Below section level, once content has resolved, a tool whose registration
   reports it inapplicable to every content context (`isApplicableToContent`) is
   dropped, granted or not. A host-resolved tool keeps the resolver's answer.
5. The tool's `renderToolbar` receives params through
   `toolbarContext.getToolRenderParams(toolId)`, and its policy parameters through
   `toolbarContext.getToolParameters(toolId)`.

This means host item metadata can decide calculator type without overriding
the packaged tool registry, while district/test/PNP blocks still win earlier
in the pipeline.

## Provider Configuration

### Browser TTS

```ts
const coordinator = new ToolkitCoordinator({
  assessmentId: "demo",
  toolRegistry,
  tools: {
    placement: {
      item: ["textToSpeech"],
      passage: ["textToSpeech"],
    },
    providers: {
      textToSpeech: {
        backend: "browser",
        // Optional: `defaultVoice`, an exact voiceURI or name from
        // speechSynthesis.getVoices().
        layoutMode: "expanding-row",
      },
    },
  },
});
```

`layoutMode` is configured directly on `tools.providers.textToSpeech`. When omitted, the toolkit and a standalone `<pie-tool-tts-inline>` both use **`left-aligned`**, which the toolkit also uses for a value outside this list. Supported values are:

- `reserved-row`
- `expanding-row`
- `floating-overlay`
- `left-aligned`

A minimal browser configuration with the default layout:

```ts
providers: {
  textToSpeech: {
    enabled: true,
    backend: "browser",
    layoutMode: "left-aligned",
  },
}
```

The optional `@pie-players/pie-section-player-tools-tts-settings` package provides a runtime settings dialog; layout modes work without it.

`speedOptions` sets the inline toolbar's playback-speed choices, at the top level of `tools.providers.textToSpeech` beside `layoutMode`. The defaults are `Slow`, `Normal` and `Fast`, with `Normal` at `1.0×` and selected. A non-empty list that omits `1` gets a visible `Normal` choice added, in the host's order. An empty array hides the speed controls and resets playback speed to `1.0`.

The optional TTS settings dialog edits `layoutMode` and `speedOptions` in one global toolbar section.

### Calculator With Host Auth

```ts
const coordinator = new ToolkitCoordinator({
  assessmentId: "demo",
  toolRegistry,
  tools: {
    placement: {
      item: ["calculator"],
    },
    providers: {
      calculator: {
        provider: {
          runtime: {
            authFetcher: async () => {
              const res = await fetch("/api/tools/desmos/auth");
              return res.json();
            },
          },
        },
      },
    },
  },
});
```

The default calculator is Desmos, and its adapter refuses to initialize without an application key unless `window.Desmos` is already loaded. It takes the key from one of three places:

| Source | Behavior |
|---|---|
| `provider.runtime.authFetcher` | Host function returning `{ apiKey }`; the toolkit merges the result into the provider's initialization. |
| `provider.init.proxyEndpoint` | Host URL the adapter fetches at initialization; the response body is `{ apiKey }`. |
| `provider.init.apiKey` | The key inline, for development. |

`provider.id: "calculator-cortex"` selects a calculator that needs no key; see the [Cortex calculator README](../../packages/calculator-cortex/README.md).

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

The host boundary is the `runtime` object:

```ts
sectionPlayer.runtime = { ...sectionPlayer.runtime, coordinator };
```

The section player has no top-level `coordinator` property; it reads the
coordinator from `runtime.coordinator`.

The public layout custom elements are:

- `pie-section-player-splitpane`
- `pie-section-player-vertical`
- `pie-section-player-tabbed`

## Advanced Host Access

Hosts that need runtime events or controller state subscribe through the coordinator or the section controller; component internals are no contract.

```ts
// Subscribe after the first `getOrCreateSectionController(...)` resolves.
// The listener follows the toolkit's active cohort, the (sectionId, attemptId)
// pair, across navigation.
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

See [`../section-player/integration-guide.md`](../section-player/integration-guide.md) for the current controller and host-integration patterns.

## Backend Notes

Provider runtime hooks are where hosts bridge tool packages to authenticated backend services.

Typical examples:

- `/api/tools/desmos/auth`
- `/api/tts/synthesize`
- `/api/tools/dictionary`

Those endpoint names are host-owned. The tool system only requires that the configured provider runtime functions return the data the provider expects.

For Desmos, `authFetcher` and `proxyEndpoint` keep the application key out of
source and static bundles. The browser still sees it: the adapter loads
`calculator.js` from desmos.com with the key in the script URL. Calculator
composition has no implicit endpoint and always loads that script from Desmos;
`proxyEndpoint` serves only the key. Use a key on a Trial or Commercial tier
licensed for the application. Proxying or self-hosting the Desmos script needs a
partner agreement that grants it.

The calculator capability defaults to `calculator-desmos` when no provider id
is configured. Select the GeoGebra suite explicitly:

```ts
calculator: {
  provider: {
    id: "calculator-geogebra",
    init: { appletTimeoutMs: 20_000 },
  },
  settings: { showResetIcon: true },
  restrictedMode: true,
}
```

Both implementations use the same generic provider and custom-element
configuration seam. `provider.init` configures provider loading,
`provider.runtime` carries host functions, and `settings` is passed to the
selected vendor adapter. GeoGebra maps `basic` to its scientific embedded app.

For the production security contract these endpoints must meet
(authentication, rate-limiting, secret boundaries, `assetOrigins`), see
[`./tool_host_contract.md#backend-endpoints-for-tool-providers`](./tool_host_contract.md#backend-endpoints-for-tool-providers).

## Related Docs

- [`./architecture.md`](./architecture.md)
- [`./tool_host_contract.md`](./tool_host_contract.md)
- [`../section-player/integration-guide.md`](../section-player/integration-guide.md)
- [`../../packages/section-player/README.md`](../../packages/section-player/README.md)
- [`../../packages/assessment-toolkit/README.md`](../../packages/assessment-toolkit/README.md)
- [`../../packages/assessment-toolkit/docs/TOOL_REGISTRY.md`](../../packages/assessment-toolkit/docs/TOOL_REGISTRY.md)
- [`../../packages/default-tool-loaders/src/calculator-providers/README.md`](../../packages/default-tool-loaders/src/calculator-providers/README.md)
