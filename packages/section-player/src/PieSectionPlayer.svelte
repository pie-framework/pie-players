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

      // Host-facing session state for restoration
      sessionState: { attribute: "session-state", type: "Object" },

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
      // Host-provided web component definitions
      layoutDefinitions: { type: "Object", reflect: false },
    },
  }}
/>

<script lang="ts">
  import {
    assessmentToolkitRuntimeContext,
    ToolkitCoordinator,
    type AssessmentToolkitRuntimeContext,
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
    AssessmentSection,
    RubricBlock,
  } from "@pie-players/pie-players-shared";
  import { onMount } from "svelte";
  import ItemModeLayout from "./components/ItemModeLayout.svelte";
  import { SectionController } from "./controllers/SectionController.js";
  import { SectionToolkitService } from "./controllers/SectionToolkitService.js";
  import type { SectionSessionState, SectionViewModel } from "./controllers/types.js";

  type SectionPlayerRuntimeContext = AssessmentToolkitRuntimeContext & {
    reportSessionChanged?: (itemId: string, detail: unknown) => void;
  };

  const isBrowser = typeof window !== "undefined";

  // Props
  let {
    section = null as AssessmentSection | null,
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
    // Host-facing minimal session model.
    sessionState = null as SectionSessionState | null,
    playerVersion = "latest",
    customClassName = "",
    toolbarPosition = "right" as "top" | "right" | "bottom" | "left" | "none",
    showToolbar = true,
    debug = "" as string | boolean,

    // Toolkit coordinator (host may provide; section player creates one lazily if absent)
    toolkitCoordinator = null as ToolkitCoordinator | null,
    layoutDefinitions = {} as Partial<Record<string, ComponentDefinition>>,

    // Event handlers
    onsessionchanged = null as ((detail: any) => void) | null,
  } = $props();

  type ToolkitCoordinatorReadyDetail = {
    toolkitCoordinator: ToolkitCoordinator;
  };

  const EMPTY_VIEW_MODEL: SectionViewModel = {
    passages: [],
    items: [],
    rubricBlocks: [],
    instructions: [],
    adapterItemRefs: [],
    currentItemIndex: 0,
    isPageMode: false,
  };

  let ownedToolkitCoordinator = $state<ToolkitCoordinator | null>(null);
  let fallbackAssessmentId = $state<string | null>(null);
  let fallbackSectionId = $state<string | null>(null);
  let lastNotifiedCoordinator = $state<ToolkitCoordinator | null>(null);
  let sectionController = $state<SectionController | null>(null);
  let sectionControllerVersion = $state(0);
  const sectionToolkitService = new SectionToolkitService();
  let lastLoadedSignature = $state<string | null>(null);
  let lastControllerInputKey = $state<string | null>(null);
  let lastControllerCoordinator = $state<ToolkitCoordinator | null>(null);

  function getFallbackAssessmentId(): string {
    if (!fallbackAssessmentId) {
      fallbackAssessmentId = `anon_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
    return fallbackAssessmentId;
  }

  function getFallbackSectionId(): string {
    if (!fallbackSectionId) {
      fallbackSectionId = `section_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
    return fallbackSectionId;
  }

  const preferredAssessmentId = $derived.by(() => {
    if (section?.identifier) return section.identifier;
    return null;
  });

  function ensureOwnedCoordinator(): ToolkitCoordinator {
    if (!ownedToolkitCoordinator) {
      ownedToolkitCoordinator = new ToolkitCoordinator({
        assessmentId: preferredAssessmentId ?? getFallbackAssessmentId(),
        lazyInit: true,
      });
    }
    return ownedToolkitCoordinator;
  }

  const coordinator = $derived.by(
    () => (toolkitCoordinator as ToolkitCoordinator | null) ?? ensureOwnedCoordinator(),
  );

  $effect(() => {
    if (!coordinator || coordinator === lastNotifiedCoordinator) return;
    lastNotifiedCoordinator = coordinator;
    const detail: ToolkitCoordinatorReadyDetail = {
      toolkitCoordinator: coordinator,
    };
    emitSectionEvent("toolkit-coordinator-ready", detail);
  });

  // Extract services from coordinator
  const services = $derived.by(() => coordinator.getServiceBundle());
  const assessmentId = $derived(coordinator.assessmentId);

  // Generate or extract sectionId
  const sectionId = $derived.by(() => {
    if (section?.identifier) return section.identifier;
    return getFallbackSectionId();
  });

  // State
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

  function getHostElement(): HTMLElement | null {
    if (!rootElement) return null;
    const rootNode = rootElement.getRootNode();
    if (rootNode && "host" in rootNode) {
      return (rootNode as ShadowRoot).host as HTMLElement;
    }
    return (rootElement.closest("pie-section-player") as HTMLElement | null) ?? null;
  }

  function emitSectionEvent(name: string, detail: unknown): void {
    const event = new CustomEvent(name, {
      detail,
      bubbles: true,
      composed: true,
    });
    const host = getHostElement();
    if (host) {
      host.dispatchEvent(event);
      return;
    }
    dispatchEvent(event);
  }

  function bumpControllerState(): void {
    sectionControllerVersion += 1;
  }

  function syncControllerState(): void {
    if (!sectionController) return;
    const nextSessionState = sectionController.reconcileHostSessionState(sessionState);
    if (nextSessionState) {
      sessionState = nextSessionState;
    }
    bumpControllerState();
  }

  // Extract mode from env for convenience
  let mode = $derived(env.mode);
  let runtimeContextValue = $derived.by(
    (): SectionPlayerRuntimeContext => ({
      toolkitCoordinator: coordinator,
      toolCoordinator: coordinator.toolCoordinator,
      ttsService: services.ttsService,
      highlightCoordinator: services.highlightCoordinator,
      catalogResolver: services.catalogResolver,
      elementToolStateStore: services.elementToolStateStore,
      assessmentId,
      sectionId,
      reportSessionChanged: (itemId: string, detail: unknown) =>
        handleItemSessionChanged(itemId, detail),
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

  const controllerViewModel = $derived.by(() => {
    sectionControllerVersion;
    return sectionController?.getViewModel() || EMPTY_VIEW_MODEL;
  });
  let passages = $derived(controllerViewModel.passages);
  let items = $derived(controllerViewModel.items);
  let rubricBlocks = $derived(controllerViewModel.rubricBlocks);
  let currentItemIndex = $derived(controllerViewModel.currentItemIndex);
  let isPageMode = $derived(controllerViewModel.isPageMode);
  let currentItem = $derived(sectionController?.getCurrentItem() || null);
  const navigationState = $derived.by(() => {
    sectionControllerVersion;
    return (
      sectionController?.getNavigationState(isLoading) || {
        currentIndex: currentItemIndex,
        totalItems: items.length,
        canNext: !isPageMode && currentItemIndex < items.length - 1,
        canPrevious: !isPageMode && currentItemIndex > 0,
        isLoading,
      }
    );
  });
  let canNavigateNext = $derived(navigationState.canNext);
  let canNavigatePrevious = $derived(navigationState.canPrevious);
  const resolvedTestAttemptSession = $derived.by(() => {
    sectionControllerVersion;
    return sectionController?.getResolvedTestAttemptSession() || null;
  });
  const itemSessionsByItemId = $derived.by(() => {
    sectionControllerVersion;
    return sectionController?.getItemSessionsByItemId() || {};
  });

  // Navigate to item (item mode only)
  function navigateToItem(index: number): void {
    if (!sectionController) return;
    const result = sectionController.navigateToItem(index);
    if (!result) return;
    syncControllerState();
    emitSectionEvent("item-changed", result.eventDetail);
  }

  // Public navigation methods are intentionally intra-section (item mode only).
  // Cross-section/page navigation belongs to the higher-level assessment player.
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
    return navigationState;
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
  });

  $effect(() => {
    const resolvedCoordinator = coordinator;
    const inputSection = section;
    const inputView = view;
    const inputAssessmentId = assessmentId;
    const inputSectionId = sectionId;
    const inputSessionState = sessionState;

    let cancelled = false;
    const inputKey = inputSection
      ? `${inputAssessmentId}:${inputSectionId}:${inputView}:${inputSection.identifier || ""}`
      : null;

    if (!inputSection) {
      sectionController = null;
      lastControllerInputKey = null;
      lastControllerCoordinator = null;
      bumpControllerState();
      return;
    }

    if (
      sectionController &&
      inputKey &&
      lastControllerInputKey === inputKey &&
      lastControllerCoordinator === resolvedCoordinator
    ) {
      return;
    }

    void sectionToolkitService
      .resolveSectionController<SectionController>({
        coordinator: resolvedCoordinator,
        sectionId: inputSectionId,
        input: {
          section: inputSection,
          view: inputView,
          assessmentId: inputAssessmentId,
          sectionId: inputSectionId,
          sessionState: inputSessionState,
        },
        createDefaultController: () => new SectionController(),
      })
      .then((controller) => {
        if (cancelled) return;
        sectionController = controller;
        lastControllerInputKey = inputKey;
        lastControllerCoordinator = resolvedCoordinator;
        syncControllerState();
      })
      .catch((err) => {
        if (cancelled) return;
        error = String(err instanceof Error ? err.message : err);
        console.error("[PieSectionPlayer] Failed to resolve section controller:", err);
      });

    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    const resolvedCoordinator = coordinator;
    const resolvedSectionId = sectionId;
    return () => {
      void sectionToolkitService.disposeSectionController({
        coordinator: resolvedCoordinator,
        sectionId: resolvedSectionId,
      });
    };
  });

  $effect(() => {
    if (!section || !sectionController) return;
    const signature =
      `${assessmentId}:${sectionId}:${view}:` +
      `${items.length}:${passages.length}:${isPageMode}`;
    if (signature === lastLoadedSignature) return;
    lastLoadedSignature = signature;
    emitSectionEvent("section-loaded", sectionController.getSectionLoadedEventDetail());
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

    // Ensure item renderers do not mount until required PIE bundles are available.
    elementsLoaded = false;

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
    void coordinator.ensureTTSReady().catch((err: unknown) => {
      console.error("[PieSectionPlayer] Failed to lazily initialize TTS:", err);
    });
  });

  // Listen for TTS errors
  $effect(() => {
    const ttsService = services.ttsService;

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

  // Get instructions from controller-owned content model.
  let instructions = $derived(sectionController?.getInstructions() || []);

  // Handle session changes from items.
  function handleItemSessionChanged(itemId: string, sessionDetail: any): void {
    if (!sectionController) return;
    const canonicalItemId = sectionController.getCanonicalItemId(itemId);
    const result = sectionController.handleItemSessionChanged(
      canonicalItemId,
      sessionDetail,
    );
    if (!result) return;
    syncControllerState();
    const eventDetail = result.eventDetail;

    // Call handler prop if provided (for component callback usage).
    // Keep this as raw detail to avoid double-wrapping CustomEvent.detail.
    if (onsessionchanged) {
      onsessionchanged(eventDetail);
    }

    // Also dispatch event (for custom element usage)
    emitSectionEvent("session-changed", eventDetail);
  }

  // Get current item session
  let currentItemSession = $derived(
    sectionController?.getCurrentItemSession(),
  );

  let shouldRenderToolbar = $derived(showToolbar && toolbarPosition !== "none");

  // Keep toolbar placement attributes synced on the host element.
  $effect(() => {
    if (toolbarElement) {
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
    const layoutElement = pageLayoutElement;
    if (!layoutElement || !isPageMode) return;
    (layoutElement as any).passages = passages;
    (layoutElement as any).items = items;
    (layoutElement as any).itemSessions = itemSessionsByItemId;
    (layoutElement as any).testAttemptSession = resolvedTestAttemptSession;
    (layoutElement as any).env = env;
    (layoutElement as any).playerVersion = playerVersion;
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
            onprevious={navigatePrevious}
            onnext={navigateNext}
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
