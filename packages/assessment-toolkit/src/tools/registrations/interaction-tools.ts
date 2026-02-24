/**
 * Interaction Tools Registrations
 *
 * Registers tools for interacting with question content:
 * - Answer Eliminator (strike through answer choices)
 * - Highlighter (highlight text passages)
 *
 * Maps to QTI 3.0 standard access features:
 * - answerMasking (assessment tool)
 * - strikethrough (visual transformation)
 * - highlighting (cognitive/reading support)
 */

import type {
	ToolRegistration,
	ToolButtonDefinition,
	ToolButtonOptions,
	ToolInstanceOptions,
} from "../../services/ToolRegistry.js";
import type { ToolContext } from "../../services/tool-context.js";
import {
	hasChoiceInteraction,
	hasReadableText,
} from "../../services/tool-context.js";
import {
	createToolElement,
	type ToolComponentOverrides,
} from "../tool-tag-map.js";

/**
 * Answer Eliminator tool registration
 *
 * Allows students to strike through incorrect answer choices.
 * Only appears on multiple-choice style questions.
 */
export const answerEliminatorToolRegistration: ToolRegistration = {
	toolId: "answerEliminator",
	name: "Answer Eliminator",
	description: "Strike through answer choices",
	icon: "strikethrough",

	// Answer eliminator appears at element level only
	supportedLevels: ["element"],

	// PNP support IDs
	// Maps to QTI 3.0 standard feature: answerMasking
	pnpSupportIds: [
		"answerMasking", // QTI 3.0 standard (assessment.answerMasking)
		"answerEliminator", // QTI 3.0 standard (assessment.answerEliminator)
		"strikethrough", // Common variant
		"choiceMasking", // Common variant
	],

	/**
	 * Pass 2: Answer eliminator is relevant only for choice-based questions
	 */
	isVisibleInContext(context: ToolContext): boolean {
		return hasChoiceInteraction(context);
	},

	createButton(
		context: ToolContext,
		options: ToolButtonOptions,
	): ToolButtonDefinition {
		return {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: options.disabled || false,
			ariaLabel:
				options.ariaLabel || "Answer eliminator - Strike through choices",
			tooltip: options.tooltip || "Strike Through",
			onClick: options.onClick || (() => {}),
			className: options.className,
		};
	},

	createToolInstance(
		context: ToolContext,
		options: ToolInstanceOptions,
	): HTMLElement {
		const componentOverrides =
			(options.config as ToolComponentOverrides | undefined) ?? {};
		const answerEliminator = createToolElement(
			this.toolId,
			context,
			options,
			componentOverrides,
		) as HTMLElement & {
			visible: boolean;
			toolId: string;
			coordinator?: unknown;
			elementToolStateStore?: unknown;
			globalElementId?: string;
		};

		answerEliminator.visible = true;
		answerEliminator.toolId = this.toolId;

		if (options.config?.toolkitCoordinator) {
			answerEliminator.coordinator = options.config.toolkitCoordinator;
		}
		if (options.config?.elementToolStateStore) {
			answerEliminator.elementToolStateStore =
				options.config.elementToolStateStore;
		}
		if (typeof options.config?.globalElementId === "string") {
			answerEliminator.globalElementId = options.config.globalElementId;
		}

		if (options.onClose) {
			answerEliminator.addEventListener("close", options.onClose);
		}

		return answerEliminator;
	},
};

/**
 * Highlighter tool registration
 *
 * Allows students to highlight text in passages and questions.
 * Appears on items with readable text content.
 */
export const highlighterToolRegistration: ToolRegistration = {
	toolId: "highlighter",
	name: "Highlighter",
	description: "Highlight text",
	icon: "highlighter",

	// Highlighter appears at passage, rubric, item, and element levels
	supportedLevels: ["passage", "rubric", "item", "element"],

	// PNP support IDs
	pnpSupportIds: ["highlighter", "textHighlight", "annotation"],

	/**
	 * Pass 2: Highlighter is relevant when readable text is available
	 */
	isVisibleInContext(context: ToolContext): boolean {
		return hasReadableText(context);
	},

	createButton(
		context: ToolContext,
		options: ToolButtonOptions,
	): ToolButtonDefinition {
		return {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: options.disabled || false,
			ariaLabel: options.ariaLabel || "Highlighter - Highlight text",
			tooltip: options.tooltip || "Highlight",
			onClick: options.onClick || (() => {}),
			className: options.className,
		};
	},

	createToolInstance(
		context: ToolContext,
		options: ToolInstanceOptions,
	): HTMLElement {
		const componentOverrides =
			(options.config as ToolComponentOverrides | undefined) ?? {};
		const highlighter = createToolElement(
			this.toolId,
			context,
			options,
			componentOverrides,
		) as HTMLElement & {
			enabled: boolean;
			highlightCoordinator?: unknown;
			ttsService?: unknown;
		};

		highlighter.enabled = true;
		if (options.config?.highlightCoordinator) {
			highlighter.highlightCoordinator = options.config.highlightCoordinator;
		}
		if (options.config?.ttsService) {
			highlighter.ttsService = options.config.ttsService;
		}

		if (options.onClose) {
			highlighter.addEventListener("close", options.onClose);
		}

		return highlighter;
	},
};
