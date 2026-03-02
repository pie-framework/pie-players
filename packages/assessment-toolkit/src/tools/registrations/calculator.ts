/**
 * Calculator Tool Registration
 *
 * Registers the calculator tool with support for multiple calculator types
 * (basic, scientific, graphing) via Desmos provider.
 *
 * Maps to QTI 3.0 standard access features:
 * - calculator (cognitive support)
 * - graphingCalculator (assessment tool)
 */

import type {
	ToolRegistration,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "../../services/ToolRegistry.js";
import type { ToolContext } from "../../services/tool-context.js";
import { hasMathContent } from "../../services/tool-context.js";
import { createScopedToolId } from "../../services/tool-instance-id.js";
import { createToolElement } from "../tool-tag-map.js";

/**
 * Calculator tool registration
 *
 * Supports:
 * - Basic, scientific, and graphing calculators via Desmos
 * - Context-aware visibility (shows only when math content is detected)
 * - Item level only
 */
export const calculatorToolRegistration: ToolRegistration = {
	toolId: "calculator",
	name: "Calculator",
	description: "Multi-type calculator (basic, scientific, graphing)",
	icon: "calculator",

	// Calculator is item-level in this player architecture.
	supportedLevels: ["item"],

	// PNP support IDs that enable this tool
	// Maps to QTI 3.0 standard features: calculator, graphingCalculator
	pnpSupportIds: [
		"calculator", // QTI 3.0 standard (cognitive.calculator)
		"graphingCalculator", // QTI 3.0 standard (assessment.graphingCalculator)
		"basicCalculator", // Common variant
		"scientificCalculator", // Common variant
	],

	/**
	 * Pass 2: Determine if calculator is relevant in this context
	 *
	 * Calculator is relevant when context contains mathematical content
	 * (MathML, LaTeX, arithmetic markers).
	 */
	isVisibleInContext(context: ToolContext): boolean {
		// Show only when math is present in item content.
		return hasMathContent(context);
	},

	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		const fullToolId = createScopedToolId(
			this.toolId,
			toolbarContext.scope.level,
			toolbarContext.scope.scopeId,
		);
		const componentOverrides = toolbarContext.componentOverrides;
		const overlay = createToolElement(
			this.toolId,
			context,
			toolbarContext,
			componentOverrides,
		) as HTMLElement & {
			visible?: boolean;
			toolId?: string;
		};
		overlay.setAttribute("tool-id", fullToolId);

		const inline = document.createElement("pie-tool-calculator-inline");
		inline.setAttribute(
			"tool-id",
			`${fullToolId}--launcher`,
		);
		inline.setAttribute("target-tool-id", fullToolId);
		inline.setAttribute("calculator-type", "scientific");
		inline.setAttribute("available-types", "basic,scientific,graphing");
		inline.setAttribute("size", toolbarContext.ui?.size || "md");

		return {
			toolId: this.toolId,
			elements: [
				{ element: inline, mount: "before-buttons" },
				{ element: overlay, mount: "after-buttons" },
			],
			button: null,
			sync: () => {
				const active = toolbarContext.isToolVisible(fullToolId);
				overlay.visible = active;
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
