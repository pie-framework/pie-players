<!--
  ItemRenderer - Internal Component

  Renders a single item using the IIFE player.
  Handles SSML extraction, TTS service binding, and player lifecycle.
-->
<script lang="ts">
  import {
    SSMLExtractor,
    assessmentToolkitRuntimeContext,
    createScopedToolId,
    type AssessmentToolkitRuntimeContext,
  } from "@pie-players/pie-assessment-toolkit";
  import { ContextConsumer } from "@pie-players/pie-context";
  import "@pie-players/pie-assessment-toolkit/components/item-toolbar-element";
	import {
		DEFAULT_PLAYER_DEFINITIONS,
	} from "../component-definitions.js";
  import ItemPlayerBridge from "./ItemPlayerBridge.svelte";
  import ItemShell, { type QtiContentKind } from "./ItemShell.svelte";
  import type { ItemEntity, PassageEntity } from "@pie-players/pie-players-shared";
  import { onMount, untrack } from "svelte";

  type SectionPlayerRuntimeContext = AssessmentToolkitRuntimeContext & {
    reportSessionChanged?: (itemId: string, detail: unknown) => void;
  };

  let {
    item,
    env = { mode: "gather", role: "student" },
    session = { id: "", data: [] },
    contentKind = "assessment-item" as QtiContentKind,
    skipElementLoading = true,
    customClassName = "",
    onsessionchanged,
  }: {
    item: ItemEntity | PassageEntity;
    env?: {
      mode: "gather" | "view" | "evaluate" | "author";
      role: "student" | "instructor";
    };
    session?: any;
    contentKind?: QtiContentKind;
    skipElementLoading?: boolean;
    playerVersion?: string;
    customClassName?: string;
    onsessionchanged?: (event: CustomEvent) => void;
  } = $props();

  function handlePlayerSessionChanged(event: CustomEvent) {
    console.debug("[ItemRenderer][SessionTrace] handlePlayerSessionChanged", {
      itemId: item?.id || null,
      contentKind,
      hasRuntimeReporter: !!runtimeContext?.reportSessionChanged,
      hasOnSessionChangedProp: !!onsessionchanged,
      detailKeys:
        event?.detail && typeof event.detail === "object"
          ? Object.keys(event.detail)
          : [],
    });
    // Section item sessions are reported through runtime context to avoid
    // callback prop-drilling across internal layout components.
    if (contentKind === "assessment-item") {
      const itemId = item.id || "";
      if (itemId && runtimeContext?.reportSessionChanged) {
        console.debug("[ItemRenderer][SessionTrace] forwarding via runtimeContext", {
          itemId,
        });
        event.stopPropagation();
        runtimeContext.reportSessionChanged(itemId, event.detail);
        return;
      }
    }
    if (onsessionchanged) {
      console.debug("[ItemRenderer][SessionTrace] forwarding via onsessionchanged prop", {
        itemId: item?.id || null,
      });
      event.stopPropagation();
      onsessionchanged(event);
    }
  }

  // Get the DOM element reference for service binding
  let contextHostElement: HTMLElement | null = $state(null);
  let itemContentElement: HTMLElement | null = $state(null);
  let itemToolbarElement: HTMLElement | null = $state(null);
  let runtimeContext = $state<SectionPlayerRuntimeContext | null>(null);
  let runtimeContextConsumer: ContextConsumer<
    typeof assessmentToolkitRuntimeContext
  > | null = null;

  // Runtime dependencies come from assessment toolkit context.
  const effectiveToolkitCoordinator = $derived(runtimeContext?.toolkitCoordinator);
  const toolCoordinator = $derived(
    effectiveToolkitCoordinator?.toolCoordinator,
  );
  const catalogResolver = $derived(
    effectiveToolkitCoordinator?.catalogResolver,
  );

  // Consume runtime context from the section-player provider tree.
  $effect(() => {
    if (!contextHostElement) return;
    runtimeContextConsumer = new ContextConsumer(contextHostElement, {
      context: assessmentToolkitRuntimeContext,
      subscribe: true,
      onValue: (value: AssessmentToolkitRuntimeContext) => {
        runtimeContext = value as SectionPlayerRuntimeContext;
      },
    });
    runtimeContextConsumer.connect();
    return () => {
      runtimeContextConsumer?.disconnect();
      runtimeContextConsumer = null;
    };
  });

  let calculatorVisible = $state(false);

  let hasElements = $derived(
    !!(item?.config?.elements && Object.keys(item.config.elements).length > 0),
  );

  let resolvedPlayerDefinition = $derived.by(
    () => {
      const configuredType = runtimeContext?.itemPlayer?.type;
      return (
        (configuredType
          ? DEFAULT_PLAYER_DEFINITIONS[configuredType]
          : DEFAULT_PLAYER_DEFINITIONS["iife"]) || DEFAULT_PLAYER_DEFINITIONS["iife"]
      );
    },
  );
  let resolvedPlayerTag = $derived(
    runtimeContext?.itemPlayer?.tagName || resolvedPlayerDefinition?.tagName || "pie-item-player",
  );

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

  // Bind direct item contracts to item toolbar.
  $effect(() => {
    if (!itemToolbarElement) return;
    if (itemContentElement) {
      (itemToolbarElement as any).scopeElement = itemContentElement;
    }
    if (item) {
      (itemToolbarElement as any).item = item;
    }
  });


  // Subscribe to calculator visibility changes
  $effect(() => {
    if (!toolCoordinator || !item) return;
    const scopedCalculatorId = createScopedToolId(
      "calculator",
      "item",
      item.id || "unknown-item",
    );

    const unsubscribe = toolCoordinator.subscribe(() => {
      calculatorVisible = toolCoordinator.isToolVisible(scopedCalculatorId);
    });

    // Initial update
    calculatorVisible = toolCoordinator.isToolVisible(scopedCalculatorId);

    return unsubscribe;
  });
</script>

<div bind:this={contextHostElement} data-item-id={item.id || ""}>
  {#if item.config}
    <ItemShell
      {item}
      {contentKind}
      {customClassName}
    >
      <pie-item-toolbar
        slot="toolbar"
        bind:this={itemToolbarElement}
        item-id={item.id}
        catalog-id={item.id}
        tools="calculator,tts,answerEliminator"
        content-kind={contentKind}
        size="md"
        language="en-US"
      ></pie-item-toolbar>

      <div class="pie-section-player__item-content" bind:this={itemContentElement}>
        <ItemPlayerBridge
          {item}
          {env}
          {session}
          {hasElements}
          resolvedPlayerTag={resolvedPlayerTag}
          resolvedPlayerDefinition={resolvedPlayerDefinition}
          {skipElementLoading}
          onsessionchanged={handlePlayerSessionChanged}
        />
      </div>
    </ItemShell>

    <!-- Calculator Tool Instance (rendered outside panel for floating overlay) -->
    {#if item}
      <pie-tool-calculator
        visible={calculatorVisible}
        tool-id={createScopedToolId("calculator", "item", item.id || "unknown-item")}
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
