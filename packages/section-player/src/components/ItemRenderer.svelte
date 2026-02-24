<!--
  ItemRenderer - Internal Component

  Renders a single item using pie-iife-player or pie-esm-player.
  Handles SSML extraction, TTS service binding, and player lifecycle.
-->
<script lang="ts">
  import {
    SSMLExtractor,
    assessmentToolkitRuntimeContext,
    type AssessmentToolkitRuntimeContext,
  } from "@pie-players/pie-assessment-toolkit";
  import { ContextConsumer } from "@pie-players/pie-context";
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

  // Get the DOM element reference for service binding
  let contextHostElement: HTMLElement | null = $state(null);
  let itemContentElement: HTMLElement | null = $state(null);
  let questionToolbarElement: HTMLElement | null = $state(null);
  let calculatorElement: HTMLElement | null = $state(null);
  let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
  let runtimeContextConsumer: ContextConsumer<
    typeof assessmentToolkitRuntimeContext
  > | null = null;

  // Context-first: resolve runtime dependencies from context with prop fallback.
  const effectiveToolkitCoordinator = $derived(
    toolkitCoordinator || runtimeContext?.toolkitCoordinator,
  );
  const toolCoordinator = $derived(
    effectiveToolkitCoordinator?.toolCoordinator || runtimeContext?.toolCoordinator,
  );
  const catalogResolver = $derived(
    effectiveToolkitCoordinator?.catalogResolver || runtimeContext?.catalogResolver,
  );
  const effectiveAssessmentId = $derived(
    assessmentId || runtimeContext?.assessmentId || "",
  );
  const effectiveSectionId = $derived(sectionId || runtimeContext?.sectionId || "");

  // Consume runtime context from the section-player provider tree.
  $effect(() => {
    if (!contextHostElement) return;
    runtimeContextConsumer = new ContextConsumer(contextHostElement, {
      context: assessmentToolkitRuntimeContext,
      subscribe: true,
      onValue: (value: AssessmentToolkitRuntimeContext) => {
        runtimeContext = value;
      },
    });
    runtimeContextConsumer.connect();
    return () => {
      runtimeContextConsumer?.disconnect();
      runtimeContextConsumer = null;
    };
  });

  // Set toolkitCoordinator on calculator element.
  $effect(() => {
    if (calculatorElement && effectiveToolkitCoordinator) {
      (calculatorElement as any).toolkitCoordinator = effectiveToolkitCoordinator;
    }
  });

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
    if (!questionToolbarElement) return;
    if (itemContentElement) {
      (questionToolbarElement as any).scopeElement = itemContentElement;
    }
    if (effectiveAssessmentId) {
      (questionToolbarElement as any).assessmentId = effectiveAssessmentId;
    }
    if (effectiveSectionId) {
      (questionToolbarElement as any).sectionId = effectiveSectionId;
    }
    if (item) {
      (questionToolbarElement as any).item = item;
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

<div bind:this={contextHostElement}>
  {#if item.config}
    <ItemShell
      {item}
      {contentKind}
      assessmentId={effectiveAssessmentId}
      sectionId={effectiveSectionId}
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
</div>

<style>
  .pie-section-player__item-content {
    padding: 1rem;
    border: 1px solid var(--pie-border-light, #e5e7eb);
    border-radius: 4px;
  }
</style>
