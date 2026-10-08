/**
 * Subject-Specific Tools Registrations
 *
 * Registers tools for specific subject areas:
 * - Graph (coordinate plane)
 * - Periodic Table (chemistry reference)
 */

import type {
	ToolRegistration,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import type { ToolContext } from "@pie-players/pie-assessment-toolkit/tools/internal";
import {
	hasMathContent,
	hasScienceContent,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import { renderOverlayToolbar } from "./overlay-toolbar-render.js";

/**
 * Graph tool registration
 *
 * Provides a coordinate plane.
 * Context-smart: appears automatically for math content or when explicitly enabled.
 */
export const graphToolRegistration: ToolRegistration = {
	toolId: "graph",
	name: "Graph",
	description: "Coordinate plane",
	nameKey: "tools.graph.name",
	descriptionKey: "tools.graph.description",
	icon: "chart-bar",

	// A floating tool, placed on a section toolbar or on an item toolbar where
	// the toolkit runs without a section.
	supportedLevels: ["section", "item"],

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
		return renderOverlayToolbar(this, context, toolbarContext, {
			shell: {
				resizable: true,
				initialWidth: 920,
				initialHeight: 680,
				minWidth: 640,
				minHeight: 500,
			},
		});
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

	// A floating tool, placed on a section toolbar or on an item toolbar where
	// the toolkit runs without a section.
	supportedLevels: ["section", "item"],

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
		return renderOverlayToolbar(this, context, toolbarContext, {
			shell: {
				resizable: true,
				initialWidth: 1160,
				initialHeight: 760,
				minWidth: 920,
				minHeight: 620,
			},
		});
	},
};
