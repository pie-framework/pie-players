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
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import type { ToolContext } from "@pie-players/pie-assessment-toolkit/tools/internal";
import {
	hasMathContent,
	hasScienceContent,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import { resolveToolRegistrationName } from "@pie-players/pie-assessment-toolkit/tools/internal";
import {
	createToolElement,
	type ToolComponentOverrides,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import {
	createScopedVisibilityBinding,
	syncButtonAndOverlayVisibility,
} from "@pie-players/pie-assessment-toolkit/tools/internal";

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
	nameKey: "tools.graph.name",
	descriptionKey: "tools.graph.description",
	icon: "chart-bar",

	// Graph is a section-level floating tool.
	supportedLevels: ["section"],

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
		const visibility = createScopedVisibilityBinding(
			this.toolId,
			toolbarContext,
		);
		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: false,
			ariaLabel: toolbarContext.i18n.t("tools.graph.buttonA11y"),
			tooltip: toolbarContext.i18n.t("tools.graph.tooltip"),
			onClick: () => toolbarContext.toggleTool(this.toolId),
			active: visibility.isActive(),
		};
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
		};
		overlay.setAttribute("tool-id", visibility.fullToolId);
		return {
			toolId: this.toolId,
			button,
			elements: [
				{
					element: overlay,
					mount: "after-buttons",
					shell: {
						title: resolveToolRegistrationName(this, toolbarContext.i18n),
						draggable: true,
						resizable: true,
						closeable: true,
						initialWidth: 920,
						initialHeight: 680,
						minWidth: 640,
						minHeight: 500,
					},
				},
			],
			sync: () => {
				syncButtonAndOverlayVisibility({
					button,
					overlay,
					isActive: visibility.isActive,
				});
			},
			subscribeActive: visibility.subscribeActive,
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
	nameKey: "tools.periodicTable.name",
	descriptionKey: "tools.periodicTable.description",
	icon: "beaker",

	// Periodic table is a section-level floating tool.
	supportedLevels: ["section"],

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
		const visibility = createScopedVisibilityBinding(
			this.toolId,
			toolbarContext,
		);
		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: false,
			ariaLabel: toolbarContext.i18n.t(
				"tools.periodicTable.buttonA11y",
			),
			tooltip: toolbarContext.i18n.t("tools.periodicTable.tooltip"),
			onClick: () => toolbarContext.toggleTool(this.toolId),
			active: visibility.isActive(),
		};
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
		};
		overlay.setAttribute("tool-id", visibility.fullToolId);
		return {
			toolId: this.toolId,
			button,
			elements: [
				{
					element: overlay,
					mount: "after-buttons",
					shell: {
						title: resolveToolRegistrationName(this, toolbarContext.i18n),
						draggable: true,
						resizable: true,
						closeable: true,
						initialWidth: 1160,
						initialHeight: 760,
						minWidth: 920,
						minHeight: 620,
					},
				},
			],
			sync: () => {
				syncButtonAndOverlayVisibility({
					button,
					overlay,
					isActive: visibility.isActive,
				});
			},
			subscribeActive: visibility.subscribeActive,
		};
	},
};
