# Getting started with the section player

The section player renders one assessment section: its passages and items in one layout, with the assessment toolkit's tools on toolbars around them. This page builds a reading section with a passage and two items, places tools on the section and item toolbars, grants a calculator through a learner profile, and keeps the learner's responses across a reload. Each item carries an item config as [Getting started](getting-started.md) describes it.

## Install

```bash
npm install @pie-players/pie-section-player @pie-players/pie-assessment-toolkit
```

```ts
import "@pie-players/pie-section-player";
import { ToolkitCoordinator } from "@pie-players/pie-assessment-toolkit";
```

The first import registers the section player elements. The second gives the host its own `ToolkitCoordinator`, the toolkit service that holds tool configuration and policy and owns the section's controller. A page without a build step imports the same two from a CDN, as the page below does: the section player's self-contained [browser build](install/cdn.md#section-player-browser-build), which bundles the toolkit and the packaged tools and loads only from its full file path, and the toolkit's `+esm` module for the coordinator class.

The `@pie-players/*` packages release together under one version number, written `x.y.z` in these docs. Pin it exactly, and give both URLs the same version: a `0.x` release can break, and a range or `@latest` URL changes the page without a deploy ([versioning](install/versioning.md#pinning)).

## A reading section

```html
<pie-section-player-splitpane id="player" attempt-id="attempt-1" show-toolbar="true"></pie-section-player-splitpane>

<script type="module">
  import "https://cdn.jsdelivr.net/npm/@pie-players/pie-section-player@x.y.z/dist/browser/pie-section-player.js";
  import { ToolkitCoordinator } from "https://cdn.jsdelivr.net/npm/@pie-players/pie-assessment-toolkit@x.y.z/+esm";

  const section = {
    identifier: "reading-1",
    rubricBlocks: [
      {
        class: "stimulus",
        view: ["candidate"],
        passage: {
          id: "honeybees",
          name: "Honeybees",
          config: {
            markup:
              "<h2>Honeybees</h2><p>A honeybee that finds flowers returns to the hive and dances. The direction of the dance tells the other bees where the flowers are, and its length tells them how far to fly.</p>",
            elements: {},
            models: [],
          },
        },
      },
    ],
    assessmentItemRefs: [
      {
        identifier: "q1",
        item: {
          id: "q1",
          config: {
            markup: '<multiple-choice id="q1-choice"></multiple-choice>',
            elements: { "multiple-choice": "@pie-element/multiple-choice@14.0.3" },
            models: [
              {
                id: "q1-choice",
                element: "multiple-choice",
                prompt: "What does the length of the dance tell the other bees?",
                choiceMode: "radio",
                choices: [
                  { label: "How far to fly", value: "distance", correct: true },
                  { label: "Which way to fly", value: "direction" },
                  { label: "Which flowers to visit", value: "flowers" },
                ],
              },
            ],
          },
        },
      },
      {
        identifier: "q2",
        item: {
          id: "q2",
          config: {
            markup: '<extended-text-entry id="q2-essay"></extended-text-entry>',
            elements: { "extended-text-entry": "@pie-element/extended-text-entry@16.0.3" },
            models: [
              {
                id: "q2-essay",
                element: "extended-text-entry",
                prompt: "Why does a hive gain from bees sharing what they find?",
              },
            ],
          },
        },
      },
    ],
  };

  const coordinator = new ToolkitCoordinator({
    assessmentId: "bees-check",
    tools: {
      placement: {
        section: ["theme", "lineReader"],
        item: ["answerEliminator", "calculator"],
      },
      providers: { calculator: { provider: { id: "calculator-cortex" } } },
    },
  });
  coordinator.updateAssessment({ personalNeedsProfile: { supports: ["calculator"] } });

  const player = document.getElementById("player");
  const storageKey = "bees-check:reading-1:attempt-1";
  const saved = localStorage.getItem(storageKey);

  player.runtime = { coordinator };
  if (saved) player.session = JSON.parse(saved);
  player.section = section;

  player.addEventListener("session-changed", () => {
    const session = player.getSectionController()?.getSession();
    if (session) localStorage.setItem(storageKey, JSON.stringify(session));
  });
</script>
```

The section lists its items in `assessmentItemRefs`, each an `identifier` and an `item` whose `config` is an item config. A passage is a rubric block of class `stimulus` carrying a `passage` of the same shape, and `view: ["candidate"]` shows it to the learner. Items load their elements under the default `iife` strategy, so `elements` can name any published element version.

`<pie-section-player-splitpane>` sets the passages beside the items with a resizable divider, and collapses to tabs at a viewport width of 1100 px or less. `<pie-section-player-vertical>` and `<pie-section-player-tabbed>` take the same inputs apart from the split-pane attributes, and a host arranges its own layout on `<pie-section-player-kernel-host>`. `runtime`, `section` and `session` are properties; `attempt-id` and `show-toolbar` are attributes. Set `runtime` no later than `section`.

## Tool placement

`tools.placement` lists tool ids for each level. Section tools sit on the section toolbar, which renders only with `show-toolbar`; item and passage tools sit in each card's header. Placement is empty by default, and validation reports a tool placed at a level it does not support: `calculator` and `answerEliminator` are item tools, and `theme`, the color-scheme tool, works at assessment and section level only. [Configuring tools](tools-and-accomodations/tool_provider_system.md#canonical-tool-ids) lists every tool id.

Item and passage toolbars show a placed tool only where the content calls for it. Strike Through (`answerEliminator`) appears on the multiple-choice item alone, since the essay has no choices, and the calculator appears on neither item, since neither holds math, until the learner profile grants it. Section tools skip this filter. `calculator-cortex` is the open-source calculator; the default provider, Desmos, needs an API key.

Each placed tool runs one instance per scope, named `<toolId>:<level>:<scopeId>`. This page runs `theme:section:reading-1`, `lineReader:section:reading-1`, `calculator:item:q1` and `calculator:item:q2`, so the two calculators are separate instances.

The toolbars load each tool's element through the player's default registry, `createPackagedToolRegistry()` from `@pie-players/pie-default-tool-loaders`, and a coordinator constructed without a `toolRegistry` adopts it. A host with tools of its own builds that registry, registers its tools on it and sets it as the player's `toolRegistry` ([tools](../packages/section-player/README.md#tools)).

## Learner profile

`coordinator.updateAssessment(...)` binds the assessment, whose `personalNeedsProfile` (AfA PNP 3.0) holds the learner's accommodations. Each id in `supports` is the id of the tool it grants. A bound profile turns policy enforcement on while `tools.pnpEnforcement` is unset, and a grant keeps a placed tool through the content filter, which is how the calculator reaches both items. A grant places nothing: a tool the profile names reaches a toolbar only at a level where `tools.placement` lists it. The profile is learner data and rides on the assessment; the player ignores one on the section and warns once.

For each tool the first matching rule decides: district block, test-administration override `false`, item restriction, PNP prohibition (`prohibitedSupports`), test-administration override `true`, item requirement, district requirement, PNP support. [PNP configuration](../packages/assessment-toolkit/docs/PNP_CONFIGURATION.md) gives each rule's field, with examples.

## Session persistence

The section session holds every item's session: `{ currentItemIndex, visitedItemIdentifiers, itemSessions }`, with each response under `itemSessions[itemIdentifier].session`. The page saves it on each `session-changed` from `getSectionController()?.getSession()`. On load it sets `session` before `section`, so the controller applies the saved session in place of its own storage and the first render shows the saved responses. A host keeps the session on its server per learner and attempt; `localStorage` stands in for that here.

The player's default persistence also writes to `localStorage`, under `pie:section-controller:v1:{assessmentId}:{sectionId}:{attemptId}`, but only when the controller's `persist()` runs: at section teardown or on a host call. A page reload runs neither, and without `attempt-id` the default persistence neither reads nor writes. A coordinator hook replaces it with a host strategy ([section session persistence](../packages/section-player/README.md#section-session-persistence)).

## Readiness and events

The player's events bubble out of the layout element, so the host listens on it or on `document`.

| Event | Detail | When |
| --- | --- | --- |
| `toolkit-ready` | `coordinator`, `runtimeId`, `assessmentId`, `sectionId`, `itemPlayer` | Once per section, when its controller resolves. `coordinator` is the one the player runs: the host's own when it passed one |
| `session-changed` | `session` (the item session, `{ id, data }`), `itemId`, `canonicalItemId`, `complete`, `component`, `elementId`, `intent`, `timestamp` | An item's session changed |
| `pie-loading-complete` | `sectionId`, `attemptId`, `itemCount`, `runtimeId`, `timestamp` | Once the section is interactive and its elements are pre-loaded. The items load after it |

A first section emits `pie-stage-change` `composed`, `runtime-ready`, `toolkit-ready`, `section-ready`, `pie-stage-change` `engine-ready` and `interactive`, then `pie-loading-complete`. The controller's `section-loading-complete`, delivered through its `subscribe()`, marks every item loaded. Each failure that crosses the framework boundary arrives once as `framework-error` ([events](../packages/section-player/README.md#events)).

## Next steps

- Inputs, host methods, events and exports: the [section player reference](../packages/section-player/README.md).
- An integration end to end, from runtime configuration to persistence strategies: the [section player integration guide](section-player/integration-guide.md).
- Host-built layouts: [custom layouts](section-player/custom-layouts.md).
- Practice sections, where the learner checks an answer, sees feedback and tries again: [formative delivery](section-player/formative-delivery.md).
- Which tools each learner receives: [tools and accommodations](tools-and-accomodations/architecture.md).
- Tool providers, text-to-speech and the coordinator API: the [assessment toolkit](../packages/assessment-toolkit/README.md).
- Colors, fonts and dark mode: [theming](theming/how-theming-works.md).
- Read-aloud, accessibility catalogs and sign language: [accessibility](accessibility/README.md).
