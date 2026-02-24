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
} from "../../services/ToolRegistry.js";
import type { ToolContext } from "../../services/tool-context.js";
import { hasReadableText } from "../../services/tool-context.js";
import {
	createToolElement,
	type ToolComponentOverrides,
} from "../tool-tag-map.js";

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
				options.ariaLabel || "Read aloud - Press to activate text-to-speech",
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
		const componentOverrides =
			(options.config as ToolComponentOverrides | undefined) ?? {};
		const tts = createToolElement(
			this.toolId,
			context,
			options,
			componentOverrides,
		) as HTMLElement & {
			visible: boolean;
			toolId: string;
			coordinator?: unknown;
			ttsService?: unknown;
			contentElement?: HTMLElement;
		};

		tts.visible = true;
		tts.toolId = this.toolId;

		const toolkitCoordinator = options.config?.toolkitCoordinator;
		if (!toolkitCoordinator) {
			throw new Error(
				"[ttsToolRegistration] toolkitCoordinator is required in ToolInstanceOptions.config",
			);
		}
		tts.coordinator = toolkitCoordinator;
		if (options.config?.ttsService) {
			tts.ttsService = options.config.ttsService;
		}
		if (options.config?.contentElement) {
			tts.contentElement = options.config.contentElement as HTMLElement;
		}

		if (options.onClose) {
			tts.addEventListener("close", options.onClose);
		}

		return tts;
	},
};
