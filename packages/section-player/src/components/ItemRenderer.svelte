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
  import ItemPlayerBridge from "./ItemPlayerBridge.svelte";
  import ItemShell, { type QtiContentKind } from "./ItemShell.svelte";
  import type { ItemEntity, PassageEntity } from "@pie-players/pie-players-shared";
  import { onMount, untrack } from "svelte";

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
  const toolCoordinator = $derived(toolkitCoordinator?.toolCoordinator);
  const catalogResolver = $derived(toolkitCoordinator?.catalogResolver);

  // Get the DOM element reference for service binding
  let itemContentElement: HTMLElement | null = $state(null);
  let questionToolbarElement: HTMLElement | null = $state(null);
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

  onMount(() => {
    // Cleanup: clear this item's catalogs on unmount.
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

  // Bind direct item contracts to question toolbar.
  $effect(() => {
    if (questionToolbarElement && !toolbarServicesBound) {
      if (itemContentElement) {
        (questionToolbarElement as any).scopeElement = itemContentElement;
      }
      if (assessmentId) {
        (questionToolbarElement as any).assessmentId = assessmentId;
      }
      if (sectionId) {
        (questionToolbarElement as any).sectionId = sectionId;
      }
      if (item) {
        (questionToolbarElement as any).item = item;
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
</script>

{#if item.config}
  <ItemShell
    {item}
    {contentKind}
    {assessmentId}
    {sectionId}
    {customClassName}
  >
    <pie-question-toolbar
      slot="toolbar"
      bind:this={questionToolbarElement}
      item-id={item.id}
      catalog-id={item.id}
      tools="calculator,tts,answerEliminator"
      content-kind={contentKind}
      size="md"
      language="en-US"
    ></pie-question-toolbar>

    <div class="pie-section-player__item-content" bind:this={itemContentElement}>
      <ItemPlayerBridge
        {item}
        {env}
        {session}
        {hasElements}
        resolvedPlayerTag={resolvedPlayerTag}
        resolvedPlayerDefinition={resolvedPlayerDefinition}
        {skipElementLoading}
        {onsessionchanged}
      />
    </div>
  </ItemShell>

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
  .pie-section-player__item-content {
    padding: 1rem;
    border: 1px solid var(--pie-border-light, #e5e7eb);
    border-radius: 4px;
  }
</style>
