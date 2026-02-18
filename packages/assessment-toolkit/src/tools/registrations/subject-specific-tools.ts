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
	ToolButtonDefinition,
	ToolButtonOptions,
	ToolInstanceOptions,
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

	createButton(
		context: ToolContext,
		options: ToolButtonOptions,
	): ToolButtonDefinition {
		return {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: options.disabled || false,
			ariaLabel: options.ariaLabel || "Graph - Graphing calculator",
			tooltip: options.tooltip || "Graph",
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
		const graph = createToolElement(
			this.toolId,
			context,
			options,
			componentOverrides,
		) as HTMLElement & {
			visible: boolean;
			toolkitCoordinator: unknown;
		};

		graph.visible = true;

		if (options.config?.toolkitCoordinator) {
			graph.toolkitCoordinator = options.config.toolkitCoordinator;
		}

		if (options.onClose) {
			graph.addEventListener("close", options.onClose);
		}

		return graph;
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

	createButton(
		context: ToolContext,
		options: ToolButtonOptions,
	): ToolButtonDefinition {
		return {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: options.disabled || false,
			ariaLabel: options.ariaLabel || "Periodic table - Chemistry reference",
			tooltip: options.tooltip || "Periodic Table",
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
		const periodicTable = createToolElement(
			this.toolId,
			context,
			options,
			componentOverrides,
		) as HTMLElement & {
			visible: boolean;
			toolkitCoordinator: unknown;
		};

		periodicTable.visible = true;

		if (options.config?.toolkitCoordinator) {
			periodicTable.toolkitCoordinator = options.config.toolkitCoordinator;
		}

		if (options.onClose) {
			periodicTable.addEventListener("close", options.onClose);
		}

		return periodicTable;
	},
};
