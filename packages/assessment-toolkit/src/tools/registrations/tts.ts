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
	ToolButtonDefinition,
	ToolButtonOptions,
	ToolInstanceOptions,
} from "../../services/ToolRegistry";
import type { ToolContext } from "../../services/tool-context";
import { hasReadableText } from "../../services/tool-context";

/**
 * Text-to-Speech tool registration
 *
 * Supports:
 * - Reading content aloud using browser TTS or external providers
 * - Context-aware visibility (shows when readable text is available)
 * - All levels except assessment (section, item, passage, rubric, element)
 */
export const ttsToolRegistration: ToolRegistration = {
	toolId: "textToSpeech",
	name: "Text to Speech",
	description: "Read content aloud",
	icon: "volume-up",

	// TTS can appear at all levels except assessment
	supportedLevels: ["section", "item", "passage", "rubric", "element"],

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

	/**
	 * Create TTS button for toolbar
	 */
	createButton(
		context: ToolContext,
		options: ToolButtonOptions,
	): ToolButtonDefinition {
		const icon =
			typeof this.icon === "function" ? this.icon(context) : this.icon;

		return {
			toolId: this.toolId,
			label: this.name,
			icon: icon,
			disabled: options.disabled || false,
			ariaLabel:
				options.ariaLabel ||
				"Read aloud - Press to activate text-to-speech",
			tooltip: options.tooltip || "Read Aloud",
			onClick: options.onClick || (() => {}),
			className: options.className,
		};
	},

	/**
	 * Create TTS tool instance
	 *
	 * Creates a <pie-tool-tts> web component or activates TTS service.
	 * Note: TTS often works as a service rather than a visible component.
	 */
	createToolInstance(
		context: ToolContext,
		options: ToolInstanceOptions,
	): HTMLElement {
		// For TTS, we typically don't create a visible component
		// Instead, we activate the TTSService to read the content

		// Create a placeholder container that will trigger TTS
		const container = document.createElement("div");
		container.className = "tts-active-indicator";
		container.setAttribute("role", "status");
		container.setAttribute("aria-live", "polite");
		container.textContent = "Text to speech active";

		// If TTSService is available from config, start reading
		if (options.config?.ttsService) {
			const ttsService = options.config.ttsService as any;

			// Get the content to read based on context
			const contentElement = options.config?.contentElement as
				| HTMLElement
				| undefined;

			if (contentElement && ttsService.read) {
				// Start reading the content
				ttsService
					.read(contentElement)
					.catch((error: Error) => {
						console.error("TTS error:", error);
					});
			}
		}

		// Handle close callback
		if (options.onClose) {
			container.addEventListener("close", options.onClose);
		}

		return container;
	},
};
