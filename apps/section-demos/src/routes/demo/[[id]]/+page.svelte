<script lang="ts">
  import "@pie-players/pie-theme-daisyui";
  import {
    ToolkitCoordinator,
    BrowserTTSProvider,
    AnnotationToolbarAPIClient,
  } from "@pie-players/pie-assessment-toolkit";
  import "@pie-players/pie-tool-annotation-toolbar";
  import { ServerTTSProvider } from "@pie-players/tts-client-server";

  // Load the web component
  onMount(async () => {
    await import("@pie-players/pie-section-player");
  });
  import { Editor } from "@tiptap/core";
  import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
  import Document from "@tiptap/extension-document";
  import History from "@tiptap/extension-history";
  import Text from "@tiptap/extension-text";
  import { common, createLowlight } from "lowlight";
  import { onDestroy, onMount, untrack } from "svelte";
  import { browser } from "$app/environment";
  import AssessmentToolkitSettings from "$lib/components/AssessmentToolkitSettings.svelte";
  import SessionDataWindow from "$lib/components/SessionDataWindow.svelte";
  import SourceEditorWindow from "$lib/components/SourceEditorWindow.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  // Read URL params for initial state
  function getInitialPlayerType(): "iife" | "esm" {
    if (browser) {
      const urlPlayerType = new URLSearchParams(window.location.search).get(
        "player",
      );
      if (urlPlayerType && ["iife", "esm"].includes(urlPlayerType)) {
        return urlPlayerType as "iife" | "esm";
      }
    }
    return "iife";
  }

  function getInitialLayoutType(): "vertical" | "split-panel" {
    if (browser) {
      const urlLayoutType = new URLSearchParams(window.location.search).get(
        "layout",
      );
      if (
        urlLayoutType &&
        ["vertical", "split-panel"].includes(urlLayoutType)
      ) {
        return urlLayoutType as "vertical" | "split-panel";
      }
    }
    return "split-panel";
  }

  function getInitialMode(): "candidate" | "scorer" {
    if (browser) {
      const urlMode = new URLSearchParams(window.location.search).get("mode");
      if (urlMode && ["candidate", "scorer"].includes(urlMode)) {
        return urlMode as "candidate" | "scorer";
      }
    }
    return "candidate";
  }

  function getInitialEsmSource(): "local" | "remote" {
    if (browser) {
      const urlParam = new URLSearchParams(window.location.search).get(
        "esmSource",
      );
      if (urlParam === "local") {
        return "local";
      }
    }
    return "remote";
  }

  let playerType = $state<"iife" | "esm">(getInitialPlayerType());
  let layoutType = $state<"vertical" | "split-panel">(getInitialLayoutType());
  let roleType = $state<"candidate" | "scorer">(getInitialMode());
  let esmSource = $state<"local" | "remote">(getInitialEsmSource());
  let toolbarPosition = $state<"top" | "right" | "bottom" | "left">("right");
  let layoutConfig = $state({
    toolbarPosition: "right" as "top" | "right" | "bottom" | "left",
  });
  let showSessionPanel = $state(false);
  let showSourcePanel = $state(false);
  let sectionPlayer: any = $state(null);
  let itemSessions = $state<Record<string, any>>({});
  let itemMetadata = $state<
    Record<string, { complete?: boolean; component?: string }>
  >({});
  const canonicalSessionSnapshot = $derived.by(() => ({
    testAttemptSession:
      toolkitCoordinator?.testAttemptSessionTracker?.getSnapshot?.() ?? null,
    itemSessionsByItemId: itemSessions,
    itemMetadataByItemId: itemMetadata,
  }));

  // Toolkit coordinator (owns all services)
  let toolkitCoordinator: any = $state(null);
  let ttsProvider: "polly" | "browser" | "loading" =
    $state("loading");
  let showTTSSettings = $state(false);

  // TTS Configuration
  interface TTSConfig {
    provider: "polly" | "browser";
    voice: string;
    rate: number;
    pitch: number;
    pollyEngine?: "neural" | "standard";
    pollySampleRate?: number;
  }

  let ttsConfig = $state<TTSConfig>({
    provider: "polly",
    voice: "",
    rate: 1.0,
    pitch: 1.0,
    pollyEngine: "neural",
    pollySampleRate: 24000,
  });

  // Highlighting Configuration
  let highlightConfig = $state({
    enabled: true,
    color: "#ffeb3b",
    opacity: 0.4,
  });

  // Annotation Toolbar API Client (for dictionary/translation features)
  const annotationAPIClient = browser
    ? new AnnotationToolbarAPIClient({
        dictionaryEndpoint: "/api/dictionary",
        pictureDictionaryEndpoint: "/api/picture-dictionary",
        translationEndpoint: "/api/translation",
        defaultLanguage: "en-us",
      })
    : null;

  // Storage keys
  let SESSION_STORAGE_KEY = $derived(
    `pie-section-demo-sessions-${data.demo.id}`,
  );
  let TOOL_STATE_STORAGE_KEY = $derived(`demo-tool-state:${data.demo.id}`);
  let TTS_CONFIG_STORAGE_KEY = $derived(
    `pie-section-demo-tts-config-${data.demo.id}`,
  );
  let HIGHLIGHT_CONFIG_STORAGE_KEY = $derived(
    `pie-section-demo-highlight-config-${data.demo.id}`,
  );
  let LAYOUT_CONFIG_STORAGE_KEY = $derived(
    `pie-section-demo-layout-config-${data.demo.id}`,
  );

  // Tiptap editor state
  let editorElement = $state<HTMLDivElement | null>(null);
  let editor: Editor | null = null;
  let editedSourceJson = $state("");
  let isSourceValid = $state(true);
  let sourceParseError = $state<string | null>(null);
  let hasSourceChanges = $state(false);
  const lowlight = browser ? createLowlight(common) : null;

  // Live section data (can be modified) - initialized in effect
  let liveSection: any = $state.raw({} as any);
  let previousDemoId = $state("");

  // Initialize and sync liveSection when data changes
  $effect(() => {
    const currentDemoId = data.demo.id;
    const currentSection = data.section;

    // Initialize on first run or update on navigation
    if (!previousDemoId || currentDemoId !== previousDemoId) {
      // Switching demos - clear tool state to prevent leakage
      if (previousDemoId && toolkitCoordinator) {
        toolkitCoordinator.elementToolStateStore.clearAll();
        console.log("[Demo] Cleared tool state when switching demos");
      }

      previousDemoId = currentDemoId;
      liveSection = structuredClone(currentSection);
    }
  });

  // Outer scrollbar: show only while scrolling (cleaned up in onDestroy)
  let outerScrollTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let removeOuterScrollListener: (() => void) | null = null;

  // Initialize toolkit coordinator and TTS
  async function initializeTTS(config: TTSConfig) {
    ttsProvider = "loading";

    try {
      // Create toolkit coordinator if not exists
      if (!toolkitCoordinator) {
        // Use demo ID to ensure uniqueness
        const assessmentId = `demo-${data.demo.id}`;

        toolkitCoordinator = new ToolkitCoordinator({
          assessmentId,
          tools: {
            tts: { enabled: true },
            answerEliminator: { enabled: true },
            floatingTools: {
              calculator: {
                enabled: true,
                provider: "desmos",
                authFetcher: async () => {
                  const response = await fetch("/api/tools/desmos/auth");
                  return response.json();
                },
              },
            },
          },
          accessibility: {
            catalogs: [],
            language: "en-US",
          },
        });

        // Calculator provider is automatically registered by ToolkitCoordinator
        // No manual registration needed - it handles Desmos provider creation

        // Set up tool state persistence
        toolkitCoordinator.elementToolStateStore.setOnStateChange(
          (state: any) => {
            localStorage.setItem(TOOL_STATE_STORAGE_KEY, JSON.stringify(state));
          },
        );

        // Load persisted tool state
        try {
          const saved = localStorage.getItem(TOOL_STATE_STORAGE_KEY);
          if (saved) {
            toolkitCoordinator.elementToolStateStore.loadState(
              JSON.parse(saved),
            );
            console.log("[Demo] Loaded tool state from localStorage");
          }
        } catch (e) {
          console.warn("[Demo] Failed to load tool state:", e);
        }

        console.log(
          "[Demo] ToolkitCoordinator created with assessmentId:",
          assessmentId,
        );
      }

      // Get TTS service from coordinator
      const ttsService = toolkitCoordinator.ttsService;

      // Re-initialize TTS service with new provider
      if (config.provider === "polly") {
        // Server-side TTS with AWS Polly
        const serverProvider = new ServerTTSProvider();
        await ttsService.initialize(serverProvider, {
          apiEndpoint: "/api/tts",
          provider: "polly",
          voice: config.voice || undefined,
          language: "en-US",
          rate: config.rate,
          pitch: config.pitch,
          providerOptions: {
            engine: config.pollyEngine || "neural",
            sampleRate: config.pollySampleRate || 24000,
          },
        });
        ttsProvider = "polly";
        console.log("[Demo] ✅ Server TTS initialized (AWS Polly):", {
          voice: config.voice || "default",
          engine: config.pollyEngine,
          rate: config.rate,
          pitch: config.pitch,
        });
      } else {
        // Browser TTS with timeout protection
        console.log("[Demo] Initializing Browser TTS with config:", {
          voice: config.voice,
          rate: config.rate,
          pitch: config.pitch,
        });

        const browserProvider = new BrowserTTSProvider();

        // Wrap initialization in a timeout to prevent infinite hangs
        const initPromise = ttsService.initialize(browserProvider, {
          voice: config.voice || undefined, // Don't pass empty string
          rate: config.rate,
          pitch: config.pitch,
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Browser TTS initialization timeout")),
            5000,
          ),
        );

        await Promise.race([initPromise, timeoutPromise]);
        ttsProvider = "browser";

        // Log available voices for debugging
        const availableVoices = speechSynthesis.getVoices();
        console.log("[Demo] ✅ Browser TTS initialized:", {
          voice: config.voice || "default",
          rate: config.rate,
          pitch: config.pitch,
          availableVoices: availableVoices.length,
          voiceFound: availableVoices.some((v) => v.name === config.voice),
        });
      }

      // Apply highlight style from config
      if (highlightConfig) {
        toolkitCoordinator.highlightCoordinator.updateTTSHighlightStyle(
          highlightConfig.color,
          highlightConfig.opacity,
        );
      }

      console.log("[Demo] All toolkit services initialized successfully");
    } catch (e) {
      console.error("[Demo] Failed to initialize TTS services:", e);
      // On error, fall back to browser TTS (simpler, no recursion)
      ttsProvider = "browser";
    }
  }

  // Initialize window positions on mount
  onMount(async () => {
    if (browser) {
      editedSourceJson = JSON.stringify(data.section, null, 2);

      // Load persisted sessions from localStorage
      try {
        const stored = localStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
          itemSessions = JSON.parse(stored);
        }
      } catch (e) {
        console.error("Failed to load persisted sessions:", e);
      }

      // Load persisted TTS config
      try {
        const storedConfig = localStorage.getItem(TTS_CONFIG_STORAGE_KEY);
        if (storedConfig) {
          ttsConfig = JSON.parse(storedConfig);
          console.log("[Demo] Loaded TTS config from localStorage:", ttsConfig);
        }
      } catch (e) {
        console.error("Failed to load persisted TTS config:", e);
      }

      // Load persisted highlight config
      try {
        const storedHighlightConfig = localStorage.getItem(
          HIGHLIGHT_CONFIG_STORAGE_KEY,
        );
        if (storedHighlightConfig) {
          highlightConfig = JSON.parse(storedHighlightConfig);
          console.log(
            "[Demo] Loaded highlight config from localStorage:",
            highlightConfig,
          );
        }
      } catch (e) {
        console.error("Failed to load persisted highlight config:", e);
      }

      // Load persisted layout config
      try {
        const storedLayoutConfig = localStorage.getItem(
          LAYOUT_CONFIG_STORAGE_KEY,
        );
        if (storedLayoutConfig) {
          const parsed = JSON.parse(storedLayoutConfig);
          layoutConfig = parsed;
          toolbarPosition = parsed.toolbarPosition;
          console.log(
            "[Demo] Loaded layout config from localStorage:",
            layoutConfig,
          );
        }
      } catch (e) {
        console.error("Failed to load persisted layout config:", e);
      }

      // Initialize TTS with loaded/default configuration
      await initializeTTS(ttsConfig);

      // Outer scrollbar: show only while the user is scrolling
      function markOuterScrolling() {
        document.documentElement.classList.add("outer-scrolling");
        document.body.classList.add("outer-scrolling");
        if (outerScrollTimeoutId) clearTimeout(outerScrollTimeoutId);
        outerScrollTimeoutId = setTimeout(() => {
          document.documentElement.classList.remove("outer-scrolling");
          document.body.classList.remove("outer-scrolling");
          outerScrollTimeoutId = null;
        }, 700);
      }
      window.addEventListener("scroll", markOuterScrolling, { passive: true });
      removeOuterScrollListener = () => {
        window.removeEventListener("scroll", markOuterScrolling);
        if (outerScrollTimeoutId) clearTimeout(outerScrollTimeoutId);
      };
    }
  });

  // Handle settings apply (save and refresh page)
  async function handleUnifiedSettingsApply(settings: {
    tts: TTSConfig;
    highlight: typeof highlightConfig;
    layout: { toolbarPosition: "top" | "right" | "bottom" | "left" };
  }) {
    console.log("[Demo] Unified settings applied:", settings);

    // Stop any currently playing TTS before reloading
    if (toolkitCoordinator) {
      try {
        toolkitCoordinator.ttsService.stop();
        console.log("[Demo] Stopped active TTS before config change");
      } catch (e) {
        console.error("[Demo] Failed to stop TTS:", e);
      }
    }

    // Update highlight coordinator with new style
    if (toolkitCoordinator && settings.highlight) {
      toolkitCoordinator.highlightCoordinator.updateTTSHighlightStyle(
        settings.highlight.color,
        settings.highlight.opacity,
      );
    }

    // Update toolbar position (no reload needed for layout changes)
    if (settings.layout) {
      toolbarPosition = settings.layout.toolbarPosition;
    }

    // Persist to localStorage
    if (browser) {
      try {
        localStorage.setItem(
          TTS_CONFIG_STORAGE_KEY,
          JSON.stringify(settings.tts),
        );
        localStorage.setItem(
          HIGHLIGHT_CONFIG_STORAGE_KEY,
          JSON.stringify(settings.highlight),
        );
        localStorage.setItem(
          LAYOUT_CONFIG_STORAGE_KEY,
          JSON.stringify(settings.layout),
        );

        console.log("[Demo] Unified settings saved, refreshing page...");

        // Refresh the page to reinitialize with new config
        window.location.reload();
      } catch (e) {
        console.error("Failed to persist unified settings:", e);
      }
    }

    // Close modal
    showTTSSettings = false;
  }

  // Set toolkit coordinator on player imperatively when ready (web component property binding)
  $effect(() => {
    if (browser && sectionPlayer && toolkitCoordinator) {
      sectionPlayer.toolkitCoordinator = toolkitCoordinator;
      console.log("[Demo] ToolkitCoordinator set on section player");
    }
  });

  // Sync layoutConfig with toolbarPosition changes
  $effect(() => {
    layoutConfig = { toolbarPosition };
  });

  // Handle player type change with page refresh
  // Update URL and refresh page when player, layout, or mode changes
  function updateUrlAndRefresh(updates: {
    player?: "iife" | "esm";
    layout?: "vertical" | "split-panel";
    mode?: "candidate" | "scorer";
    esmSource?: "local" | "remote";
  }) {
    if (browser) {
      const url = new URL(window.location.href);
      // Preserve current values and apply updates
      url.searchParams.set("player", updates.player || playerType);
      url.searchParams.set("layout", updates.layout || layoutType);
      url.searchParams.set("mode", updates.mode || roleType);
      url.searchParams.set("esmSource", updates.esmSource || esmSource);
      window.location.href = url.toString();
    }
  }

  // Persist sessions to localStorage whenever they change
  $effect(() => {
    if (browser && Object.keys(itemSessions).length > 0) {
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(itemSessions));
      } catch (e) {
        console.error("Failed to persist sessions:", e);
      }
    }
  });

  // Initialize Tiptap editor when element is available
  $effect(() => {
    if (browser && lowlight && editorElement && !editor) {
      editor = new Editor({
        element: editorElement,
        extensions: [
          Document,
          Text,
          History,
          CodeBlockLowlight.configure({
            lowlight,
            defaultLanguage: "json",
          }),
        ],
        content: `<pre><code class="language-json">${editedSourceJson}</code></pre>`,
        editorProps: {
          attributes: {
            class:
              "prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4",
          },
        },
        onUpdate: ({ editor }) => {
          const text = editor.state.doc.textContent;
          editedSourceJson = text;
          try {
            JSON.parse(text);
            isSourceValid = true;
            sourceParseError = null;
            // Check if content has changed from original
            const originalJson = JSON.stringify(liveSection, null, 2);
            hasSourceChanges = text.trim() !== originalJson.trim();
          } catch (e: any) {
            isSourceValid = false;
            sourceParseError = e.message;
            hasSourceChanges = true;
          }
        },
      });
    }
  });

  onDestroy(() => {
    editor?.destroy();

    // Remove outer scrollbar listener and class
    if (removeOuterScrollListener) {
      removeOuterScrollListener();
      removeOuterScrollListener = null;
    }
    document.documentElement.classList.remove("outer-scrolling");
    document.body.classList.remove("outer-scrolling");

    // Stop TTS when component is destroyed (page navigation/refresh)
    if (toolkitCoordinator) {
      try {
        toolkitCoordinator.ttsService.stop();
        console.log("[Demo] Stopped TTS on component destroy");
      } catch (e) {
        console.error("[Demo] Failed to stop TTS on destroy:", e);
      }
    }
  });

  // Compute player props based on selected type
  // Map role toggle to PIE environment
  // candidate → gather mode + student role (interactive assessment)
  // scorer → evaluate mode + instructor role (scoring/review)
  let pieEnv = $derived<{
    mode: "gather" | "view" | "evaluate";
    role: "student" | "instructor";
  }>({
    mode: roleType === "candidate" ? "gather" : "evaluate",
    role: roleType === "candidate" ? "student" : "instructor",
  });
  let qtiView = $derived<string>(roleType); // Keep QTI view for rubric filtering

  let playerProps = $derived.by(() => {
    switch (playerType) {
      case "iife":
        return {
          bundleHost: "https://proxy.pie-api.com/bundles/",
          esmCdnUrl: "",
        };
      case "esm":
        // Empty esmCdnUrl means same-origin (Vite dev server with local-esm-cdn plugin)
        return {
          bundleHost: "",
          esmCdnUrl: esmSource === "local" ? "" : "https://esm.sh",
        };
    }
  });

  // Set player configuration properties imperatively FIRST (before section/env)
  // Boolean attributes don't work correctly with Svelte custom elements
  $effect(() => {
    if (sectionPlayer) {
      untrack(() => {
        sectionPlayer.bundleHost = playerProps.bundleHost;
        sectionPlayer.esmCdnUrl = playerProps.esmCdnUrl;
      });
    }
  });

  // Set complex properties imperatively on the web component
  // (Web components can only receive simple values via attributes)
  $effect(() => {
    if (sectionPlayer && liveSection) {
      untrack(() => {
        sectionPlayer.section = liveSection;
        sectionPlayer.env = pieEnv;
        sectionPlayer.itemSessions = itemSessions;
        sectionPlayer.toolkitCoordinator = toolkitCoordinator;
        sectionPlayer.toolbarPosition = toolbarPosition;
      });
    }
  });

  // Handle session changes from items
  function handleSessionChanged(event: CustomEvent) {
    console.log("[Demo] Session changed event:", event.detail);
    const { itemId, session, complete, component } = event.detail;
    if (itemId && session) {
      console.log("[Demo] Updating itemSessions:", itemId, session);
      itemSessions = { ...itemSessions, [itemId]: session };

      // Store metadata separately
      itemMetadata = {
        ...itemMetadata,
        [itemId]: { complete, component },
      };
    } else {
      console.warn("[Demo] Missing itemId or session in event:", event.detail);
    }
  }

  // Reset all sessions
  function resetSessions() {
    itemSessions = {};
    if (browser) {
      try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      } catch (e) {
        console.error("Failed to clear persisted sessions:", e);
      }
    }
    // Force page reload to reset player state
    if (browser) {
      window.location.reload();
    }
  }

  function handleSourceEditorElementChange(el: HTMLDivElement | null) {
    editorElement = el;
  }

  function applyChanges() {
    if (isSourceValid && hasSourceChanges) {
      try {
        const parsed = JSON.parse(editedSourceJson);
        // Update the live section data
        liveSection = parsed;
        // Clear item sessions when section changes to prevent stale data
        itemSessions = {};
        hasSourceChanges = false;
        console.log("Applied changes to section and cleared item sessions");
      } catch (e) {
        console.error("Failed to apply changes:", e);
      }
    }
  }

  function resetChanges() {
    if (browser && editor) {
      const original = JSON.stringify(liveSection, null, 2);
      editor.commands.setContent(
        `<pre><code class="language-json">${original}</code></pre>`,
      );
      editedSourceJson = original;
      isSourceValid = true;
      sourceParseError = null;
      hasSourceChanges = false;
    }
  }

  function formatModelJson() {
    if (!browser || !editor) return;
    try {
      const formatted = JSON.stringify(JSON.parse(editedSourceJson), null, 2);
      editor.commands.setContent(
        `<pre><code class="language-json">${formatted}</code></pre>`,
      );
      editedSourceJson = formatted;
      isSourceValid = true;
      sourceParseError = null;
      const originalJson = JSON.stringify(liveSection, null, 2);
      hasSourceChanges = formatted.trim() !== originalJson.trim();
    } catch (e: any) {
      isSourceValid = false;
      sourceParseError = e.message;
    }
  }
</script>

<svelte:head>
  <title>{data.demo?.name || "Demo"} - PIE Section Player</title>
</svelte:head>

<pie-theme-daisyui theme="light" data-scope="document">
<div class="w-full h-screen flex flex-col">
  <!-- Menu Bar (Sticky) -->
  <div class="navbar bg-base-200 mb-0 sticky top-0 z-50 shadow-lg">
    <div class="navbar-start">
      <a href="/" class="btn btn-ghost btn-sm">&#8592; Back to Demos</a>
    </div>

    <div class="navbar-center flex gap-4 items-center">
      <div class="join">
        <button
          class="btn btn-sm join-item"
          class:btn-active={playerType === "iife"}
          onclick={() => updateUrlAndRefresh({ player: "iife" })}
        >
          IIFE
        </button>
        <button
          class="btn btn-sm join-item"
          class:btn-active={playerType === "esm"}
          onclick={() => updateUrlAndRefresh({ player: "esm" })}
        >
          ESM
        </button>
      </div>

      {#if playerType === "esm"}
        <div class="join">
          <button
            class="btn btn-sm join-item"
            class:btn-active={esmSource === "remote"}
            onclick={() => updateUrlAndRefresh({ esmSource: "remote" })}
            title="Use remote CDN (esm.sh)"
          >
            Remote CDN
          </button>
          <button
            class="btn btn-sm join-item"
            class:btn-active={esmSource === "local"}
            onclick={() => updateUrlAndRefresh({ esmSource: "local" })}
            title="Use local-esm-cdn (prod testing)"
          >
            Local CDN
          </button>
        </div>
      {/if}

      <div class="divider divider-horizontal"></div>

      <div class="join">
        <button
          class="btn btn-sm join-item"
          class:btn-active={layoutType === "split-panel"}
          onclick={() => updateUrlAndRefresh({ layout: "split-panel" })}
          title="Split panel - passages left, items right"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4m0-16v16m0-16h10a2 2 0 012 2v12a2 2 0 01-2 2H9"
            />
          </svg>
          Split
        </button>
        <button
          class="btn btn-sm join-item"
          class:btn-active={layoutType === "vertical"}
          onclick={() => updateUrlAndRefresh({ layout: "vertical" })}
          title="Vertical layout - passages first, then items"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          Vertical
        </button>
      </div>

      <div class="divider divider-horizontal"></div>

      <div class="join">
        <button
          class="btn btn-sm join-item"
          class:btn-active={roleType === "candidate"}
          onclick={() => updateUrlAndRefresh({ mode: "candidate" })}
          title="Candidate view - student taking assessment (gather mode)"
        >
          Student
        </button>
        <button
          class="btn btn-sm join-item"
          class:btn-active={roleType === "scorer"}
          onclick={() => updateUrlAndRefresh({ mode: "scorer" })}
          title="Scorer view - instructor reviewing/scoring (evaluate mode)"
        >
          Scorer
        </button>
      </div>
    </div>

    <div class="navbar-end gap-2">
      <!-- Settings Button -->
      <button
        class="btn btn-sm btn-outline"
        onclick={() => (showTTSSettings = true)}
        title="Configure assessment toolkit settings"
      >
        {#if ttsProvider === "loading"}
          <span class="loading loading-spinner loading-xs"></span>
          Loading
        {:else}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Settings
        {/if}
      </button>
      <button
        class="btn btn-sm btn-outline"
        onclick={() => (showSessionPanel = !showSessionPanel)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Session
      </button>
      <button
        class="btn btn-sm btn-outline"
        onclick={() => (showSourcePanel = !showSourcePanel)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          />
        </svg>
        Source
      </button>
    </div>
  </div>

  <div class="flex-1 overflow-hidden">
    <!-- Use web component - set complex properties imperatively via $effect -->
    <!-- svelte-ignore a11y_unknown_aria_attribute -->
    <pie-section-player
      bind:this={sectionPlayer}
      layout={layoutType}
      view={qtiView}
      bundle-host={playerProps.bundleHost}
      esm-cdn-url={playerProps.esmCdnUrl}
      onsessionchanged={handleSessionChanged}
    ></pie-section-player>
  </div>
</div>
</pie-theme-daisyui>

<!-- Annotation Toolbar (floating, appears on text selection) -->
<!-- Outside main container to avoid overflow: hidden affecting fixed positioning -->
{#if toolkitCoordinator}
  <pie-tool-annotation-toolbar
    enabled={true}
    ttsService={toolkitCoordinator.ttsService}
    highlightCoordinator={toolkitCoordinator.highlightCoordinator}
    annotationApiClient={annotationAPIClient}
    translationTargetLanguage="es"
  ></pie-tool-annotation-toolbar>
{/if}

<!-- Floating Session Window -->
{#if showSessionPanel}
  <SessionDataWindow
    {canonicalSessionSnapshot}
    onClose={() => (showSessionPanel = false)}
  />
{/if}

<!-- Floating Source Window -->
{#if showSourcePanel}
  <SourceEditorWindow
    {isSourceValid}
    {sourceParseError}
    {editedSourceJson}
    onEditorElementChange={handleSourceEditorElementChange}
    onFormatModelJson={formatModelJson}
    onClose={() => (showSourcePanel = false)}
  />
{/if}

<!-- Assessment Toolkit Settings Modal -->
{#if showTTSSettings && toolkitCoordinator}
  <AssessmentToolkitSettings
    ttsService={toolkitCoordinator.ttsService}
    bind:ttsConfig
    bind:highlightConfig
    bind:layoutConfig
    onClose={() => (showTTSSettings = false)}
    onApply={handleUnifiedSettingsApply}
  />
{/if}
