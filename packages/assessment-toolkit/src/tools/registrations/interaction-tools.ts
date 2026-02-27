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
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "../../services/ToolRegistry.js";
import type { ToolContext } from "../../services/tool-context.js";
import {
	hasChoiceInteraction,
	hasReadableText,
} from "../../services/tool-context.js";
import { createScopedToolId } from "../../services/tool-instance-id.js";
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

	// Answer eliminator appears at item level only
	supportedLevels: ["item"],

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

	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		const fullToolId = createScopedToolId(
			this.toolId,
			"item",
			toolbarContext.itemId,
		);
		const componentOverrides =
			(toolbarContext.componentOverrides as ToolComponentOverrides | undefined) ?? {};
		const overlay = createToolElement(
			this.toolId,
			context,
			toolbarContext,
			componentOverrides,
		) as HTMLElement & {
			visible?: boolean;
			toolId?: string;
			coordinator?: unknown;
			elementToolStateStore?: unknown;
			globalElementId?: string;
			scopeElement?: HTMLElement | null;
		};
		overlay.setAttribute("tool-id", fullToolId);
		overlay.setAttribute("strategy", "strikethrough");
		overlay.setAttribute("button-alignment", "inline");

		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M19,3H16.3H7.7H5A2,2 0 0,0 3,5V7.7V16.4V19A2,2 0 0,0 5,21H7.7H16.4H19A2,2 0 0,0 21,19V16.3V7.7V5A2,2 0 0,0 19,3M15.6,17L12,13.4L8.4,17L7,15.6L10.6,12L7,8.4L8.4,7L12,10.6L15.6,7L17,8.4L13.4,12L17,15.6L15.6,17Z"/></svg>',
			disabled: false,
			ariaLabel: "Answer eliminator - Strike through choices",
			tooltip: "Strike Through",
			onClick: () => toolbarContext.toggleTool(this.toolId),
			active: toolbarContext.isToolVisible(fullToolId),
		};

		return {
			toolId: this.toolId,
			button,
			overlayElement: overlay,
			sync: () => {
				const active = toolbarContext.isToolVisible(fullToolId);
				button.active = active;
				overlay.visible = active;
				if (toolbarContext.toolCoordinator) {
					overlay.coordinator = toolbarContext.toolCoordinator;
				}
				overlay.scopeElement = toolbarContext.getScopeElement?.() || null;
				if (toolbarContext.elementToolStateStore) {
					overlay.elementToolStateStore = toolbarContext.elementToolStateStore;
				}
				const globalElementId = toolbarContext.getGlobalElementId?.();
				if (globalElementId) {
					overlay.globalElementId = globalElementId;
				}
			},
			subscribeActive: (callback: (active: boolean) => void) => {
				if (!toolbarContext.subscribeVisibility) return () => {};
				return toolbarContext.subscribeVisibility(() => {
					callback(toolbarContext.isToolVisible(fullToolId));
				});
			},
		};
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

	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		const fullToolId = createScopedToolId(
			this.toolId,
			"item",
			toolbarContext.itemId,
		);
		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: false,
			ariaLabel: "Highlighter - Highlight text",
			tooltip: "Highlight",
			onClick: () => toolbarContext.toggleTool(this.toolId),
			active: toolbarContext.isToolVisible(fullToolId),
		};
		const componentOverrides =
			(toolbarContext.componentOverrides as ToolComponentOverrides | undefined) ?? {};
		const overlay = createToolElement(
			this.toolId,
			context,
			toolbarContext,
			componentOverrides,
		) as HTMLElement & {
			enabled?: boolean;
			visible?: boolean;
			toolId?: string;
			highlightCoordinator?: unknown;
			ttsService?: unknown;
		};
		overlay.setAttribute("tool-id", fullToolId);
		return {
			toolId: this.toolId,
			button,
			overlayElement: overlay,
			sync: () => {
				const active = toolbarContext.isToolVisible(fullToolId);
				button.active = active;
				overlay.enabled = active;
				overlay.visible = active;
				if (toolbarContext.ttsService) {
					overlay.ttsService = toolbarContext.ttsService;
				}
			},
			subscribeActive: (callback: (active: boolean) => void) => {
				if (!toolbarContext.subscribeVisibility) return () => {};
				return toolbarContext.subscribeVisibility(() => {
					callback(toolbarContext.isToolVisible(fullToolId));
				});
			},
		};
	},
};
