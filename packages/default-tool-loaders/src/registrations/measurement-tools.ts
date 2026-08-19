/**
 * Measurement Tools Registrations
 *
 * Registers ruler and protractor tools for on-screen measurements.
 *
 * Maps to QTI 3.0 standard access features:
 * - ruler (assessment tool)
 * - protractor (assessment tool)
 */

import type {
	ToolRegistration,
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import type { ToolContext } from "@pie-players/pie-assessment-toolkit/tools/internal";
import { hasMathContent } from "@pie-players/pie-assessment-toolkit/tools/internal";
import {
	createToolElement,
	type ToolComponentOverrides,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import {
	applyOverlaySurface,
	createScopedVisibilityBinding,
	syncButtonAndOverlayVisibility,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import { renderOverlayToolbar } from "./overlay-toolbar-render.js";

/**
 * Ruler tool registration
 *
 * Provides an on-screen ruler for measuring lengths.
 * Typically appears on geometry or measurement problems.
 */
export const rulerToolRegistration: ToolRegistration = {
	toolId: "ruler",
	name: "Ruler",
	description: "On-screen ruler for measurements",
	nameKey: "tools.ruler.name",
	descriptionKey: "tools.ruler.description",
	icon: "ruler",

	// Ruler typically appears at section/item/element level
	supportedLevels: ["section", "item", "element"],

	// PNP support IDs
	// Maps to QTI 3.0 standard feature: ruler
	pnpSupportIds: [
		"ruler", // QTI 3.0 standard (assessment.ruler)
		"measurement", // Common variant
	],

	/**
	 * Pass 2: Ruler is relevant when math content is present
	 */
	isVisibleInContext(context: ToolContext): boolean {
		return hasMathContent(context);
	},

	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		return renderOverlayToolbar(this, context, toolbarContext, {
			surface: "frameless",
			handsOverCoordinator: true,
		});
	},
};

/**
 * Protractor tool registration
 *
 * Provides an on-screen protractor for measuring angles.
 * Typically appears on geometry problems.
 */
export const protractorToolRegistration: ToolRegistration = {
	toolId: "protractor",
	name: "Protractor",
	description: "On-screen protractor for angle measurements",
	nameKey: "tools.protractor.name",
	descriptionKey: "tools.protractor.description",
	icon: "protractor",

	// Protractor typically appears at section/item/element level
	supportedLevels: ["section", "item", "element"],

	// PNP support IDs
	// Maps to QTI 3.0 standard feature: protractor
	pnpSupportIds: [
		"protractor", // QTI 3.0 standard (assessment.protractor)
		"angleMeasurement", // Common variant
	],

	/**
	 * Pass 2: Protractor is relevant when math content is present
	 */
	isVisibleInContext(context: ToolContext): boolean {
		return hasMathContent(context);
	},

	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		return renderOverlayToolbar(this, context, toolbarContext, {
			surface: "frameless",
			handsOverCoordinator: true,
		});
	},
};
