<!--
  pie-section-player Custom Element

  A web component for rendering QTI 3.0 assessment sections with passages and items.
  Supports two modes based on keepTogether attribute:
  - keepTogether=true:  Page mode (all items visible with passages)
  - keepTogether=false: Item mode (one item at a time)

  Usage:
    <pie-section-player
      section='{"identifier":"section-1","keepTogether":true,...}'
      mode="gather"
      view="candidate"
      bundle-host="https://cdn.pie.org">
    </pie-section-player>

  Events:
    - section-loaded: Fired when section is loaded and ready
    - item-changed: Fired when current item changes (item mode only)
    - section-complete: Fired when all items completed
    - player-error: Fired on errors
    - toolkit-coordinator-ready: Fired when coordinator is resolved
-->
<svelte:options
  customElement={{
    tag: "pie-section-player",
    shadow: "none",
    props: {
      // Core props
      section: { attribute: "section", type: "Object" },
      env: { attribute: "env", type: "Object" },
      view: { attribute: "view", type: "String" },
      pageLayout: { attribute: "page-layout", type: "String" },

      // Item sessions for restoration
      itemSessions: { attribute: "item-sessions", type: "Object" },
      testAttemptSession: { attribute: "test-attempt-session", type: "Object" },
      activityDefinition: { attribute: "activity-definition", type: "Object" },
      activitySession: { attribute: "activity-session", type: "Object" },

      playerVersion: { attribute: "player-version", type: "String" },

      // Styling
      customClassName: { attribute: "custom-class-name", type: "String" },

      // Tools toolbar position
      toolbarPosition: { attribute: "toolbar-position", type: "String" },
      showToolbar: { attribute: "show-toolbar", type: "Boolean" },

      // Debug
      debug: { attribute: "debug", type: "String" },

      // Toolkit coordinator (JS property, not attribute)
      toolkitCoordinator: { type: "Object", reflect: false },
      ontoolkitcoordinatorready: { type: "Object", reflect: false },
      // Host-provided web component definitions
      layoutDefinitions: { type: "Object", reflect: false },
    },
  }}
/>

<script lang="ts">
  import {
    assessmentToolkitRuntimeContext,
    ToolkitCoordinator,
    mapActivityToTestAttemptSession,
    setCurrentPosition,
    toItemSessionsRecord,
    upsertItemSessionFromPieSessionChange,
    upsertVisitedItem,
    type AssessmentToolkitRuntimeContext,
    type TestAttemptSession,
  } from "@pie-players/pie-assessment-toolkit";
  import { ContextProvider, ContextRoot } from "@pie-players/pie-context";
  import {
    DEFAULT_LAYOUT_DEFINITIONS,
    DEFAULT_PLAYER_DEFINITIONS,
    mergeComponentDefinitions,
    type ComponentDefinition,
  } from "./component-definitions.js";
  import {
    type ElementLoaderInterface,
    IifeElementLoader,
  } from "@pie-players/pie-players-shared";
  import type {
    ItemEntity,
    PassageEntity,
    QtiAssessmentSection,
    RubricBlock,
  } from "@pie-players/pie-players-shared";
  import { onMount, untrack } from "svelte";
  import ItemModeLayout from "./components/ItemModeLayout.svelte";

  const isBrowser = typeof window !== "undefined";

  // Props
  let {
    section = null as QtiAssessmentSection | null,
    env = { mode: "gather", role: "student" } as {
      mode: "gather" | "view" | "evaluate" | "author";
      role: "student" | "instructor";
    },
    view = "candidate" as
      | "candidate"
      | "scorer"
      | "author"
      | "proctor"
      | "testConstructor"
      | "tutor",
    pageLayout = "split-panel",
    itemSessions = {} as Record<string, any>,
    testAttemptSession = null as TestAttemptSession | null,
    activityDefinition = null as Record<string, any> | null,
    activitySession = null as Record<string, any> | null,
    playerVersion = "latest",
    customClassName = "",
    toolbarPosition = "right" as "top" | "right" | "bottom" | "left" | "none",
    showToolbar = true,
    debug = "" as string | boolean,

    // Toolkit coordinator (optional - creates default if not provided)
    toolkitCoordinator = null as any,
    ontoolkitcoordinatorready = null as
      | ((event: CustomEvent<any>) => void)
      | null,
    layoutDefinitions = {} as Partial<Record<string, ComponentDefinition>>,

    // Event handlers
    onsessionchanged = null as ((event: CustomEvent) => void) | null,
  } = $props();

  type ToolkitCoordinatorReadyDetail = {
    toolkitCoordinator: ToolkitCoordinator;
    createdBySectionPlayer: boolean;
  };

  let ownedToolkitCoordinator = $state<ToolkitCoordinator | null>(null);
  let fallbackAssessmentId = $state<string | null>(null);
  let lastNotifiedCoordinator = $state<ToolkitCoordinator | null>(null);

  function getFallbackAssessmentId(): string {
    if (!fallbackAssessmentId) {
      fallbackAssessmentId = `anon_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
    return fallbackAssessmentId;
  }

  const preferredAssessmentId = $derived.by(() => {
    if (section?.identifier) return section.identifier;
    if (typeof activityDefinition?.id === "string" && activityDefinition.id) {
      return activityDefinition.id;
    }
    return null;
  });

  // Lazily create a coordinator only when host does not provide one.
  $effect(() => {
    if (toolkitCoordinator || ownedToolkitCoordinator) return;
    ownedToolkitCoordinator = new ToolkitCoordinator({
      assessmentId: preferredAssessmentId ?? getFallbackAssessmentId(),
      lazyInit: true,
    });
  });

  const coordinator = $derived.by(
    () => (toolkitCoordinator as ToolkitCoordinator | null) ?? ownedToolkitCoordinator,
  );

  $effect(() => {
    if (!coordinator || coordinator === lastNotifiedCoordinator) return;
    lastNotifiedCoordinator = coordinator;
    const detail: ToolkitCoordinatorReadyDetail = {
      toolkitCoordinator: coordinator,
      createdBySectionPlayer: coordinator === ownedToolkitCoordinator,
    };
    const event = new CustomEvent("toolkit-coordinator-ready", {
      detail,
      bubbles: true,
      composed: true,
    });
    ontoolkitcoordinatorready?.(event);
    dispatchEvent(event);
  });

  // Extract services from coordinator
  const services = $derived.by(() => coordinator?.getServiceBundle() ?? null);
  const assessmentId = $derived(coordinator?.assessmentId || "");

  // Generate or extract sectionId
  const sectionId = $derived.by(() => {
    if (section?.identifier) return section.identifier;
    return `section_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  });

  // State
  let passages = $state<PassageEntity[]>([]);
  let items = $state<ItemEntity[]>([]);
  let rubricBlocks = $state<RubricBlock[]>([]);
  let currentItemIndex = $state(0);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Element loading state
  let elementsLoaded = $state(false);

  // TTS error state
  let ttsError = $state<string | null>(null);

  // Section tools toolbar element reference
  let toolbarElement = $state<HTMLElement | null>(null);
  let pageLayoutElement = $state<HTMLElement | null>(null);
  let rootElement = $state<HTMLElement | null>(null);
  let runtimeContextProvider: ContextProvider<
    typeof assessmentToolkitRuntimeContext
  > | null = null;
  let runtimeContextRoot: ContextRoot | null = null;

  // Computed
  let isPageMode = $derived(section?.keepTogether === true);
  let currentItem = $derived(
    isPageMode ? null : items[currentItemIndex] || null,
  );
  let canNavigateNext = $derived(
    !isPageMode && currentItemIndex < items.length - 1,
  );
  let canNavigatePrevious = $derived(!isPageMode && currentItemIndex > 0);

  // Extract mode from env for convenience
  let mode = $derived(env.mode);
  let runtimeContextValue = $derived.by(
    (): AssessmentToolkitRuntimeContext => ({
      toolkitCoordinator: coordinator,
      toolCoordinator: coordinator?.toolCoordinator || null,
      ttsService: services?.ttsService ?? null,
      highlightCoordinator: services?.highlightCoordinator ?? null,
      catalogResolver: services?.catalogResolver ?? null,
      elementToolStateStore: services?.elementToolStateStore ?? null,
      assessmentId,
      sectionId,
    }),
  );
  let resolvedPlayerDefinition = $derived.by(
    () => DEFAULT_PLAYER_DEFINITIONS["iife"],
  );
  let resolvedPlayerTag = $derived(
    resolvedPlayerDefinition?.tagName || "pie-iife-player",
  );
  let mergedLayoutDefinitions = $derived.by(() =>
    mergeComponentDefinitions(DEFAULT_LAYOUT_DEFINITIONS, layoutDefinitions),
  );
  let resolvedPageLayout = $derived(pageLayout);
  let resolvedLayoutDefinition = $derived.by(
    () =>
      mergedLayoutDefinitions[resolvedPageLayout] ||
      mergedLayoutDefinitions["split-panel"],
  );
  let resolvedLayoutTag = $derived(
    resolvedLayoutDefinition?.tagName || "pie-split-panel-layout",
  );

  const adapterItemRefs = $derived.by(() =>
    (section?.assessmentItemRefs || []).map((itemRef) => ({
      identifier: itemRef.identifier || itemRef.item?.id || itemRef.item?.name,
      item: {
        id: itemRef.item?.id,
        identifier: itemRef.identifier || itemRef.item?.id,
      },
    })),
  );

  // Canonical attempt runtime source of truth for section player integration.
  const resolvedTestAttemptSession = $derived.by(
    () =>
      testAttemptSession ||
      mapActivityToTestAttemptSession({
        activityDefinition,
        activitySession,
        itemRefs: adapterItemRefs,
        itemSessionsByItemIdentifier: itemSessions,
        assessmentId,
      }),
  );

  const resolvedItemSessions = $derived.by(
    () => toItemSessionsRecord(resolvedTestAttemptSession) as Record<string, any>,
  );

  // Extract content from section
  function extractContent() {
    if (!section) {
      passages = [];
      items = [];
      rubricBlocks = [];
      return;
    }

    const passageMap = new Map<string, PassageEntity>();

    // Extract rubric blocks for current view
    rubricBlocks = (section.rubricBlocks || []).filter(
      (rb) => rb.view === view,
    );

    // 1. Extract passages from rubricBlocks
    // IMPORTANT: Always extract passages from 'candidate' view, regardless of current view
    // Passages should be visible in both candidate and scorer modes
    const allRubricBlocks = section.rubricBlocks || [];
    for (const rb of allRubricBlocks) {
      if (rb.class === "stimulus" && rb.passage && rb.passage.id) {
        // Include passages from candidate view (always shown) and current view
        if (rb.view === "candidate" || rb.view === view) {
          passageMap.set(rb.passage.id, rb.passage);
        }
      }
    }

    // 2. Extract items and their linked passages
    items = [];
    for (const itemRef of section.assessmentItemRefs || []) {
      if (itemRef.item) {
        items.push(itemRef.item);

        // Item-linked passage (deduplicated)
        if (
          itemRef.item.passage &&
          typeof itemRef.item.passage === "object" &&
          itemRef.item.passage.id
        ) {
          if (!passageMap.has(itemRef.item.passage.id)) {
            passageMap.set(itemRef.item.passage.id, itemRef.item.passage);
          }
        }
      }
    }

    passages = Array.from(passageMap.values());
  }

  // Navigate to item (item mode only)
  function navigateToItem(index: number) {
    if (isPageMode) {
      console.warn(
        "[PieSectionPlayer] Navigation called in page mode - ignoring",
      );
      return;
    }

    if (index < 0 || index >= items.length) {
      return;
    }

    const previousItemId = currentItem?.id || "";
    currentItemIndex = index;
    const nextItemId = items[index]?.id || "";

    testAttemptSession = upsertVisitedItem(
      setCurrentPosition(resolvedTestAttemptSession, {
        currentItemIndex: index,
        currentSectionIdentifier: section?.identifier,
      }),
      nextItemId,
    );

    // Dispatch event
    dispatchEvent(
      new CustomEvent("item-changed", {
        detail: {
          previousItemId,
          currentItemId: currentItem?.id || "",
          itemIndex: currentItemIndex,
          totalItems: items.length,
          timestamp: Date.now(),
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // Public navigation methods (for item mode)
  export function navigateNext() {
    if (canNavigateNext) {
      navigateToItem(currentItemIndex + 1);
    }
  }

  export function navigatePrevious() {
    if (canNavigatePrevious) {
      navigateToItem(currentItemIndex - 1);
    }
  }

  export function getNavigationState() {
    return {
      currentIndex: currentItemIndex,
      totalItems: items.length,
      canNext: canNavigateNext,
      canPrevious: canNavigatePrevious,
      isLoading,
    };
  }

  // Lifecycle
  onMount(() => {
    if (isBrowser) {
      import("@pie-players/pie-section-tools-toolbar").catch((err) => {
        console.error(
          "[PieSectionPlayer] Failed to load section tools toolbar:",
          err,
        );
      });
    }

    extractContent();

    // Dispatch loaded event
    dispatchEvent(
      new CustomEvent("section-loaded", {
        detail: {
          sectionId: section?.identifier || "",
          itemCount: items.length,
          passageCount: passages.length,
          isPageMode,
        },
        bubbles: true,
        composed: true,
      }),
    );
  });

  // Ensure selected page-mode layout web component is registered.
  $effect(() => {
    if (!isPageMode) return;
    resolvedLayoutDefinition?.ensureDefined?.().catch((err) => {
      console.error("[PieSectionPlayer] Failed to load layout component:", err);
    });
  });

  // Ensure selected player web component is registered.
  $effect(() => {
    resolvedPlayerDefinition?.ensureDefined?.().catch((err) => {
      console.error("[PieSectionPlayer] Failed to load player component:", err);
    });
  });

  // React to section changes
  $effect(() => {
    // Track section to react to changes, but don't track the execution of extractContent
    const currentSection = section;
    if (currentSection) {
      untrack(() => extractContent());
    }
  });

  // Element pre-loading effect (loads all unique elements before rendering items)
  $effect(() => {
    if (!section) {
      elementsLoaded = false;
      return;
    }

    // Collect all renderables needing element preloading:
    // - passages (stimulus rubric blocks / linked passages)
    // - assessment items
    // - rubric blocks with PIE passage configs (e.g. instructions/rubrics)
    const additionalRubricPassages = (rubricBlocks || [])
      .map((rb) => rb?.passage)
      .filter((p): p is PassageEntity => !!p && !!p.config);
    const allItems: ItemEntity[] = [...passages, ...items, ...additionalRubricPassages];

    if (allItems.length === 0) {
      elementsLoaded = true;
      return;
    }

    const effectiveBundleHost = String(
      resolvedPlayerDefinition?.attributes?.["bundle-host"] || "",
    );

    // Create the loader from the fixed IIFE player definition.
    let loader: ElementLoaderInterface | null = null;

    if (effectiveBundleHost) {
      loader = new IifeElementLoader({
        bundleHost: effectiveBundleHost,
        debugEnabled: () => !!debug,
      });
    } else {
      console.warn("[PieSectionPlayer] Missing bundle-host for IIFE element preloader.");
      elementsLoaded = true;
      return;
    }

    // Load all elements upfront
    loader
      .loadFromItems(allItems, {
        view: mode === "author" ? "author" : "delivery",
        needsControllers: true,
      })
      .then(() => {
        elementsLoaded = true;
        console.log(
          `[PieSectionPlayer] Loaded elements for ${allItems.length} items`,
        );
      })
      .catch((err) => {
        console.error("[PieSectionPlayer] Failed to load elements:", err);
        // Still set loaded to true to allow rendering (items will handle their own errors)
        elementsLoaded = true;
      });

    // Cleanup
    return () => {
      // Cleanup if needed
    };
  });

  // Listen for TTS errors
  $effect(() => {
    if (!showToolbar) return;
    if (typeof coordinator?.ensureTTSReady !== "function") return;
    void coordinator.ensureTTSReady().catch((err: unknown) => {
      console.error("[PieSectionPlayer] Failed to lazily initialize TTS:", err);
    });
  });

  // Listen for TTS errors
  $effect(() => {
    const ttsService = services?.ttsService;
    if (!ttsService) {
      ttsError = null;
      return;
    }

    const handleTTSStateChange = (state: any) => {
      // PlaybackState.ERROR = "error"
      if (state === "error") {
        const errorMsg =
          ttsService.getLastError?.() || "Text-to-speech error occurred";
        ttsError = errorMsg;
        console.error("[PieSectionPlayer] TTS error:", errorMsg);
      } else if (state === "playing" || state === "loading") {
        // Clear error when successfully starting playback
        ttsError = null;
      }
    };

    ttsService.onStateChange?.("section-player", handleTTSStateChange);

    // Cleanup
    return () => {
      ttsService.offStateChange?.("section-player", handleTTSStateChange);
    };
  });

  // Get instructions
  let instructions = $derived(
    rubricBlocks.filter((rb) => rb.class === "instructions"),
  );

  // Handle session changes from items
  function handleSessionChanged(itemId: string, sessionDetail: any) {
    console.log(
      "[PieSectionPlayer] handleSessionChanged called:",
      itemId,
      sessionDetail,
    );

    // Extract the actual session data from the event detail
    // The sessionDetail contains { complete, component, session }
    // We want to store the session property
    const actualSession = sessionDetail.session || sessionDetail;

    // Only update itemSessions if we have valid session data structure
    // The session should have an 'id' property and a 'data' array
    // Skip metadata-only events that just have { complete, component }
    if (actualSession && ("id" in actualSession || "data" in actualSession)) {
      testAttemptSession = upsertItemSessionFromPieSessionChange(
        resolvedTestAttemptSession,
        {
          itemIdentifier: itemId,
          pieSessionId: String(actualSession.id || itemId),
          isCompleted: Boolean(sessionDetail.complete),
          session: actualSession,
        },
      );
    }

    // Create event detail with session and metadata kept separate
    const eventDetail = {
      itemId,
      session: resolvedItemSessions[itemId] || actualSession,
      testAttemptSession,
      complete: sessionDetail.complete,
      component: sessionDetail.component,
      timestamp: Date.now(),
    };

    // Call handler prop if provided (for Svelte component usage)
    if (onsessionchanged) {
      const customEvent = new CustomEvent("session-changed", {
        detail: eventDetail,
        bubbles: true,
        composed: true,
      });
      onsessionchanged(customEvent);
    }

    // Also dispatch event (for custom element usage)
    dispatchEvent(
      new CustomEvent("session-changed", {
        detail: eventDetail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  // Get current item session
  let currentItemSession = $derived(
    currentItem ? resolvedItemSessions[currentItem.id || ""] : undefined,
  );

  let shouldRenderToolbar = $derived(showToolbar && toolbarPosition !== "none");

  // Bind toolkitCoordinator, registry, position, and enabled tools to toolbar element
  $effect(() => {
    if (toolbarElement) {
      if (coordinator) {
        (toolbarElement as any).toolCoordinator = coordinator.toolCoordinator;
        (toolbarElement as any).toolProviderRegistry =
          coordinator.toolProviderRegistry;
      }
      // Set position property and attribute
      (toolbarElement as any).position = toolbarPosition;
      toolbarElement.setAttribute("position", toolbarPosition);
      toolbarElement.setAttribute("data-position", toolbarPosition);
      // Let section toolbar compute allowed tools from placement/context.
      (toolbarElement as any).enabledTools = "";
      toolbarElement.setAttribute("enabled-tools", "");
    }
  });

  // Establish runtime context provider at the section-player root.
  $effect(() => {
    if (!rootElement) return;
    const provider = new ContextProvider(rootElement, {
      context: assessmentToolkitRuntimeContext,
      initialValue: runtimeContextValue,
    });
    provider.connect();
    runtimeContextProvider = provider;

    const root = new ContextRoot(rootElement);
    root.attach();
    runtimeContextRoot = root;

    return () => {
      runtimeContextRoot?.detach();
      runtimeContextRoot = null;
      runtimeContextProvider?.disconnect();
      runtimeContextProvider = null;
    };
  });

  // Push runtime value updates into the provider.
  $effect(() => {
    if (!runtimeContextProvider) return;
    runtimeContextProvider.setValue(runtimeContextValue);
  });

  // Bind page-mode layout custom element properties imperatively.
  $effect(() => {
    if (!pageLayoutElement || !isPageMode) return;
    (pageLayoutElement as any).passages = passages;
    (pageLayoutElement as any).items = items;
    (pageLayoutElement as any).itemSessions = resolvedItemSessions;
    (pageLayoutElement as any).testAttemptSession = resolvedTestAttemptSession;
    (pageLayoutElement as any).env = env;
    (pageLayoutElement as any).playerVersion = playerVersion;
    (pageLayoutElement as any).assessmentId = assessmentId;
    (pageLayoutElement as any).sectionId = sectionId;
    (pageLayoutElement as any).onsessionchanged = handleSessionChanged;
  });
</script>

<div
  class={`pie-section-player ${customClassName} ${isPageMode ? "pie-section-player--page-mode" : "pie-section-player--item-mode"}`}
  data-assessment-id={assessmentId}
  data-section-id={sectionId}
  bind:this={rootElement}
>
  {#if error}
    <div class="pie-section-player__error">
      <p>Error loading section: {error}</p>
    </div>
  {:else if section}
    <!-- Instructions -->
    {#if instructions.length > 0}
      <div class="pie-section-player__instructions">
        {#each instructions as rb}
          {#if rb.passage && rb.passage.config}
            <svelte:element
              this={resolvedPlayerTag}
              {...({
                config: JSON.stringify(rb.passage.config),
                env: JSON.stringify({ mode: "view" }),
                "skip-element-loading": true,
                ...(resolvedPlayerDefinition?.attributes || {}),
              } as any)}
            ></svelte:element>
          {/if}
        {/each}
      </div>
    {/if}

    <!-- TTS Error Banner -->
    {#if ttsError}
      <div class="pie-section-player__tts-error-banner" role="alert">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>Text-to-speech unavailable: {ttsError}</span>
        <button
          class="pie-section-player__tts-error-dismiss"
          onclick={() => (ttsError = null)}
          aria-label="Dismiss error"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    {/if}

    <!-- Main content area -->
    <div class="pie-section-player__content">
      {#if elementsLoaded}
        {#if isPageMode}
          <!-- Page Mode: Choose layout based on layout prop -->
          {#key resolvedLayoutTag}
            <svelte:element
              this={resolvedLayoutTag}
              class="pie-section-player__page-layout"
              bind:this={pageLayoutElement}
            >
            </svelte:element>
          {/key}
        {:else}
          <!-- Item Mode: Use internal Svelte component -->
          <ItemModeLayout
            {passages}
            {currentItem}
            currentIndex={currentItemIndex}
            totalItems={items.length}
            canNext={canNavigateNext}
            canPrevious={canNavigatePrevious}
            itemSession={currentItemSession}
            {env}
            {playerVersion}
            {assessmentId}
            {sectionId}
            onprevious={navigatePrevious}
            onnext={navigateNext}
            onsessionchanged={(sessionDetail) =>
              handleSessionChanged(currentItem?.id || "", sessionDetail)}
          />
        {/if}
      {:else}
        <div class="pie-section-player__loading">
          <p>Loading assessment elements...</p>
        </div>
      {/if}
    </div>

    <!-- Section-level floating tools toolbar -->
    {#if shouldRenderToolbar}
      <pie-section-tools-toolbar
        bind:this={toolbarElement}
        position={toolbarPosition}
        enabled-tools=""
      ></pie-section-tools-toolbar>
    {/if}
  {:else}
    <div class="pie-section-player__loading">
      <p>Loading section...</p>
    </div>
  {/if}
</div>

<style>
  /* In no-shadow custom-element mode, enforce host-like sizing via global tag rule. */
  :global(pie-section-player) {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
    max-height: 100%;
    overflow: hidden;
  }

  :host {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
    max-height: 100%;
    overflow: hidden;
  }
  .pie-section-player {
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 0;
    max-height: 100%;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
      Ubuntu, Cantarell, sans-serif;
  }

  /* Layout direction based on toolbar position */
  .pie-section-player:has(pie-section-tools-toolbar[position="top"]),
  .pie-section-player:has(pie-section-tools-toolbar[position="bottom"]),
  .pie-section-player:has(
      :global(pie-section-tools-toolbar[data-position="top"])
    ),
  .pie-section-player:has(
      :global(pie-section-tools-toolbar[data-position="bottom"])
    ),
  .pie-section-player:not(:has(pie-section-tools-toolbar[position])):not(
      :has(pie-section-tools-toolbar[data-position])
    ) {
    flex-direction: column;
  }

  .pie-section-player:has(pie-section-tools-toolbar[position="left"]),
  .pie-section-player:has(pie-section-tools-toolbar[position="right"]),
  .pie-section-player:has(
      :global(pie-section-tools-toolbar[data-position="left"])
    ),
  .pie-section-player:has(
      :global(pie-section-tools-toolbar[data-position="right"])
    ) {
    flex-direction: row;
  }

  /* Toolbar ordering - control whether toolbar appears before or after content */
  .pie-section-player:has(pie-section-tools-toolbar[position="top"])
    .pie-section-player__content,
  .pie-section-player:has(
      :global(pie-section-tools-toolbar[data-position="top"])
    )
    .pie-section-player__content {
    order: 2;
  }

  .pie-section-player:has(pie-section-tools-toolbar[position="top"])
    pie-section-tools-toolbar,
  .pie-section-player:has(
      :global(pie-section-tools-toolbar[data-position="top"])
    )
    pie-section-tools-toolbar {
    order: 1;
  }

  .pie-section-player:has(pie-section-tools-toolbar[position="left"])
    .pie-section-player__content,
  .pie-section-player:has(
      :global(pie-section-tools-toolbar[data-position="left"])
    )
    .pie-section-player__content {
    order: 2;
  }

  .pie-section-player:has(pie-section-tools-toolbar[position="left"])
    pie-section-tools-toolbar,
  .pie-section-player:has(
      :global(pie-section-tools-toolbar[data-position="left"])
    )
    pie-section-tools-toolbar {
    order: 1;
  }

  /* Main content area takes remaining space */
  .pie-section-player__content {
    flex: 1;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Ensure dynamic page-layout custom elements are height-constrained containers. */
  .pie-section-player__page-layout {
    display: block;
    flex: 1;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
  }

  .pie-section-player__error {
    padding: 1rem;
    background: var(--pie-incorrect-secondary, #fee);
    border: 1px solid var(--pie-incorrect, #fcc);
    border-radius: 4px;
    color: var(--pie-incorrect-icon, #c00);
  }

  .pie-section-player__loading {
    padding: 2rem;
    text-align: center;
    color: var(--pie-disabled, #666);
  }

  .pie-section-player__instructions {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--pie-secondary-background, #f5f5f5);
    border-radius: 4px;
  }

  .pie-section-player__tts-error-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    margin-bottom: 1rem;
    background: var(--pie-secondary-background, #fff3cd);
    border: 1px solid var(--pie-missing, #ffc107);
    border-radius: 4px;
    color: var(--pie-text, #856404);
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .pie-section-player__tts-error-banner svg {
    flex-shrink: 0;
  }

  .pie-section-player__tts-error-banner span {
    flex: 1;
  }

  .pie-section-player__tts-error-dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    background: transparent;
    border: none;
    border-radius: 2px;
    color: var(--pie-text, #856404);
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .pie-section-player__tts-error-dismiss:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  .pie-section-player__tts-error-dismiss:focus {
    outline: 2px solid var(--pie-focus-checked-border, #856404);
    outline-offset: 2px;
  }
</style>
