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
} from "../../services/ToolRegistry.js";
import type { ToolContext } from "../../services/tool-context.js";
import { hasMathContent } from "../../services/tool-context.js";
import { createScopedToolId } from "../../services/tool-instance-id.js";
import {
	createToolElement,
	type ToolComponentOverrides,
} from "../tool-tag-map.js";

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
	icon: "ruler",

	// Ruler typically appears at item/element level
	supportedLevels: ["item", "element"],

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
			ariaLabel: "Open ruler tool",
			tooltip: "Ruler",
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
 * Protractor tool registration
 *
 * Provides an on-screen protractor for measuring angles.
 * Typically appears on geometry problems.
 */
export const protractorToolRegistration: ToolRegistration = {
	toolId: "protractor",
	name: "Protractor",
	description: "On-screen protractor for angle measurements",
	icon: "protractor",

	// Protractor typically appears at item/element level
	supportedLevels: ["item", "element"],

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
			ariaLabel: "Open protractor tool",
			tooltip: "Protractor",
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
