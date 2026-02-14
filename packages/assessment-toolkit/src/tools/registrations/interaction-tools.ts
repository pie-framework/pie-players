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
} from "../../services/ToolRegistry";
import type { ToolContext } from "../../services/tool-context";
import {
	hasChoiceInteraction,
	hasReadableText,
} from "../../services/tool-context";

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

	// Answer eliminator appears at item and element level
	supportedLevels: ["item", "element"],

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
		// Answer eliminator typically works as a mode/service
		// rather than a separate component
		const container = document.createElement("div");
		container.className = "answer-eliminator-active";
		container.setAttribute("role", "status");
		container.setAttribute("aria-live", "polite");
		container.textContent = "Answer eliminator active - Click choices to strike through";

		// If answer eliminator service is available, activate it
		if (options.config?.answerEliminatorService) {
			const service = options.config.answerEliminatorService as any;
			if (service.activate) {
				service.activate();
			}
		}

		if (options.onClose) {
			container.addEventListener("close", options.onClose);
		}

		return container;
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
		// Highlighter works as a service/mode
		const container = document.createElement("div");
		container.className = "highlighter-active";
		container.setAttribute("role", "status");
		container.setAttribute("aria-live", "polite");
		container.textContent = "Highlighter active - Select text to highlight";

		// If highlight coordinator is available, activate highlighting
		if (options.config?.highlightCoordinator) {
			const coordinator = options.config.highlightCoordinator as any;
			if (coordinator.enableHighlighting) {
				coordinator.enableHighlighting();
			}
		}

		if (options.onClose) {
			container.addEventListener("close", () => {
				// Disable highlighting when closed
				if (options.config?.highlightCoordinator) {
					const coordinator = options.config.highlightCoordinator as any;
					if (coordinator.disableHighlighting) {
						coordinator.disableHighlighting();
					}
				}
				options.onClose?.();
			});
		}

		return container;
	},
};
