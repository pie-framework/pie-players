<!--
  PieItemPlayer - Pure PIE Item Renderer
  
  This component renders a PIE item using direct PIE elements (no pie-player wrapper).
  It assumes PIE bundles are already loaded via window.pie.
  
  Uses the same reactive pattern as PieItemPreview.svelte (proven to work).
-->
<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";
  import { isInstrumentationProvider } from "../instrumentation/provider-guards.js";
  import type { LoaderConfig } from "../loader-config.js";
  import { DEFAULT_LOADER_CONFIG } from "../loader-config.js";
  import {
    buildAuthoringAllowList,
    createDefaultItemMarkupSanitizer,
    wrapOverwideImagesInElement,
    wrapOverwideTablesInElement,
    type ItemMarkupSanitizer,
  } from "../security/index.js";
  import {
    createDefaultImageDeleteHandler,
    createDefaultImageInsertHandler,
    createDefaultSoundDeleteHandler,
    createDefaultSoundInsertHandler,
  } from "../pie/asset-handler.js";
  import {
    createAuthoringAssetEventManager,
    validateAuthoringModels,
    type AuthoringValidationResult,
  } from "../pie/authoring.js";
  import { transformMarkupForAuthoring } from "../pie/authoring-tag.js";
  import { initializeConfiguresFromLoadedBundle } from "../pie/configure-initialization.js";
  import {
    canPopulateCorrectResponses,
    getCorrectResponseEnv,
  } from "../pie/correct-response-env.js";
  import { initializePiesFromLoadedBundle } from "../pie/initialization.js";
  import { createPieLogger, isGlobalDebugEnabled } from "../pie/logger.js";
  import { resolveInstrumentationProvider } from "../pie/instrumentation-provider-resolution.js";
  import { findPieController } from "../pie/scoring.js";
  import type { AuthoringEnv } from "../pie/types.js";
  import { BundleType } from "../pie/types.js";
  import { updatePieElements } from "../pie/updates.js";
  import { useResourceMonitor } from "../pie/use-resource-monitor.svelte.js";
  import { resolveInterfaceI18n } from "../i18n/provider.js";
  import type { I18nProvider } from "../i18n/types.js";
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
    onCorrectResponsesPopulated,
    allowedResize = false,
    customClassName = "",
    passageContainerClass = "",
    containerClass = "",
    bundleType = BundleType.player, // Default to player.js (server-processed models)
    loaderConfig = DEFAULT_LOADER_CONFIG as LoaderConfig,
    // Authoring mode props
    mode = "view" as "view" | "author",
    configuration = {} as Record<string, any>,
    authoringBackend = "demo" as "demo" | "required",
    // Security: sanitize markup before {@html} injection unless the host opts out.
    trustMarkup = false,
    sanitizeMarkup,
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
    onModelLoaded,
    onElementSessionUpdate,
    baseHeadingLevel = undefined,
    includeSrHeading = true,
    i18n,
  }: {
    itemConfig: ConfigEntity;
    passageConfig?: ConfigEntity | null;
    env?: Env;
    session?: any[];
    addCorrectResponse?: boolean;
    /**
     * Called when correct responses were actually written into the session.
     *
     * Firing at all carries the security signal: population requires a
     * controller with `createCorrectResponseSession` in the browser, which only
     * a `client-player.js` bundle provides. A host that did not ask for correct
     * responses in this context can treat the call as tampering — `role` and
     * `mode` are client-mutable attributes, so they are not a boundary, and
     * `hosted=true` / `player.js` is what keeps the answer key server-side.
     *
     * The detail deliberately carries no session data. See the emit site.
     */
    onCorrectResponsesPopulated?: (detail: {
      itemId?: string;
      mode?: string;
      role?: string;
      bundleType?: string;
      populatedCount: number;
      elements: string[];
    }) => void;
    allowedResize?: boolean;
    customClassName?: string;
    passageContainerClass?: string;
    containerClass?: string;
    bundleType?: BundleType;
    loaderConfig?: LoaderConfig;
    // Authoring mode props
    mode?: "view" | "author";
    configuration?: Record<string, any>;
    authoringBackend?: "demo" | "required";
    // Markup-trust controls
    trustMarkup?: boolean;
    sanitizeMarkup?: ItemMarkupSanitizer;
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
    onModelLoaded?: (detail?: any) => void;
    /**
     * Invoked when an element controller persists derived session state (e.g. a
     * shuffled-choice order) via its updateSession callback. The host writes it
     * back to the authoritative session so re-renders reuse it (PIE-631).
     */
    onElementSessionUpdate?: (
      elementId: string,
      elementName: string,
      properties: Record<string, unknown>,
    ) => void;
    /**
     * The level the item's own heading occupies, whoever supplies it: the
     * element's visually-hidden item heading when `includeSrHeading` is on, and
     * the host's own natural heading — "Question 5" — when it is off.
     *
     * The element owns the outline and resolves this itself, by walking up to
     * the nearest player host:
     *
     *   const player = element.closest('pie-player')
     *              ?? element.closest('pie-item-player');
     *   let raw = player?.baseHeadingLevel
     *          ?? player?.getAttribute('base-heading-level')
     *          ?? player?.getAttribute('baseheadinglevel');
     *
     * It then nests authored `data-heading` content one level below that —
     * `<p data-heading="headingN">` becomes `<h{clamp(base + N, 1, 6)}>` with
     * the `data-heading` attribute preserved, so host CSS keyed on
     * `[data-heading]` still matches. Content nests below `base` whether or not
     * the element supplied the heading there, which is why a host that
     * suppresses the item heading has to be emitting one of its own at `base`.
     * Unsupplied, content lands as if `base` were 1.
     *
     * This component is a pass-through: the value has to arrive on the player
     * custom element for the walk-up to find it, which is why
     * `@pie-players/pie-item-player` reflects it to `base-heading-level`.
     * Nothing here rewrites markup.
     */
    baseHeadingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
    /**
     * Whether the element emits its visually-hidden (screen-reader-only) item
     * heading.
     *
     * Set to `false` where that heading would be redundant or
     * counter-indicated — the player is already labelled by a surrounding
     * landmark, or the host page manages its own heading structure. Defaults to
     * `true` so assistive-technology users get a navigable heading out of the
     * box.
     *
     * Resolved by the element the same way as `baseHeadingLevel`, and a
     * pass-through here for the same reason. Because the default is `true`,
     * hosts turn it off through the property: HTML boolean-attribute semantics
     * make a present `include-sr-heading` mean on, whatever its value.
     */
    includeSrHeading?: boolean;
    /**
     * Interface-locale provider for the player's own chrome — error banners, status
     * text. Not the authored content's language, which the item declares.
     *
     * Optional: this component renders in Studio preview and in `print-player`,
     * neither of which publishes one, and the English-only default covers that.
     */
    i18n?: I18nProvider;
  } = $props();

  const messages = $derived(resolveInterfaceI18n({ i18n }));

  // Track if correct responses have been added
  let correctResponsesAdded = $state(false);

  // Asset event manager for authoring mode
  let assetEventManager: ReturnType<typeof createAuthoringAssetEventManager> | null = $state(null);
  let authoringBlockedError: string | null = $state(null);
  let lastReportedAuthoringError: string | null = $state(null);
  let runtimePlayerError: string | null = $state(null);

  // Custom-element allow-list derived from the item/passage `elements` maps.
  // Includes both the raw tag names and their authoring-mode `-config`
  // rewrites so `transformMarkupForAuthoring` output still passes the
  // sanitizer.
  const itemAllowList = $derived.by<string[]>(() => {
    const elements = itemConfig?.elements ?? {};
    return buildAuthoringAllowList(Object.keys(elements));
  });

  const passageAllowList = $derived.by<string[]>(() => {
    const elements = passageConfig?.elements ?? {};
    return buildAuthoringAllowList(Object.keys(elements));
  });

  function applySanitizer(markup: string, allowList: string[]): string {
    if (!markup) return "";
    if (trustMarkup) return markup;
    if (sanitizeMarkup) return sanitizeMarkup(markup);
    const sanitizer = createDefaultItemMarkupSanitizer({
      allowedCustomElements: allowList,
    });
    return sanitizer(markup);
  }

  // Get appropriate markup based on mode
  const itemMarkup = $derived.by(() => {
    if (!itemConfig?.markup) return "";
    const raw =
      mode === "author" && itemConfig.elements
        ? transformMarkupForAuthoring(itemConfig.markup, itemConfig.elements)
        : itemConfig.markup;
    return applySanitizer(raw, itemAllowList);
  });

  const passageMarkup = $derived.by(() => {
    if (!passageConfig?.markup) return "";
    const raw =
      mode === "author" && passageConfig.elements
        ? transformMarkupForAuthoring(
            passageConfig.markup,
            passageConfig.elements
          )
        : passageConfig.markup;
    return applySanitizer(raw, passageAllowList);
  });

  function normalizePlayerErrorDetail(
    detail: unknown,
    fallbackCode = "ITEM_PLAYER_RUNTIME_ERROR"
  ) {
    if (detail && typeof detail === "object") {
      const detailObject = detail as Record<string, unknown>;
      const message =
        typeof detailObject.message === "string" && detailObject.message.trim().length > 0
          ? detailObject.message
          : "Unknown PIE runtime error";
      const code =
        typeof detailObject.code === "string" && detailObject.code.trim().length > 0
          ? detailObject.code
          : fallbackCode;
      return { ...detailObject, message, code };
    }
    const message =
      typeof detail === "string" && detail.trim().length > 0
        ? detail
        : "Unknown PIE runtime error";
    return { code: fallbackCode, message };
  }

  function trackPlayerError(detail: Record<string, unknown>) {
    const resolvedProvider = resolveInstrumentationProvider({
      player: { loaderConfig },
      component: "pie-item-player",
      debug: isGlobalDebugEnabled(),
    });
    if (!isInstrumentationProvider(resolvedProvider) || !resolvedProvider.isReady()) return;
    const message =
      typeof detail.message === "string" ? detail.message : "Unknown PIE runtime error";
    const code =
      typeof detail.code === "string" && detail.code.length > 0
        ? detail.code
        : "ITEM_PLAYER_RUNTIME_ERROR";
    resolvedProvider.trackError(new Error(message), {
      component: "pie-item-player",
      errorType: code,
      ...detail,
    });
  }

  function reportPlayerError(detail: unknown, fallbackCode = "ITEM_PLAYER_RUNTIME_ERROR") {
    const normalizedDetail = normalizePlayerErrorDetail(detail, fallbackCode);
    runtimePlayerError = normalizedDetail.message as string;
    logger.error("[PieItemPlayer] Runtime error:", normalizedDetail);
    trackPlayerError(normalizedDetail);
    dispatch("player-error", normalizedDetail);
  }

  // Dispatch events (will add more as needed)
  const dispatch = (type: string, detail?: any) => {
    // Call callback prop if provided (Svelte 5 pattern)
    if (type === "load-complete" && typeof onLoadComplete === "function") {
      onLoadComplete(detail);
    } else if (type === "player-error" && typeof onPlayerError === "function") {
      onPlayerError(detail);
    } else if (type === "session-changed" && typeof onSessionChanged === "function") {
      onSessionChanged(detail);
    } else if (type === "model-updated" && typeof onModelUpdated === "function") {
      onModelUpdated(detail);
    } else if (type === "model-loaded" && typeof onModelLoaded === "function") {
      onModelLoaded(detail);
    }

    // Also dispatch a DOM event so hosts can listen outside Svelte.
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
    reportPlayerError({
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

  export async function validateModels(): Promise<AuthoringValidationResult> {
    if (mode !== "author" || !itemConfig) {
      return { hasErrors: false, validatedModels: [] };
    }

    const results = await Promise.all([
      validateAuthoringModels(itemConfig, configuration, {
        container: rootElement ?? undefined,
      }),
      passageConfig
        ? validateAuthoringModels(passageConfig, configuration, {
            container: rootElement ?? undefined,
          })
        : Promise.resolve({ hasErrors: false, validatedModels: [] }),
    ]);

    return {
      hasErrors: results.some((result) => result.hasErrors),
      validatedModels: results.flatMap((result) => result.validatedModels),
    };
  }

  // Populate session with correct responses when addCorrectResponse is true
  async function populateCorrectResponses(force = false) {
    // Early return checks
    if (!addCorrectResponse || !itemConfig || (correctResponsesAdded && !force))
      return;

    // Keep evaluate mode behavior unchanged by forcing instructor role internally
    // when generating correct responses.
    if (!canPopulateCorrectResponses(env)) {
      logger.debug(
        "[PieItemPlayer] Skipping populateCorrectResponses - env not suitable (mode=%s)",
        env.mode
      );
      return;
    }
    const correctResponseEnv = getCorrectResponseEnv(env);
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
            (await controller.createCorrectResponseSession(
              model,
              correctResponseEnv
            )) as any;

          // Check if we got a valid response
          if (!correctResponse) {
            logger.debug(
              "[PieItemPlayer] createCorrectResponseSession returned null for %s (env=%j)",
              model.element,
              correctResponseEnv
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
        void updatePieElements(
          itemConfig,
          session,
          env,
          rootElement ?? undefined,
          onElementSessionUpdate
        );
        if (passageConfig) {
          void updatePieElements(
            passageConfig,
            session,
            env,
            rootElement ?? undefined,
            onElementSessionUpdate
          );
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

      // Report that correct responses reached the session, so a host can detect
      // a population it never asked for. Prevention is not available at this
      // layer: `addCorrectResponse`, `env` and `mode` are all public attributes
      // on `<pie-item-player>`, so any page script can set them, and a
      // legitimate preview (`mode: "view"`, `role: "student"`, controllers
      // client-side) is indistinguishable from a tampered delivery from in
      // here. `hosted=true` / `player.js` is the boundary; this is the signal.
      //
      // The detail carries counts and `config.models[].element` names, never
      // the session entries: those hold the correct answers, and this payload
      // is forwarded to a host's telemetry provider by the instrumentation
      // bridge.
      //
      // Called directly rather than through `dispatch()`: that helper's DOM
      // branch dispatches on `window`, and the custom element already owns DOM
      // emission for every public event via `handlePlayerEvent`.
      onCorrectResponsesPopulated?.({
        itemId: itemConfig.id,
        mode: env?.mode,
        role: env?.role,
        bundleType,
        populatedCount: newSession.length,
        elements: newSession.map((entry: any) => String(entry.element ?? "")),
      });
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
  const rootClassFinal = $derived(
    ["pie-item-player", allowedResize ? "pie-item-player--resize-allowed" : ""]
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

  // Resource monitor (handles initialization and cleanup automatically)
  useResourceMonitor(
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
        runtimePlayerError = null;
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

          const initializedModels = initializeConfiguresFromLoadedBundle(itemConfig, configuration, {
            env: authoringEnv,
            container: rootElement ?? undefined,
          });
          logger.debug("[PieItemPlayer] Configure elements initialized");

          if (passageConfig) {
            initializedModels.push(
              ...initializeConfiguresFromLoadedBundle(passageConfig, configuration, {
                env: authoringEnv,
                container: rootElement ?? undefined,
              })
            );
            logger.debug(
              "[PieItemPlayer] Passage configure elements initialized"
            );
          }

          dispatch("model-loaded", {
            models: initializedModels,
            configuration,
          });

          if (rootElement && effectiveHandlers) {
            assetEventManager = createAuthoringAssetEventManager(
              rootElement,
              effectiveHandlers,
              (context, error) => {
                logger.error(`[PieItemPlayer] ${context} failed:`, error);
              }
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
          await updatePieElements(
            itemConfig,
            session,
            env,
            rootElement ?? undefined,
            onElementSessionUpdate
          );

          if (passageConfig) {
            await updatePieElements(
              passageConfig,
              session,
              env,
              rootElement ?? undefined,
              onElementSessionUpdate
            );
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
              // The element's own `session-changed` ends here. It carries the PIE
              // element contract's metadata detail (`complete`, `component`) and no
              // `session` at all, so a host that read `detail.session` off it got
              // `undefined` — indistinguishable from the deliberate
              // `session: null` + `intent: "metadata-only"` signal the player emits
              // for a metadata-only change. The player re-emits a canonical
              // `session-changed` from its own host below, which is the one that
              // reaches hosts; letting the raw event past this point published two
              // events per change with different contracts under one name.
              // Section-player's ItemShellElement already dedupes what escapes,
              // which is the cost this avoids rather than a reason to keep it.
              // Stop before the re-entry guard so the raw event never escapes on the
              // early-return paths either.
              event.stopPropagation();

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
        reportPlayerError(
          {
            code: "ITEM_PLAYER_INITIALIZATION_ERROR",
            message: e instanceof Error ? e.message : String(e),
            cause: e instanceof Error ? e.stack || e.message : String(e),
          },
          "ITEM_PLAYER_INITIALIZATION_ERROR"
        );
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
      // Generate correct responses with instructor role semantics.
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
  let updateQueued = false;
  function runElementUpdate() {
    if (isUpdating) {
      updateQueued = true;
      return;
    }
    isUpdating = true;
    untrack(() => {
      void updatePieElements(
        itemConfig,
        session,
        env,
        rootElement ?? undefined,
        onElementSessionUpdate
      )
        .then(() =>
          passageConfig
            ? updatePieElements(
                passageConfig,
                session,
                env,
                rootElement ?? undefined,
                onElementSessionUpdate
              )
            : undefined
        )
        .catch((e: any) => {
          reportPlayerError(
            {
              code: "ITEM_PLAYER_UPDATE_ERROR",
              message: e instanceof Error ? e.message : String(e),
              cause: e instanceof Error ? e.stack || e.message : String(e),
            },
            "ITEM_PLAYER_UPDATE_ERROR"
          );
        })
        .finally(() => {
          isUpdating = false;
          if (updateQueued) {
            updateQueued = false;
            setTimeout(() => {
              runElementUpdate();
            }, 0);
          }
        });
    });
  }

  $effect(() => {
    if (!initialized || !env || !itemConfig || !session) return;

    // Log changes
    logger.debug("[PieItemPlayer] Dependencies changed, updating elements");
    logger.debug("[PieItemPlayer] Env:", env);
    logger.debug(
      "[PieItemPlayer] Session (length=" + session.length + "):",
      session
    );

    // Keep the update guard active until controller-derived session writes have
    // landed; if props change during that window, run once more with the latest
    // state instead of dropping the update.
    runElementUpdate();
  });

  $effect(() => {
    if (!rootElement) return;
    const handleControllerError = (event: Event) => {
      const customEvent = event as CustomEvent;
      reportPlayerError(customEvent.detail, "PIE_CONTROLLER_RUNTIME_ERROR");
    };
    rootElement.addEventListener(
      "pie-controller-error",
      handleControllerError as EventListener
    );
    return () => {
      rootElement?.removeEventListener(
        "pie-controller-error",
        handleControllerError as EventListener
      );
    };
  });

  // Run a post-render pass over the player's live subtree using the same
  // per-element wrappers as the string pipeline (so the produced
  // pie-image-scroll / pie-table-scroll markup is byte-identical) and
  // re-run on every mutation tick so element-painted content is wrapped as
  // soon as it lands. The wrap is idempotent.
  $effect(() => {
    if (!rootElement) return;
    const root = rootElement;
    const tickWrap = () => {
      logger.debug("[PieItemPlayer] Running post-render wrap pass");
      wrapOverwideImagesInElement(root);
      wrapOverwideTablesInElement(root);
    };
    tickWrap();
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      tickWrap();
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
    };
  });

  // Note: Resource monitor cleanup is handled automatically by useResourceMonitor's onDestroy
</script>

<div class={rootClassFinal} bind:this={rootElement}>
  {#if runtimePlayerError}
    <div
      class="pie-player-error"
      style="
        padding: 20px;
        margin: 20px 0;
        border-radius: 4px;
        font-family: sans-serif;
      "
    >
      <h3 style="margin: 0 0 10px 0">{messages.t("player.playerError")}</h3>
      <p style="margin: 0">{runtimePlayerError}</p>
    </div>
  {/if}
  {#if authoringBlockedError}
    <div
      class="pie-player-error"
      style="
        padding: 20px;
        margin: 20px 0;
        border-radius: 4px;
        font-family: sans-serif;
      "
    >
      <h3 style="margin: 0 0 10px 0">{messages.t("player.authoringBackendError")}</h3>
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

  .pie-item-player--resize-allowed .pie-passage-container {
    max-width: 100%;
    overflow: auto;
    resize: horizontal;
  }

  /*
   * The error banner carries a fixed red encoding, so it behaves like any other
   * fixed hue: exact at 0% collapse, which is every Base Theme, folded into the
   * palette at 100%, which is every scheme. Pinned, a learner on White on Black
   * or Yellow on Navy got a pale pink box in the middle of the palette they
   * chose.
   *
   * The collapsed ink is `--pie-text`, not `--pie-incorrect`: that pairs with
   * this tint at 4.14:1 under Black on White, where the page's own ink holds at
   * 6.18:1 or better on every scheme, now a declared relationship. The tint
   * itself sits about 1.1:1 from the page, so the `--pie-incorrect` edge is what
   * makes this read as a banner at all -- the same division of labour the
   * periodic table's collapsed cells use, and that edge clears 4.53:1 against
   * every scheme's page.
   */
  .pie-player-error {
    border: 2px solid
      color-mix(
        in srgb,
        var(--pie-incorrect, #d32f2f) var(--pie-fixed-hue-collapse, 0%),
        #d32f2f
      );
    background-color: color-mix(
      in srgb,
      var(--pie-incorrect-secondary, #ffebee) var(--pie-fixed-hue-collapse, 0%),
      #ffebee
    );
    color: color-mix(
      in srgb,
      var(--pie-text, #c62828) var(--pie-fixed-hue-collapse, 0%),
      #c62828
    );
  }
</style>
