<!--
  ItemRenderer - Internal Component

  Renders a single item using pie-iife-player or pie-esm-player.
  Handles SSML extraction, TTS service binding, and player lifecycle.
-->
<script lang="ts">
  import { SSMLExtractor } from "@pie-players/pie-assessment-toolkit";
  import "@pie-players/pie-assessment-toolkit/components/QuestionToolBar.svelte";
  import type { ItemEntity } from "@pie-players/pie-players-shared/types";
  import { onMount, untrack } from "svelte";

  let {
    item,
    env = { mode: "gather", role: "student" },
    session = { id: "", data: [] },
    bundleHost = "",
    esmCdnUrl = "https://esm.sh",
    playerType = "auto",
    assessmentId = "",
    sectionId = "",
    toolkitCoordinator = null,

    class: className = "",
    onsessionchanged,
  }: {
    item: ItemEntity;
    env?: {
      mode: "gather" | "view" | "evaluate" | "author";
      role: "student" | "instructor";
    };
    session?: any;
    bundleHost?: string;
    esmCdnUrl?: string;
    playerVersion?: string;
    playerType?: "auto" | "iife" | "esm" | "fixed" | "inline";
    assessmentId?: string;
    sectionId?: string;
    toolkitCoordinator?: any;

    class?: string;
    onsessionchanged?: (event: CustomEvent) => void;
  } = $props();

  // Extract individual services from coordinator
  const ttsService = $derived(toolkitCoordinator?.ttsService);
  const toolCoordinator = $derived(toolkitCoordinator?.toolCoordinator);
  const highlightCoordinator = $derived(toolkitCoordinator?.highlightCoordinator);
  const catalogResolver = $derived(toolkitCoordinator?.catalogResolver);
  const elementToolStateStore = $derived(toolkitCoordinator?.elementToolStateStore);

  // Get the DOM element reference for service binding
  let itemElement: HTMLElement | null = $state(null);
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

  // Determine which player to use based on configuration
  // If playerType is 'auto', determine based on available props
  // Priority: IIFE (if bundleHost) > ESM (if esmCdnUrl) > IIFE fallback
  let resolvedPlayerType = $derived.by(() => {
    if (playerType !== "auto") return playerType;
    if (bundleHost) return "iife";
    if (esmCdnUrl) return "esm";
    return "iife"; // fallback
  });

  // Import the appropriate player web component
  onMount(() => {
    // Import components on client side only
    (async () => {
      // Import player based on resolved type
      switch (resolvedPlayerType) {
        case "iife":
          await import("@pie-players/pie-iife-player");
          break;
        case "esm":
          await import("@pie-players/pie-esm-player");
          break;
        case "fixed":
          await import("@pie-players/pie-fixed-player");
          break;
        case "inline":
          await import("@pie-players/pie-inline-player");
          break;
        default:
          console.warn(
            `[ItemRenderer] Unknown player type: ${resolvedPlayerType}, falling back to IIFE`,
          );
          await import("@pie-players/pie-iife-player");
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

    if (playerElement && currentConfig) {
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
    class="pie-section-player__item-renderer {className}"
    bind:this={itemElement}
    data-assessment-id={assessmentId}
    data-section-id={sectionId}
    data-item-id={item.id}
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
      {#if resolvedPlayerType === "iife"}
        <pie-iife-player bind:this={playerElement} bundle-host={bundleHost}
        ></pie-iife-player>
      {:else if resolvedPlayerType === "esm"}
        <pie-esm-player bind:this={playerElement} esm-cdn-url={esmCdnUrl}
        ></pie-esm-player>
      {:else if resolvedPlayerType === "fixed"}
        <pie-fixed-player bind:this={playerElement}></pie-fixed-player>
      {:else if resolvedPlayerType === "inline"}
        <pie-inline-player bind:this={playerElement}></pie-inline-player>
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
    margin-bottom: 1rem;
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
