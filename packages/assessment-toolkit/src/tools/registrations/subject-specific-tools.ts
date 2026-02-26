/**
 * Subject-Specific Tools Registrations
 *
 * Registers tools for specific subject areas:
 * - Graph (graphing calculator/coordinate plane)
 * - Periodic Table (chemistry reference)
 *
 * Maps to QTI 3.0 standard access features:
 * - graphingCalculator (assessment tool)
 * - graph (assessment tool)
 * - periodicTable (assessment tool)
 */

import type {
	ToolRegistration,
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "../../services/ToolRegistry.js";
import type { ToolContext } from "../../services/tool-context.js";
import { hasMathContent, hasScienceContent } from "../../services/tool-context.js";
import {
	createToolElement,
	type ToolComponentOverrides,
} from "../tool-tag-map.js";

/**
 * Graph tool registration
 *
 * Provides graphing calculator and coordinate plane functionality.
 * Context-smart: appears automatically for math content or when explicitly enabled.
 */
export const graphToolRegistration: ToolRegistration = {
	toolId: "graph",
	name: "Graph",
	description: "Graphing calculator and coordinate plane",
	icon: "chart-bar",

	// Graph appears at item and element level where graphing might be needed
	supportedLevels: ["item", "element"],

	// PNP support IDs
	// Maps to QTI 3.0 standard features: graph, graphingCalculator
	pnpSupportIds: [
		"graph", // QTI 3.0 standard (assessment.graph)
		"graphingCalculator", // QTI 3.0 standard (assessment.graphingCalculator)
		"coordinatePlane", // Common variant
		"graphingTool", // Common variant
	],

	/**
	 * Pass 2: Graph is relevant when math content is present
	 */
	isVisibleInContext(context: ToolContext): boolean {
		return hasMathContent(context);
	},

	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		const fullToolId = `${this.toolId}-${toolbarContext.itemId}`;
		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: false,
			ariaLabel: "Graph - Graphing calculator",
			tooltip: "Graph",
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
			visible?: boolean;
			toolId?: string;
			toolkitCoordinator: unknown;
		};
		overlay.setAttribute("tool-id", fullToolId);
		return {
			toolId: this.toolId,
			button,
			overlayElement: overlay,
			sync: () => {
				const active = toolbarContext.isToolVisible(fullToolId);
				button.active = active;
				overlay.visible = active;
				if (toolbarContext.toolkitCoordinator) {
					overlay.toolkitCoordinator = toolbarContext.toolkitCoordinator;
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
 * Periodic Table tool registration
 *
 * Provides chemistry periodic table reference.
 * Context-smart: appears automatically for science content or when explicitly enabled.
 */
export const periodicTableToolRegistration: ToolRegistration = {
	toolId: "periodicTable",
	name: "Periodic Table",
	description: "Chemistry periodic table reference",
	icon: "beaker",

	// Periodic table appears at item and element level
	supportedLevels: ["item", "element"],

	// PNP support IDs
	// Maps to QTI 3.0 standard feature: periodicTable
	pnpSupportIds: [
		"periodicTable", // QTI 3.0 standard (assessment.periodicTable)
		"chemistryReference", // Common variant
		"elementReference", // Common variant
	],

	/**
	 * Pass 2: Periodic table is relevant when science content is present
	 */
	isVisibleInContext(context: ToolContext): boolean {
		return hasScienceContent(context);
	},

	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		const fullToolId = `${this.toolId}-${toolbarContext.itemId}`;
		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: false,
			ariaLabel: "Periodic table - Chemistry reference",
			tooltip: "Periodic Table",
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
			visible?: boolean;
			toolId?: string;
			toolkitCoordinator: unknown;
		};
		overlay.setAttribute("tool-id", fullToolId);
		return {
			toolId: this.toolId,
			button,
			overlayElement: overlay,
			sync: () => {
				const active = toolbarContext.isToolVisible(fullToolId);
				button.active = active;
				overlay.visible = active;
				if (toolbarContext.toolkitCoordinator) {
					overlay.toolkitCoordinator = toolbarContext.toolkitCoordinator;
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
