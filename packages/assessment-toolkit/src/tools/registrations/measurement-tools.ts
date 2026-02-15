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
	ToolButtonDefinition,
	ToolButtonOptions,
	ToolInstanceOptions,
} from "../../services/ToolRegistry";
import type { ToolContext } from "../../services/tool-context";
import { hasMathContent } from "../../services/tool-context";
import {
	createToolElement,
	type ToolComponentOverrides,
} from "../tool-tag-map";

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

	createButton(
		context: ToolContext,
		options: ToolButtonOptions,
	): ToolButtonDefinition {
		return {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: options.disabled || false,
			ariaLabel: options.ariaLabel || "Open ruler tool",
			tooltip: options.tooltip || "Ruler",
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
		const ruler = createToolElement(
			this.toolId,
			context,
			options,
			componentOverrides,
		) as HTMLElement & {
			visible: boolean;
			toolkitCoordinator: unknown;
		};

		ruler.visible = true;

		if (options.config?.toolkitCoordinator) {
			ruler.toolkitCoordinator = options.config.toolkitCoordinator;
		}

		if (options.onClose) {
			ruler.addEventListener("close", options.onClose);
		}

		return ruler;
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

	createButton(
		context: ToolContext,
		options: ToolButtonOptions,
	): ToolButtonDefinition {
		return {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: options.disabled || false,
			ariaLabel: options.ariaLabel || "Open protractor tool",
			tooltip: options.tooltip || "Protractor",
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
		const protractor = createToolElement(
			this.toolId,
			context,
			options,
			componentOverrides,
		) as HTMLElement & {
			visible: boolean;
			toolkitCoordinator: unknown;
		};

		protractor.visible = true;

		if (options.config?.toolkitCoordinator) {
			protractor.toolkitCoordinator = options.config.toolkitCoordinator;
		}

		if (options.onClose) {
			protractor.addEventListener("close", options.onClose);
		}

		return protractor;
	},
};
