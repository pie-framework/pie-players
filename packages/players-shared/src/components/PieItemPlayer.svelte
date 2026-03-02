<!--
  PieItemPlayer - Pure PIE Item Renderer
  
  This component renders a PIE item using direct PIE elements (no pie-player wrapper).
  It assumes PIE bundles are already loaded via window.pie.
  
  Uses the same reactive pattern as PieItemPreview.svelte (proven to work).
-->
<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";
  import type { LoaderConfig } from "../loader-config.js";
  import { DEFAULT_LOADER_CONFIG } from "../loader-config.js";
  import {
    AssetEventManager,
    createDefaultImageDeleteHandler,
    createDefaultImageInsertHandler,
    createDefaultSoundDeleteHandler,
    createDefaultSoundInsertHandler,
  } from "../pie/asset-handler.js";
  import { initializeConfiguresFromLoadedBundle } from "../pie/configure-initialization.js";
  import { initializePiesFromLoadedBundle } from "../pie/initialization.js";
  import { createPieLogger, isGlobalDebugEnabled } from "../pie/logger.js";
  import { findPieController } from "../pie/scoring.js";
  import type { AuthoringEnv } from "../pie/types.js";
  import { BundleType } from "../pie/types.js";
  import { updatePieElements } from "../pie/updates.js";
  import { useResourceMonitor } from "../pie/use-resource-monitor.svelte.js";
  import type {
    ConfigEntity,
    Env,
    ImageHandler,
    ModelUpdatedEvent,
    SoundHandler,
  } from "../types/index.js";

  // Create logger (respects global debug flag - pass function for dynamic checking)
  const logger = createPieLogger("pie-item-player", () =>
    isGlobalDebugEnabled()
  );

  // Use Svelte 5 runes for props
  let {
    itemConfig,
    passageConfig = null,
    env = { mode: "gather", role: "student" } as Env,
    session = [] as any[],
    addCorrectResponse = false,
    customClassName = "",
    passageContainerClass = "",
    containerClass = "",
    bundleType = BundleType.player, // Default to player.js (server-processed models)
    loaderConfig = DEFAULT_LOADER_CONFIG as LoaderConfig,
    // Authoring mode props
    mode = "view" as "view" | "author",
    configuration = {} as Record<string, any>,
    authoringBackend = "demo" as "demo" | "required",
    // Toolkit service integration (optional)
    ttsService = null,
    toolCoordinator = null,
    highlightCoordinator = null,
    // Asset handler callbacks
    onInsertImage,
    onDeleteImage,
    onInsertSound,
    onDeleteSound,
    // Event callbacks (Svelte 5 pattern)
    onLoadComplete,
    onPlayerError,
    onSessionChanged,
    onModelUpdated,
  }: {
    itemConfig: ConfigEntity;
    passageConfig?: ConfigEntity | null;
    env?: Env;
    session?: any[];
    addCorrectResponse?: boolean;
    customClassName?: string;
    passageContainerClass?: string;
    containerClass?: string;
    bundleType?: BundleType;
    loaderConfig?: LoaderConfig;
    // Authoring mode props
    mode?: "view" | "author";
    configuration?: Record<string, any>;
    authoringBackend?: "demo" | "required";
    // Toolkit service integration
    ttsService?: any;
    toolCoordinator?: any;
    highlightCoordinator?: any;
    // Asset handlers
    onInsertImage?: (handler: ImageHandler) => void;
    onDeleteImage?: (src: string, done: (err?: Error) => void) => void;
    onInsertSound?: (handler: SoundHandler) => void;
    onDeleteSound?: (src: string, done: (err?: Error) => void) => void;
    // Event callbacks
    onLoadComplete?: (detail?: any) => void;
    onPlayerError?: (detail?: any) => void;
    onSessionChanged?: (detail?: any) => void;
    onModelUpdated?: (detail?: any) => void;
  } = $props();

  // Track if correct responses have been added
  let correctResponsesAdded = $state(false);

  // Asset event manager for authoring mode
  let assetEventManager: AssetEventManager | null = $state(null);
  let authoringBlockedError: string | null = $state(null);
  let lastReportedAuthoringError: string | null = $state(null);

  // Transform markup for authoring mode (append -config suffix)
  function transformMarkupForAuthoring(
    markup: string,
    elements: Record<string, string>
  ): string {
    let result = markup;
    for (const elementTag of Object.keys(elements)) {
      // Replace opening tags
      const openRegex = new RegExp(`<${elementTag}(\\s|>)`, "g");
      result = result.replace(openRegex, `<${elementTag}-config$1`);
      // Replace closing tags
      const closeRegex = new RegExp(`</${elementTag}>`, "g");
      result = result.replace(closeRegex, `</${elementTag}-config>`);
    }
    return result;
  }

  // Get appropriate markup based on mode
  const itemMarkup = $derived.by(() => {
    if (!itemConfig?.markup) return "";
    if (mode === "author" && itemConfig.elements) {
      return transformMarkupForAuthoring(
        itemConfig.markup,
        itemConfig.elements
      );
    }
    return itemConfig.markup;
  });

  const passageMarkup = $derived.by(() => {
    if (!passageConfig?.markup) return "";
    if (mode === "author" && passageConfig.elements) {
      return transformMarkupForAuthoring(
        passageConfig.markup,
        passageConfig.elements
      );
    }
    return passageConfig.markup;
  });

  // Dispatch events (will add more as needed)
  const dispatch = (type: string, detail?: any) => {
    // Call callback prop if provided (Svelte 5 pattern)
    if (type === "load-complete" && onLoadComplete) {
      onLoadComplete(detail);
    } else if (type === "player-error" && onPlayerError) {
      onPlayerError(detail);
    } else if (type === "session-changed" && onSessionChanged) {
      onSessionChanged(detail);
    } else if (type === "model-updated" && onModelUpdated) {
      onModelUpdated(detail);
    }

    // Also dispatch DOM event for backward compatibility
    const event = new CustomEvent(type, {
      detail,
      bubbles: true,
      composed: true, // Allow events to cross shadow DOM boundaries
    });
    dispatchEvent(event);
  };

  const requiredHandlerNames = [
    "onInsertImage",
    "onDeleteImage",
    "onInsertSound",
    "onDeleteSound",
  ] as const;

  function reportAuthoringErrorOnce(message: string) {
    if (lastReportedAuthoringError === message) return;
    lastReportedAuthoringError = message;
    logger.error(`[PieItemPlayer] ${message}`);
    dispatch("player-error", {
      code: "AUTHORING_BACKEND_CONFIG_ERROR",
      message,
    });
  }

  function buildEffectiveAuthoringHandlers() {
    if (authoringBackend === "required") {
      const missing: string[] = [];
      if (!onInsertImage) missing.push("onInsertImage");
      if (!onDeleteImage) missing.push("onDeleteImage");
      if (!onInsertSound) missing.push("onInsertSound");
      if (!onDeleteSound) missing.push("onDeleteSound");

      if (missing.length > 0) {
        const message = `Authoring backend is required but missing handlers: ${missing.join(", ")}. Provide all ${requiredHandlerNames.join(", ")} callbacks.`;
        authoringBlockedError = message;
        reportAuthoringErrorOnce(message);
        return null;
      }

      return {
        onInsertImage: onInsertImage!,
        onDeleteImage: onDeleteImage!,
        onInsertSound: onInsertSound!,
        onDeleteSound: onDeleteSound!,
      };
    }

    if (
      onInsertImage ||
      onDeleteImage ||
      onInsertSound ||
      onDeleteSound
    ) {
      return {
        onInsertImage,
        onDeleteImage,
        onInsertSound,
        onDeleteSound,
      };
    }

    logger.warn(
      "[PieItemPlayer] Authoring backend mode is 'demo'. Using non-production media handlers.",
    );
    return {
      onInsertImage: createDefaultImageInsertHandler((src) => {
        logger.debug("[PieItemPlayer] Demo image insert completed:", src);
      }),
      onDeleteImage: createDefaultImageDeleteHandler(),
      onInsertSound: createDefaultSoundInsertHandler((src) => {
        logger.debug("[PieItemPlayer] Demo sound insert completed:", src);
      }),
      onDeleteSound: createDefaultSoundDeleteHandler(),
    };
  }

  // Populate session with correct responses when addCorrectResponse is true
  async function populateCorrectResponses(force = false) {
    // Early return checks
    if (!addCorrectResponse || !itemConfig || (correctResponsesAdded && !force))
      return;

    // CRITICAL: Only populate if env has instructor role (required for createCorrectResponseSession)
    if (env.role !== "instructor" || env.mode === "evaluate") {
      logger.debug(
        "[PieItemPlayer] Skipping populateCorrectResponses - env not suitable (role=%s, mode=%s)",
        env.role,
        env.mode
      );
      return;
    }
    const newSession: any[] = [];

    for (const model of itemConfig.models) {
      const controller = findPieController(model.element);
      logger.debug(
        "[PieItemPlayer] Controller lookup for %s: %s (createCorrectResponseSession=%s)",
        model.element,
        controller ? "FOUND" : "NOT FOUND",
        controller ? "YES" : "NO"
      );

      if (controller && controller.createCorrectResponseSession) {
        try {
          const correctResponse =
            (await controller.createCorrectResponseSession(model, env)) as any;

          // Check if we got a valid response
          if (!correctResponse) {
            logger.debug(
              "[PieItemPlayer] createCorrectResponseSession returned null for %s (env=%j)",
              model.element,
              env
            );
            continue;
          }

          const { id: _ignoredId, ...sessionData } = correctResponse;
          newSession.push({
            id: model.id,
            element: model.element,
            ...sessionData,
          });
        } catch (e) {
          logger.warn(
            "[PieItemPlayer] Failed to create correct response for %s",
            model.element,
            e
          );
        }
      }
    }

    // Clear existing session entries first by dispatching clear events for each existing entry
    // This ensures the parent component clears its session state before we populate new responses
    const existingIds = new Set(session.map((s: any) => s.id));
    for (const id of existingIds) {
      // Dispatch a session-changed event with null/empty to signal clearing
      // The parent should handle this by removing the entry
      dispatch("session-changed", { id, clear: true });
    }

    // Update session with correct responses
    session.length = 0;
    session.push(...newSession);

    // Only mark as added if we actually got responses
    if (newSession.length > 0) {
      correctResponsesAdded = true;

      // IMPORTANT: `session` is a plain array prop that we mutate in place.
      // Svelte reactivity won't necessarily re-run effects on in-place mutation,
      // so we must push the updated session into the PIE elements explicitly.
      try {
        updatePieElements(itemConfig, session, env, rootElement ?? undefined);
        if (passageConfig) {
          updatePieElements(passageConfig, session, env, rootElement ?? undefined);
        }
      } catch (e) {
        logger.warn(
          "[PieItemPlayer] Failed to update PIE elements after populating correct responses",
          e
        );
      }

      logger.debug(
        "[PieItemPlayer] Correct responses added to session:",
        session
      );

      // Dispatch session-changed events for each populated response
      // This ensures the parent component can sync its session state
      for (const sessionEntry of newSession) {
        dispatch("session-changed", sessionEntry);
      }
    } else {
      logger.debug(
        "[PieItemPlayer] No correct responses returned (likely wrong env). Will retry if env/addCorrectResponse changes."
      );
    }
  }

  // Build CSS classes for containers using $derived
  const passageContainerClassFinal = $derived(
    ["pie-passage-container", customClassName, passageContainerClass]
      .filter(Boolean)
      .join(" ")
  );

  const itemContainerClassFinal = $derived(
    ["pie-item-container", customClassName, containerClass]
      .filter(Boolean)
      .join(" ")
  );

  // Track if we've initialized (to avoid double-initialization)
  let initialized = $state(false);

  // Set up session-changed listener after DOM is ready
  let sessionListenerAttached = $state(false);
  let detachSessionChangedListener: (() => void) | null = $state(null);

  // Flag to prevent infinite loop when re-dispatching events
  let isDispatching = $state(false);
  let lastDispatchedSessionDetailSignature = $state("");

  // Root element reference for resource monitor
  let rootElement: HTMLElement | null = $state(null);

  function getSessionSignature(): string {
    try {
      return JSON.stringify(session ?? []);
    } catch {
      return String(session ?? "");
    }
  }

  // Resource monitor (handles initialization and cleanup automatically)
  const resourceMonitor = useResourceMonitor(
    () => rootElement,
    () => loaderConfig,
    () => isGlobalDebugEnabled(),
    "pie-item-player"
  );

  // Initialize PIE elements AFTER markup is rendered (reactive pattern like PieItemPreview)
  $effect(() => {
    if (!itemConfig || initialized) return;
    logger.debug(
      "[PieItemPlayer] Item config received, initializing after DOM renders..."
    );
    logger.debug("[PieItemPlayer] Mode:", mode);

    // Wait for DOM to update (markup to render)
    tick().then(async () => {
      try {
        logger.debug("[PieItemPlayer] DOM ready, initializing PIE elements");
        logger.debug("[PieItemPlayer] Config:", {
          itemElements: Object.keys(itemConfig.elements || {}),
          itemModels: (itemConfig.models || []).length,
          passageElements: passageConfig
            ? Object.keys(passageConfig.elements || {})
            : [],
          passageModels: passageConfig
            ? (passageConfig.models || []).length
            : 0,
          sessionLength: session.length,
          addCorrectResponse,
          env,
          mode,
        });

        if (mode === "author") {
          // AUTHORING MODE: Initialize configure elements
          logger.debug("[PieItemPlayer] Initializing in authoring mode");
          authoringBlockedError = null;
          const effectiveHandlers = buildEffectiveAuthoringHandlers();
          if (authoringBlockedError || !effectiveHandlers) {
            initialized = false;
            return;
          }

          const authoringEnv: AuthoringEnv = {
            ...env,
            mode: "author",
            configuration,
          };

          initializeConfiguresFromLoadedBundle(itemConfig, configuration, {
            env: authoringEnv,
          });
          logger.debug("[PieItemPlayer] Configure elements initialized");

          if (passageConfig) {
            initializeConfiguresFromLoadedBundle(passageConfig, configuration, {
              env: authoringEnv,
            });
            logger.debug(
              "[PieItemPlayer] Passage configure elements initialized"
            );
          }

          if (rootElement && effectiveHandlers) {
            assetEventManager = new AssetEventManager(
              rootElement,
              effectiveHandlers.onInsertImage
                ? (handler) => {
                    try {
                      effectiveHandlers.onInsertImage!(handler);
                    } catch (error: any) {
                      const err =
                        error instanceof Error
                          ? error
                          : new Error(String(error ?? "Unknown upload error"));
                      logger.error("[PieItemPlayer] onInsertImage failed:", err);
                      handler.done(err);
                    }
                  }
                : undefined,
              effectiveHandlers.onDeleteImage
                ? (src, done) => {
                    try {
                      effectiveHandlers.onDeleteImage!(src, done);
                    } catch (error: any) {
                      const err =
                        error instanceof Error
                          ? error
                          : new Error(String(error ?? "Unknown delete error"));
                      logger.error("[PieItemPlayer] onDeleteImage failed:", err);
                      done(err);
                    }
                  }
                : undefined,
              effectiveHandlers.onInsertSound
                ? (handler) => {
                    try {
                      effectiveHandlers.onInsertSound!(handler);
                    } catch (error: any) {
                      const err =
                        error instanceof Error
                          ? error
                          : new Error(String(error ?? "Unknown upload error"));
                      logger.error("[PieItemPlayer] onInsertSound failed:", err);
                      handler.done(err);
                    }
                  }
                : undefined,
              effectiveHandlers.onDeleteSound
                ? (src, done) => {
                    try {
                      effectiveHandlers.onDeleteSound!(src, done);
                    } catch (error: any) {
                      const err =
                        error instanceof Error
                          ? error
                          : new Error(String(error ?? "Unknown delete error"));
                      logger.error("[PieItemPlayer] onDeleteSound failed:", err);
                      done(err);
                    }
                  }
                : undefined
            );
            assetEventManager.attach();
            logger.debug("[PieItemPlayer] Asset event manager attached");
          }
        } else {
          // VIEW MODE: Initialize regular player elements
          logger.debug("[PieItemPlayer] Initializing in view mode");

          // STEP 1: Initialize bundles and register controllers (don't pass session yet)
          // This registers controllers in the registry so we can call createCorrectResponseSession
          initializePiesFromLoadedBundle(itemConfig, [], {
            env,
            bundleType,
            container: rootElement ?? undefined,
          });
          logger.debug(
            "[PieItemPlayer] Item bundle initialized (bundle type: %s)",
            bundleType
          );

          if (passageConfig) {
            initializePiesFromLoadedBundle(passageConfig, [], {
              env,
              bundleType,
              container: rootElement ?? undefined,
            });
            logger.debug(
              "[PieItemPlayer] Passage bundle initialized (bundle type: %s)",
              bundleType
            );
          }

          // STEP 2: Don't populate correct responses during initialization
          // Let the reactive effect handle it after initialization when env is ready

          // STEP 3: Update elements with the correct session
          logger.debug(
            "[PieItemPlayer] Updating elements with session (length=" +
              session.length +
              ")"
          );
          updatePieElements(itemConfig, session, env, rootElement ?? undefined);

          if (passageConfig) {
            updatePieElements(passageConfig, session, env, rootElement ?? undefined);
          }
        }

        initialized = true;

        // Set up event listeners
        if (!sessionListenerAttached) {
          if (mode === "author") {
            // AUTHORING MODE: Listen for model-updated events
            const handleModelUpdated = (event: Event) => {
              if (isDispatching) return;

              const customEvent = event as ModelUpdatedEvent;
              logger.debug(
                "[PieItemPlayer] model-updated event received from configure element"
              );

              isDispatching = true;
              try {
                dispatch("model-updated", customEvent.detail);
              } finally {
                setTimeout(() => {
                  isDispatching = false;
                }, 0);
              }
            };

            if (rootElement) {
              // Capture phase ensures we receive author updates even when the event
              // does not bubble from nested configure editors.
              rootElement.addEventListener(
                "model.updated",
                handleModelUpdated,
                true
              );
              sessionListenerAttached = true;
              detachSessionChangedListener = () => {
                try {
                  rootElement?.removeEventListener(
                    "model.updated",
                    handleModelUpdated,
                    true
                  );
                } catch {}
              };
              logger.debug(
                "[PieItemPlayer] model-updated listener attached to root element"
              );
            }
          } else {
            // VIEW MODE: Listen for session-changed events from PIE elements
            const handleSessionChanged = (event: Event) => {
              // CRITICAL: Prevent infinite loop
              // When we dispatch, it triggers this listener again
              // Use flag to detect and break the loop
              if (isDispatching) {
                return;
              }

              const customEvent = event as CustomEvent;
              logger.debug(
                "[PieItemPlayer] session-changed event received from PIE element",
                customEvent.detail
              );

              // Forward event detail with the latest in-memory session snapshot.
              // PIE elements often emit metadata-only details, while the actual response
              // array is mutated in-place on the `session` prop.
              const forwardedDetail = {
                ...(customEvent.detail || {}),
                session: { id: "", data: session },
              };

              // Ignore duplicate payloads that can occur during model wiring.
              let detailSignature = "";
              try {
                detailSignature = JSON.stringify(forwardedDetail);
              } catch {
                detailSignature = String(customEvent.detail);
              }
              if (detailSignature === lastDispatchedSessionDetailSignature) {
                return;
              }
              lastDispatchedSessionDetailSignature = detailSignature;

              // Set flag before dispatching
              isDispatching = true;
              try {
                dispatch("session-changed", forwardedDetail);
              } finally {
                // Reset flag after dispatch (use setTimeout to ensure it happens after event propagation)
                setTimeout(() => {
                  isDispatching = false;
                }, 0);
              }
            };

            // Attach to THIS component instance's root element (critical for stimulus layouts)
            // Using document.querySelector would only attach to the first instance on the page.
            if (rootElement) {
              rootElement.addEventListener(
                "session-changed",
                handleSessionChanged
              );
              sessionListenerAttached = true;
              detachSessionChangedListener = () => {
                try {
                  rootElement?.removeEventListener(
                    "session-changed",
                    handleSessionChanged
                  );
                } catch {}
              };
              logger.debug(
                "[PieItemPlayer] session-changed listener attached to root element"
              );
            }
          }
        }

        // Note: Resource monitor starts automatically via useResourceMonitor when rootElement is set

        logger.debug(
          "[PieItemPlayer] Initialization complete, dispatching load-complete event"
        );
        dispatch("load-complete");
      } catch (e: any) {
        logger.error("[PieItemPlayer] Error initializing:", e);
        dispatch("player-error", e.message);
      }
    });
  });

  onDestroy(() => {
    try {
      detachSessionChangedListener?.();
      assetEventManager?.detach();
    } catch {}
  });

  // React to addCorrectResponse and env changes to populate/clear correct responses
  $effect(() => {
    if (!initialized) return;

    // Read env to ensure effect tracks it (so it re-runs when env changes)
    const currentEnv = env;

    if (addCorrectResponse && !correctResponsesAdded) {
      // Need to populate correct responses
      // populateCorrectResponses will check if env is suitable (role === 'instructor')
      untrack(async () => {
        await populateCorrectResponses();
        // Elements will be updated by the env/session effect below
      });
    } else if (!addCorrectResponse && correctResponsesAdded) {
      // Switching FROM browse mode - clear correct responses
      untrack(() => {
        session.length = 0;
        correctResponsesAdded = false;
        // Elements will be updated by the env/session effect below
      });
    }
  });

  // Update PIE elements when env or session changes (after initialization) - using $effect
  let isUpdating = false;
  $effect(() => {
    if (!initialized || !env || !itemConfig || !session) return;
    if (isUpdating) return; // Prevent re-entry

    // Log changes
    logger.debug("[PieItemPlayer] Dependencies changed, updating elements");
    logger.debug("[PieItemPlayer] Env:", env);
    logger.debug(
      "[PieItemPlayer] Session (length=" + session.length + "):",
      session
    );

    isUpdating = true;
    untrack(() => {
      try {
        updatePieElements(itemConfig, session, env, rootElement ?? undefined);

        if (passageConfig) {
          updatePieElements(passageConfig, session, env, rootElement ?? undefined);
        }
      } finally {
        isUpdating = false;
      }
    });
  });

  // Note: Resource monitor cleanup is handled automatically by useResourceMonitor's onDestroy
</script>

<div class="pie-item-player" bind:this={rootElement}>
  {#if authoringBlockedError}
    <div
      class="pie-player-error"
      style="
        padding: 20px;
        margin: 20px 0;
        border: 2px solid #d32f2f;
        border-radius: 4px;
        background-color: #ffebee;
        color: #c62828;
        font-family: sans-serif;
      "
    >
      <h3 style="margin: 0 0 10px 0">Authoring Backend Configuration Error</h3>
      <p style="margin: 0">{authoringBlockedError}</p>
    </div>
  {:else if passageMarkup}
    <div class={passageContainerClassFinal}>
      {@html passageMarkup}
    </div>
  {/if}

  {#if !authoringBlockedError && itemMarkup}
    <div class={itemContainerClassFinal}>
      {@html itemMarkup}
    </div>
  {/if}
</div>

<style>
  .pie-item-player {
    display: block;
    width: 100%;
  }

  .pie-passage-container,
  .pie-item-container {
    display: block;
    width: 100%;
  }
</style>
