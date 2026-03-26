/**
 * Text-to-Speech (TTS) Tool Registration
 *
 * Registers the TTS tool for reading content aloud.
 *
 * Maps to QTI 3.0 standard access features:
 * - textToSpeech (auditory support)
 * - readAloud (auditory support)
 */

import type {
	ToolRegistration,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "../../services/ToolRegistry.js";
import type { ToolContext } from "../../services/tool-context.js";
import { hasReadableText } from "../../services/tool-context.js";
import { createScopedToolId } from "../../services/tool-instance-id.js";
import {
	buildRuntimeTTSConfig,
	normalizeTTSLayoutMode,
	normalizeTTSSpeedOptions,
	resolveTTSHostToolbarLayout,
	resolveTTSLayoutMode,
	resolveTTSBackend,
	resolveTTSRuntimeSettings,
	resolveRuntimeProvider,
	resolveTransportMode,
} from "../../services/tts-runtime-config.js";
import { TTSToolProvider } from "../../services/tool-providers/index.js";

const inlineTTSControls = new Map<string, HTMLElement>();
export const TOOL_ELEMENT_UNMOUNT_CALLBACK_PROP = "__pieToolElementUnmount";
export const TOOL_ACTIVE_CHANGE_EVENT = "pie-tool-active-change";

/**
 * Text-to-Speech tool registration
 *
 * Supports:
 * - Reading content aloud using browser TTS or external providers
 * - Context-aware visibility (shows when readable text is available)
 * - All levels except assessment and element
 */
export const ttsToolRegistration: ToolRegistration = {
	toolId: "textToSpeech",
	name: "Text to Speech",
	description: "Read content aloud",
	icon: "volume-up",
	provider: {
		getProviderId: () => "tts",
		createProvider: (config) => {
			const settings = resolveTTSRuntimeSettings(config);
			return new TTSToolProvider(resolveTTSBackend(settings));
		},
		getInitConfig: (config) => {
			const settings = resolveTTSRuntimeSettings(config);
			const backend = resolveTTSBackend(settings);
			const serverProvider = resolveRuntimeProvider(settings, backend);
			const transportMode = resolveTransportMode(settings, serverProvider);
			return {
				backend,
				serverProvider,
				transportMode,
				...buildRuntimeTTSConfig(settings),
			};
		},
		getAuthFetcher: (config) => {
			const runtimeAuthFetcher = config?.provider?.runtime?.authFetcher;
			return typeof runtimeAuthFetcher === "function"
				? runtimeAuthFetcher
				: undefined;
		},
		sanitizeConfig: (config) => {
			const settings =
				config.settings && typeof config.settings === "object"
					? { ...(config.settings as Record<string, unknown>) }
					: undefined;
			if (settings && "layoutMode" in settings) {
				settings.layoutMode = normalizeTTSLayoutMode(settings.layoutMode);
			}
			if (settings && "speedOptions" in settings) {
				settings.speedOptions = normalizeTTSSpeedOptions(settings.speedOptions);
			}
			const normalizedConfig: Record<string, unknown> = {
				...(config as Record<string, unknown>),
			};
			if ("layoutMode" in normalizedConfig) {
				normalizedConfig.layoutMode = normalizeTTSLayoutMode(
					normalizedConfig.layoutMode,
				);
			}
			if ("speedOptions" in normalizedConfig) {
				normalizedConfig.speedOptions = normalizeTTSSpeedOptions(
					normalizedConfig.speedOptions,
				);
			}
			if (settings) {
				normalizedConfig.settings = settings;
			}
			return normalizedConfig as typeof config;
		},
		lazy: true,
	},

	// TTS can appear at all levels except assessment and element.
	supportedLevels: ["section", "item", "passage", "rubric"],

	// PNP support IDs that enable this tool
	// Maps to QTI 3.0 standard features: textToSpeech, readAloud
	pnpSupportIds: [
		"textToSpeech", // QTI 3.0 standard (auditory.textToSpeech)
		"readAloud", // QTI 3.0 standard (auditory.readAloud)
		"tts", // Common abbreviation
		"speechOutput", // Common variant
	],

	/**
	 * Pass 2: Determine if TTS is relevant in this context
	 *
	 * TTS is relevant when:
	 * - Context contains readable text (at least 10 characters)
	 */
	isVisibleInContext(context: ToolContext): boolean {
		return hasReadableText(context);
	},

	renderToolbar(
		_context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		const resolveRuntimeSettings = () =>
			resolveTTSRuntimeSettings(
				toolbarContext.toolkitCoordinator?.getToolConfig(this.toolId) || undefined,
			);
		const resolveElementSpeedOptions = (): number[] => {
			const runtimeSettings = resolveRuntimeSettings();
			return normalizeTTSSpeedOptions(runtimeSettings.speedOptions);
		};
		const resolveLayoutMode = () => resolveTTSLayoutMode(resolveRuntimeSettings());
		const resolveHostLayout = () => resolveTTSHostToolbarLayout(resolveRuntimeSettings());
		const fullToolId = createScopedToolId(
			this.toolId,
			toolbarContext.scope.level,
			toolbarContext.scope.scopeId,
		);
		const resolveControlSize = (): "sm" | "md" | "lg" => {
			const raw = toolbarContext.ui?.size;
			return raw === "sm" || raw === "lg" ? raw : "md";
		};
		const ensureElement = (): HTMLElement => {
			let element = inlineTTSControls.get(fullToolId);
			if (
				element &&
				typeof (element as { isConnected?: boolean }).isConnected === "boolean" &&
				!(element as { isConnected?: boolean }).isConnected
			) {
				inlineTTSControls.delete(fullToolId);
				element = undefined;
			}
			if (!element) {
				element = document.createElement("pie-tool-tts-inline");
				(
					element as HTMLElement & {
						[key: string]: unknown;
					}
				)[TOOL_ELEMENT_UNMOUNT_CALLBACK_PROP] = () => {
					if (inlineTTSControls.get(fullToolId) === element) {
						inlineTTSControls.delete(fullToolId);
					}
				};
				inlineTTSControls.set(fullToolId, element);
			}
			element.setAttribute("tool-id", fullToolId);
			element.setAttribute("catalog-id", toolbarContext.catalogId || toolbarContext.itemId);
			element.setAttribute("language", toolbarContext.language || "en-US");
			element.setAttribute("size", resolveControlSize());
			element.setAttribute("layout-mode", resolveLayoutMode());
			(element as HTMLElement & { speedOptions?: number[] }).speedOptions =
				resolveElementSpeedOptions();
			return element;
		};
		const hostLayout = resolveHostLayout();

		return {
			toolId: this.toolId,
			button: null,
			elements: [
				{
					element: ensureElement(),
					mount: hostLayout.mount,
					layoutHints: {
						controlsRow: {
							reserveSpace: hostLayout.controlsRow.reserveSpace,
							showWhenToolActive: hostLayout.controlsRow.expandWhenToolActive,
						},
					},
				},
			],
			subscribeActive: (callback) => {
				const element = ensureElement();
				const handler = (event: Event) => {
					const detail = (event as CustomEvent<{ active?: boolean }>).detail;
					callback(detail?.active === true);
				};
				element.addEventListener(TOOL_ACTIVE_CHANGE_EVENT, handler);
				return () => {
					element.removeEventListener(TOOL_ACTIVE_CHANGE_EVENT, handler);
				};
			},
			sync: () => {
				const element = ensureElement();
				element.setAttribute("tool-id", fullToolId);
				element.setAttribute("catalog-id", toolbarContext.catalogId || toolbarContext.itemId);
				element.setAttribute("language", toolbarContext.language || "en-US");
				element.setAttribute("size", resolveControlSize());
				element.setAttribute("layout-mode", resolveLayoutMode());
				(element as HTMLElement & { speedOptions?: number[] }).speedOptions =
					resolveElementSpeedOptions();
			},
		};
	},
};
