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
		const fullToolId = createScopedToolId(
			this.toolId,
			"item",
			toolbarContext.itemId,
			"inline",
		);
		const inline = document.createElement("pie-tool-tts-inline") as HTMLElement & {
			toolId?: string;
			catalogId?: string;
			language?: string;
			size?: string;
			ttsService?: unknown;
		};
		inline.setAttribute("tool-id", fullToolId);
		inline.setAttribute("catalog-id", toolbarContext.catalogId || toolbarContext.itemId);
		inline.setAttribute("language", toolbarContext.language);
		inline.setAttribute("size", toolbarContext.ui?.size || "md");

		let readyRequested = false;
		return {
			toolId: this.toolId,
			inlineElement: inline,
			sync: () => {
				inline.setAttribute("catalog-id", toolbarContext.catalogId || toolbarContext.itemId);
				inline.setAttribute("language", toolbarContext.language);
				inline.setAttribute("size", toolbarContext.ui?.size || "md");
				if (toolbarContext.ttsService) {
					inline.ttsService = toolbarContext.ttsService;
				}
				if (!readyRequested && toolbarContext.ensureTTSReady) {
					readyRequested = true;
					void toolbarContext.ensureTTSReady().catch((error: unknown) => {
						console.error("[ttsToolRegistration] Failed to initialize TTS service:", error);
					});
				}
			},
		};
	},
};
