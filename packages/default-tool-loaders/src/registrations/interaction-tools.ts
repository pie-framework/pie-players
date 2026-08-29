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
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import type { ToolContext } from "@pie-players/pie-assessment-toolkit/tools/internal";
import {
	hasChoiceInteraction,
	hasReadableText,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import {
	createToolElement,
	type ToolComponentOverrides,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import {
	createScopedVisibilityBinding,
	syncButtonAndOverlayVisibility,
} from "@pie-players/pie-assessment-toolkit/tools/internal";

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
	nameKey: "tools.answerEliminator.name",
	descriptionKey: "tools.answerEliminator.description",
	icon: "strikethrough",

	// Answer eliminator appears at item level only
	supportedLevels: ["item"],

	// PNP support IDs
	// Maps to QTI 3.0 standard feature: answerMasking
	pnpSupportIds: [
		"answerMasking", // QTI 3.0 standard (assessment.answerMasking)
		"answerEliminator", // QTI 3.0 standard (assessment.answerEliminator)
		"strikethrough", // QTI 3.0 standard (assessment.strikethrough)
	],

	/**
	 * Pass 2: Answer eliminator is relevant only for choice-based questions
	 */
	isVisibleInContext(context: ToolContext): boolean {
		return hasChoiceInteraction(context);
	},

	/**
	 * Pass 3: the same question, asked as a capability. Elimination controls are
	 * rendered per choice, so an item with no choice interaction gives this tool
	 * nothing to act on — `placement-ordering`, `categorize` and
	 * `drag-in-the-blank` included, whose `choices` hold draggables the
	 * eliminator cannot reach. Answering the relevance gate alone left the button
	 * on those items for any learner whose profile grants answer masking.
	 */
	isApplicableToContent(context: ToolContext): boolean {
		return hasChoiceInteraction(context);
	},

	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		const visibility = createScopedVisibilityBinding(
			this.toolId,
			toolbarContext,
		);
		const componentOverrides =
			(toolbarContext.componentOverrides as
				| ToolComponentOverrides
				| undefined) ?? {};
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
		overlay.setAttribute("tool-id", visibility.fullToolId);
		overlay.setAttribute("strategy", "strikethrough");
		overlay.setAttribute("button-alignment", "inline");

		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M19,3H16.3H7.7H5A2,2 0 0,0 3,5V7.7V16.4V19A2,2 0 0,0 5,21H7.7H16.4H19A2,2 0 0,0 21,19V16.3V7.7V5A2,2 0 0,0 19,3M15.6,17L12,13.4L8.4,17L7,15.6L10.6,12L7,8.4L8.4,7L12,10.6L15.6,7L17,8.4L13.4,12L17,15.6L15.6,17Z"/></svg>',
			disabled: false,
			ariaLabel: toolbarContext.i18n.t("tools.answerEliminator.buttonA11y"),
			tooltip: toolbarContext.i18n.t("tools.answerEliminator.tooltip"),
			onClick: () => toolbarContext.toggleTool(this.toolId),
			active: visibility.isActive(),
		};

		return {
			toolId: this.toolId,
			button,
			elements: [{ element: overlay, mount: "after-buttons" }],
			sync: () => {
				syncButtonAndOverlayVisibility({
					button,
					overlay,
					isActive: visibility.isActive,
				});
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
			subscribeActive: visibility.subscribeActive,
		};
	},
};
