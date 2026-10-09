/**
 * Text-to-Speech (TTS) Tool Registration
 *
 * Registers the TTS tool for reading content aloud.
 */

import type {
	ToolRegistration,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "@pie-players/pie-assessment-toolkit/tools/registration";
import type { ToolContext } from "@pie-players/pie-assessment-toolkit/tools/registration";
import { hasReadableText } from "@pie-players/pie-assessment-toolkit/tools/registration";
import {
	createScopedToolId,
	createToolElement,
} from "@pie-players/pie-assessment-toolkit/tools/registration";
import {
	buildRuntimeTTSConfig,
	normalizeTTSLayoutMode,
	normalizeTTSSpeedControlOptions,
	type NormalizedTTSSpeedOption,
	resolveTTSHostToolbarLayout,
	resolveTTSLayoutMode,
	resolveTTSBackend,
	resolveTTSRuntimeSettings,
	resolveRuntimeProvider,
	resolveTransportMode,
} from "@pie-players/pie-assessment-toolkit/tools/registration";
import { TTSToolProvider } from "@pie-players/pie-assessment-toolkit/tools/registration";
import { resolveOverlayElement } from "./overlay-element-cache.js";

// This package owns the server adapter's import, so the toolkit never names it
// and a bundler building the toolkit alone has nothing to resolve.
const loadServerTTSProvider = async () =>
	(await import("@pie-players/tts-client-server")).ServerTTSProvider;

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
	nameKey: "tools.textToSpeech.name",
	descriptionKey: "tools.textToSpeech.description",
	icon: "volume-up",
	provider: {
		createProvider: (config) => {
			const settings = resolveTTSRuntimeSettings(config);
			return new TTSToolProvider(resolveTTSBackend(settings), {
				loadServerProvider: loadServerTTSProvider,
			});
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
		lazy: true,
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
			settings.speedOptions = normalizeTTSSpeedControlOptions(
				settings.speedOptions,
			);
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
			normalizedConfig.speedOptions = normalizeTTSSpeedControlOptions(
				normalizedConfig.speedOptions,
			);
		}
		if (settings) {
			normalizedConfig.settings = settings;
		}
		return normalizedConfig as typeof config;
	},

	// TTS is inline-only and scoped to item/passage contexts.
	supportedLevels: ["item", "passage"],

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
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		const resolveRuntimeSettings = () =>
			resolveTTSRuntimeSettings(
				toolbarContext.toolkitCoordinator?.getToolConfig(this.toolId) ||
					undefined,
			);
		const resolveElementSpeedOptions = (): NormalizedTTSSpeedOption[] => {
			const runtimeSettings = resolveRuntimeSettings();
			return normalizeTTSSpeedControlOptions(runtimeSettings.speedOptions);
		};
		const resolveLayoutMode = () =>
			resolveTTSLayoutMode(resolveRuntimeSettings());
		const resolveHostLayout = () =>
			resolveTTSHostToolbarLayout(resolveRuntimeSettings());
		const fullToolId = createScopedToolId(
			this.toolId,
			toolbarContext.scope.level,
			toolbarContext.scope.scopeId,
		);
		// Only a language the toolbar or its host named: unnamed, the control resolves
		// markup `lang`, and the browser voice follows the browser's language.
		const applyContentLanguage = (element: HTMLElement) => {
			if (toolbarContext.language) {
				element.setAttribute("language", toolbarContext.language);
			} else {
				element.removeAttribute("language");
			}
		};
		const resolveControlSize = (): "sm" | "md" | "lg" => {
			const raw = toolbarContext.ui?.size;
			return raw === "sm" || raw === "lg" ? raw : "md";
		};
		const element = resolveOverlayElement(
			toolbarContext,
			fullToolId,
			() =>
				createToolElement(
					this.toolId,
					context,
					toolbarContext,
					toolbarContext.componentOverrides,
				) as HTMLElement & {
					speedOptions?: NormalizedTTSSpeedOption[];
					showSingleSpeedOption?: boolean;
				},
		);
		const applyAttributes = () => {
			element.setAttribute(
				"catalog-id",
				toolbarContext.catalogId || toolbarContext.itemId,
			);
			applyContentLanguage(element);
			element.setAttribute("size", resolveControlSize());
			element.setAttribute("layout-mode", resolveLayoutMode());
			element.speedOptions = resolveElementSpeedOptions();
			element.showSingleSpeedOption =
				resolveRuntimeSettings().showSingleSpeedOption === true;
		};
		applyAttributes();
		const hostLayout = resolveHostLayout();

		return {
			toolId: this.toolId,
			button: null,
			elements: [
				{
					element,
					mount: hostLayout.mount,
					layoutHints: {
						controlsRow: {
							reserveSpace: hostLayout.controlsRow.reserveSpace,
							showWhenToolActive: hostLayout.controlsRow.expandWhenToolActive,
						},
						headerOverlay: {
							showWhenToolActive: hostLayout.headerOverlay.expandWhenToolActive,
						},
					},
				},
			],
			subscribeActive: (callback) => {
				const handler = (event: Event) => {
					const detail = (event as CustomEvent<{ active?: boolean }>).detail;
					callback(detail?.active === true);
				};
				element.addEventListener(TOOL_ACTIVE_CHANGE_EVENT, handler);
				return () => {
					element.removeEventListener(TOOL_ACTIVE_CHANGE_EVENT, handler);
				};
			},
			sync: applyAttributes,
		};
	},
};
