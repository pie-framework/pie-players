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
	resolveTTSBackend,
	resolveTTSRuntimeSettings,
	resolveRuntimeProvider,
	resolveTransportMode,
} from "../../services/tts-runtime-config.js";
import { TTSToolProvider } from "../../services/tool-providers/index.js";

const inlineTTSControls = new Map<string, HTMLElement>();
export const TOOL_ELEMENT_UNMOUNT_CALLBACK_PROP = "__pieToolElementUnmount";

const DEFAULT_SPEED_OPTIONS = Object.freeze([1.5, 2]);

const resolveSpeedOptions = (value: unknown): number[] => {
	if (!Array.isArray(value)) return [...DEFAULT_SPEED_OPTIONS];
	const deduped = new Set<number>();
	for (const entry of value) {
		if (typeof entry !== "number" || !Number.isFinite(entry) || entry <= 0) continue;
		const rounded = Math.round(entry * 100) / 100;
		if (rounded === 1) continue;
		deduped.add(rounded);
	}
	return deduped.size ? Array.from(deduped) : [...DEFAULT_SPEED_OPTIONS];
};

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
		const resolveElementSpeedOptions = (): number[] => {
			const runtimeSettings = resolveTTSRuntimeSettings(
				toolbarContext.toolkitCoordinator?.getToolConfig(this.toolId) || undefined,
			);
			return resolveSpeedOptions(runtimeSettings.speedOptions);
		};
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
			(element as HTMLElement & { speedOptions?: number[] }).speedOptions =
				resolveElementSpeedOptions();
			return element;
		};

		return {
			toolId: this.toolId,
			button: null,
			elements: [
				{
					element: ensureElement(),
					mount: "before-buttons",
				},
			],
			sync: () => {
				const element = ensureElement();
				element.setAttribute("tool-id", fullToolId);
				element.setAttribute("catalog-id", toolbarContext.catalogId || toolbarContext.itemId);
				element.setAttribute("language", toolbarContext.language || "en-US");
				element.setAttribute("size", resolveControlSize());
				(element as HTMLElement & { speedOptions?: number[] }).speedOptions =
					resolveElementSpeedOptions();
			},
		};
	},
};
