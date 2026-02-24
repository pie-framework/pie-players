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
	ToolButtonDefinition,
	ToolButtonOptions,
	ToolInstanceOptions,
} from "../../services/ToolRegistry.js";
import type { ToolContext } from "../../services/tool-context.js";
import { hasMathContent } from "../../services/tool-context.js";
import {
	createToolElement,
	type ToolComponentOverrides,
} from "../tool-tag-map.js";

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

	/**
	 * Create calculator button for toolbar
	 */
	createButton(
		context: ToolContext,
		options: ToolButtonOptions,
	): ToolButtonDefinition {
		const icon =
			typeof this.icon === "function" ? this.icon(context) : this.icon;

		return {
			toolId: this.toolId,
			label: this.name,
			icon: icon,
			disabled: options.disabled || false,
			ariaLabel:
				options.ariaLabel ||
				"Open calculator - Press to activate calculator tool",
			tooltip: options.tooltip || "Calculator",
			onClick: options.onClick || (() => {}),
			className: options.className,
		};
	},

	/**
	 * Create calculator tool instance
	 *
	 * Creates a <pie-tool-calculator> web component and initializes it.
	 */
	createToolInstance(
		context: ToolContext,
		options: ToolInstanceOptions,
	): HTMLElement {
		const componentOverrides =
			(options.config as ToolComponentOverrides | undefined) ?? {};
		const calculator = createToolElement(
			this.toolId,
			context,
			options,
			componentOverrides,
		) as HTMLElement & {
			visible: boolean;
			calculatorType: string;
			availableTypes: string[];
			toolkitCoordinator: unknown;
		};

		// Set default calculator type (can be overridden via config)
		const calculatorType =
			(options.config?.calculatorType as string) || "scientific";
		const availableTypes = (options.config?.availableTypes as string[]) || [
			"basic",
			"scientific",
			"graphing",
		];

		// Configure calculator
		calculator.visible = true;
		calculator.calculatorType = calculatorType;
		calculator.availableTypes = availableTypes;

		const toolkitCoordinator = options.config?.toolkitCoordinator;
		if (!toolkitCoordinator) {
			throw new Error(
				"[calculatorToolRegistration] toolkitCoordinator is required in ToolInstanceOptions.config",
			);
		}
		calculator.toolkitCoordinator = toolkitCoordinator;

		// Handle close callback
		if (options.onClose) {
			calculator.addEventListener("close", options.onClose);
		}

		return calculator;
	},
};
