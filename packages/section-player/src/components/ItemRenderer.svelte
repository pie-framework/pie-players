<!--
  ItemRenderer - Internal Component

  Renders a single item using pie-iife-player or pie-esm-player.
  Handles SSML extraction, TTS service binding, and player lifecycle.
-->
<script lang="ts">
  import { SSMLExtractor } from "@pie-players/pie-assessment-toolkit";
  import "@pie-players/pie-assessment-toolkit/components/QuestionToolBar.svelte";
	import {
		DEFAULT_PLAYER_DEFINITIONS,
		mergeComponentDefinitions,
		type ComponentDefinition,
	} from "../component-definitions.js";
  import type { ItemEntity, PassageEntity } from "@pie-players/pie-players-shared";
  import { onMount, untrack } from "svelte";

  export type QtiContentKind =
    | "assessment-item"
    | "rubric-block-stimulus"
    | "rubric-block-instructions"
    | "rubric-block-rubric";

  let {
    item,
    env = { mode: "gather", role: "student" },
    session = { id: "", data: [] },
    player = "iife",
    contentKind = "assessment-item" as QtiContentKind,
    skipElementLoading = true,
    assessmentId = "",
    sectionId = "",
    toolkitCoordinator = null,
    playerDefinitions = {} as Partial<Record<string, ComponentDefinition>>,
    customClassName = "",
    onsessionchanged,
  }: {
    item: ItemEntity | PassageEntity;
    env?: {
      mode: "gather" | "view" | "evaluate" | "author";
      role: "student" | "instructor";
    };
    session?: any;
    player?: string;
    contentKind?: QtiContentKind;
    skipElementLoading?: boolean;
    playerVersion?: string;
    assessmentId?: string;
    sectionId?: string;
    toolkitCoordinator?: any;
    playerDefinitions?: Partial<Record<string, ComponentDefinition>>;
    customClassName?: string;
    onsessionchanged?: (event: CustomEvent) => void;
  } = $props();

  // Extract individual services from coordinator
  const ttsService = $derived(toolkitCoordinator?.ttsService);
  const toolCoordinator = $derived(toolkitCoordinator?.toolCoordinator);
  const highlightCoordinator = $derived(toolkitCoordinator?.highlightCoordinator);
  const catalogResolver = $derived(toolkitCoordinator?.catalogResolver);
  const elementToolStateStore = $derived(toolkitCoordinator?.elementToolStateStore);

  // Get the DOM element reference for service binding
  let itemContentElement: HTMLElement | null = $state(null);
  let questionToolbarElement: HTMLElement | null = $state(null);
  let playerElement: any = $state(null);
  let calculatorElement: HTMLElement | null = $state(null);

  // Set toolkitCoordinator on calculator element
  $effect(() => {
    if (calculatorElement && toolkitCoordinator) {
      (calculatorElement as any).toolkitCoordinator = toolkitCoordinator;
    }
  });

  // Track if services have been bound
  let toolbarServicesBound = $state(false);
  let calculatorVisible = $state(false);

  // Track last values to avoid unnecessary updates
  let lastConfig: any = null;
  let lastEnv: any = null;
  let hasElements = $derived(
    !!(item?.config?.elements && Object.keys(item.config.elements).length > 0),
  );

  let resolvedPlayerType = $derived(player);

  let mergedPlayerDefinitions = $derived.by(() =>
    mergeComponentDefinitions(DEFAULT_PLAYER_DEFINITIONS, playerDefinitions),
  );
  let resolvedPlayerDefinition = $derived.by(
    () =>
      mergedPlayerDefinitions[resolvedPlayerType] || mergedPlayerDefinitions["iife"],
  );
  let resolvedPlayerTag = $derived(resolvedPlayerDefinition?.tagName || "pie-iife-player");

  // Import the appropriate player web component
  onMount(() => {
    // Import components on client side only
    (async () => {
      if (hasElements) {
        await resolvedPlayerDefinition?.ensureDefined?.();
      }
    })();

    // Cleanup: Clear item catalogs on unmount
    return () => {
      if (catalogResolver) {
        catalogResolver.clearItemCatalogs();
      }
    };
  });

  // Extract SSML from item config when item changes
  $effect(() => {
    if (item?.config && catalogResolver) {
      // Skip if already extracted
      if (item.config.extractedCatalogs) {
        catalogResolver.clearItemCatalogs();
        catalogResolver.addItemCatalogs(item.config.extractedCatalogs);
        return;
      }

      const extractor = new SSMLExtractor();
      const result = extractor.extractFromItemConfig(item.config);

      // Update config with cleaned content (SSML removed, catalog IDs added)
      untrack(() => {
        item.config = result.cleanedConfig;
        item.config.extractedCatalogs = result.catalogs;
      });

      // Register catalogs with resolver for TTS lookup
      if (result.catalogs.length > 0) {
        catalogResolver.clearItemCatalogs(); // Clear previous item's catalogs
        catalogResolver.addItemCatalogs(result.catalogs);
        console.debug(
          `[ItemRenderer] Extracted ${result.catalogs.length} SSML catalogs for item ${item.id}`,
        );
      }
    }
  });

  // Set player properties imperatively when config or env changes
  $effect(() => {
    const currentConfig = item.config;
    const currentEnv = env;
    const currentSession = session;

    if (playerElement && currentConfig && hasElements) {
      // Check if config or env changed
      const envChanged =
        !lastEnv ||
        lastEnv.mode !== currentEnv.mode ||
        lastEnv.role !== currentEnv.role;

      if (currentConfig !== lastConfig || envChanged) {
        untrack(() => {
          playerElement.config = currentConfig;
          playerElement.session = currentSession;
          playerElement.env = currentEnv;
          // Apply host-specified component definition first.
          if (resolvedPlayerDefinition?.attributes) {
            for (const [name, value] of Object.entries(
              resolvedPlayerDefinition.attributes,
            )) {
              playerElement.setAttribute(name, value);
            }
          }
          if (resolvedPlayerDefinition?.props) {
            for (const [name, value] of Object.entries(
              resolvedPlayerDefinition.props,
            )) {
              (playerElement as any)[name] = value;
            }
          }

          // Section preloading already fetched required elements; avoid duplicate per-player fetch.
          if (skipElementLoading) {
            playerElement.setAttribute("skip-element-loading", "true");
            (playerElement as any).skipElementLoading = true;
          }

        });

        lastConfig = currentConfig;
        lastEnv = currentEnv;
      }
    }
  });

  // Bind services, scope, and IDs to question toolbar (must be JS properties)
  $effect(() => {
    if (questionToolbarElement && !toolbarServicesBound) {
      if (toolCoordinator) {
        (questionToolbarElement as any).toolCoordinator = toolCoordinator;
      }
      if (ttsService) {
        (questionToolbarElement as any).ttsService = ttsService;
      }
      if (highlightCoordinator) {
        (questionToolbarElement as any).highlightCoordinator =
          highlightCoordinator;
      }
      if (itemContentElement) {
        (questionToolbarElement as any).scopeElement = itemContentElement;
      }
      if (elementToolStateStore) {
        (questionToolbarElement as any).elementToolStateStore =
          elementToolStateStore;
      }
      if (assessmentId) {
        (questionToolbarElement as any).assessmentId = assessmentId;
      }
      if (sectionId) {
        (questionToolbarElement as any).sectionId = sectionId;
      }

      toolbarServicesBound = true;
    }
  });


  // Subscribe to calculator visibility changes
  $effect(() => {
    if (!toolCoordinator || !item) return;

    const unsubscribe = toolCoordinator.subscribe(() => {
      calculatorVisible = toolCoordinator.isToolVisible(
        `calculator-${item.id}`,
      );
    });

    // Initial update
    calculatorVisible = toolCoordinator.isToolVisible(`calculator-${item.id}`);

    return unsubscribe;
  });

  // Attach event listener to player element imperatively
  $effect(() => {
    if (playerElement && onsessionchanged) {
      const handler = (event: Event) => {
        console.log("[ItemRenderer] Session changed event received:", event);
        console.log(
          "[ItemRenderer] Full event detail:",
          (event as CustomEvent).detail,
        );
        onsessionchanged(event as CustomEvent);
      };

      playerElement.addEventListener("session-changed", handler);

      return () => {
        playerElement.removeEventListener("session-changed", handler);
      };
    }
    return undefined;
  });
</script>

{#if item.config}
  <div
    class="pie-section-player__item-renderer {customClassName}"
    data-assessment-id={assessmentId}
    data-section-id={sectionId}
    data-item-id={item.id}
    data-content-kind={contentKind}
  >
    <div class="pie-section-player__item-header">
      <h4 class="pie-section-player__item-title">{item.name || "Question"}</h4>
      <pie-question-toolbar
        bind:this={questionToolbarElement}
        item-id={item.id}
        catalog-id={item.id}
        tools="calculator,tts,answerEliminator"
        size="md"
        language="en-US"
      ></pie-question-toolbar>
    </div>

    <div class="pie-section-player__item-content" bind:this={itemContentElement}>
      {#if hasElements}
        {#key resolvedPlayerTag}
          <svelte:element this={resolvedPlayerTag} bind:this={playerElement}></svelte:element>
        {/key}
      {:else}
        {@html item.config.markup}
      {/if}
    </div>
  </div>

  <!-- Calculator Tool Instance (rendered outside panel for floating overlay) -->
  {#if item}
    <pie-tool-calculator
      bind:this={calculatorElement}
      visible={calculatorVisible}
      tool-id="calculator-{item.id}"
    ></pie-tool-calculator>
  {/if}
{/if}

<style>
  .pie-section-player__item-renderer {
    display: block;
    margin-bottom: 0;
  }

  .pie-section-player__item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 0;
    margin-bottom: 0.5rem;
  }

  .pie-section-player__item-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--pie-primary, #1976d2);
  }

  .pie-section-player__item-content {
    padding: 1rem;
    border: 1px solid var(--pie-border-light, #e5e7eb);
    border-radius: 4px;
  }
</style>
