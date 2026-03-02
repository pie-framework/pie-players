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
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "../../services/ToolRegistry.js";
import type { ToolContext } from "../../services/tool-context.js";
import { hasReadableText } from "../../services/tool-context.js";
import { createScopedToolId } from "../../services/tool-instance-id.js";

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
		let ensureReadyPromise: Promise<void> | null = null;
		const ttsService = toolbarContext.ttsService as
			| {
					speak?: (
						text: string,
						options?: {
							catalogId?: string;
							language?: string;
							contentElement?: Element;
						},
					) => Promise<void>;
					stop?: () => void;
					setHighlightCoordinator?: (coordinator: unknown) => void;
					setRootElement?: (element: HTMLElement) => void;
			  }
			| null;
		const fullToolId = createScopedToolId(
			this.toolId,
			toolbarContext.scope.level,
			toolbarContext.scope.scopeId,
		);
		const isReading = (): boolean => {
			return toolbarContext.isToolVisible(fullToolId);
		};
		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: "Read aloud",
			icon: typeof this.icon === "function" ? this.icon(_context) : this.icon,
			ariaLabel: "Read aloud",
			tooltip: "Read aloud",
			onClick: () => {
				void toggleReadAloud();
			},
			disabled: false,
			active: false,
		};

		const syncButtonState = () => {
			const label = isReading() ? "Stop reading" : "Read aloud";
			button.label = label;
			button.ariaLabel = label;
			button.tooltip = label;
			button.active = isReading();
			button.disabled = !toolbarContext.ttsService;
		};

		const ensureReady = async () => {
			if (!toolbarContext.ensureTTSReady) return;
			if (!ensureReadyPromise) {
				ensureReadyPromise = (async () => {
					await toolbarContext.ensureTTSReady?.();
					if (toolbarContext.toolkitCoordinator?.highlightCoordinator) {
						ttsService?.setHighlightCoordinator?.(
							toolbarContext.toolkitCoordinator.highlightCoordinator,
						);
					}
				})();
			}
			await ensureReadyPromise;
		};

		const stopReading = () => {
			ttsService?.stop?.();
			if (isReading()) {
				toolbarContext.toggleTool(this.toolId);
			}
			syncButtonState();
		};

		const resolveReadingRoot = (): HTMLElement | null => {
			const scoped = toolbarContext.getScopeElement?.();
			if (scoped) return scoped;

			const cssEscape = (value: string) => {
				if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
					return CSS.escape(value);
				}
				return value.replace(/"/g, '\\"');
			};
			const candidateIds = [
				toolbarContext.catalogId,
				toolbarContext.scope.itemId,
				toolbarContext.scope.canonicalItemId,
			].filter((id): id is string => typeof id === "string" && id.length > 0);

			const selectors: string[] = [];
			for (const id of candidateIds) {
				const escapedId = cssEscape(id);
				if (toolbarContext.scope.level === "passage") {
					selectors.push(
						`pie-passage-shell[item-id="${escapedId}"] [data-region="content"]`,
					);
				}
				selectors.push(`pie-item-shell[item-id="${escapedId}"] [data-region="content"]`);
			}
			selectors.push("[data-region='content']");

			for (const selector of selectors) {
				const element = document.querySelector(selector);
				if (element instanceof HTMLElement) {
					return element;
				}
			}
			return null;
		};

		const toggleReadAloud = async () => {
			if (!ttsService?.speak || !toolbarContext.ttsService) return;
			if (isReading()) {
				stopReading();
				return;
			}
			const scopeElement = resolveReadingRoot();
			if (!scopeElement) return;
			const text = (scopeElement.textContent || "").trim().replace(/\s+/g, " ");
			if (!text) return;

			try {
				if (!isReading()) {
					toolbarContext.toggleTool(this.toolId);
				}
				syncButtonState();
				await ensureReady();
				ttsService.setRootElement?.(scopeElement);
				void ttsService.speak(
					text,
					{
						// For passage-level TTS, use rendered DOM text as the source of truth.
						// Catalog/SSML content can diverge from rendered text and break
						// word-boundary-to-DOM mapping for progressive yellow highlighting.
						catalogId:
							toolbarContext.scope.level === "passage"
								? undefined
								: (toolbarContext.catalogId || toolbarContext.itemId),
						language: toolbarContext.language,
						contentElement: scopeElement,
					},
				).catch((error: unknown) => {
					console.error("[ttsToolRegistration] Failed to start reading:", error);
					syncButtonState();
				});
				syncButtonState();
			} catch (error: unknown) {
				syncButtonState();
				console.error("[ttsToolRegistration] Failed to start reading:", error);
			}
		};

		return {
			toolId: this.toolId,
			button,
			sync: () => {
				syncButtonState();
				if (toolbarContext.ensureTTSReady) {
					void ensureReady().catch((error: unknown) => {
						console.error(
							"[ttsToolRegistration] Failed to initialize TTS service:",
							error,
						);
					});
				}
			},
			subscribeActive: (callback: (active: boolean) => void) => {
				if (!toolbarContext.subscribeVisibility) return () => {};
				return toolbarContext.subscribeVisibility(() => {
					const active = isReading();
					syncButtonState();
					callback(active);
				});
			},
		};
	},
};
