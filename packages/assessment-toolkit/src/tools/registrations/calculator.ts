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
} from "../../services/ToolRegistry";
import type { ToolContext } from "../../services/tool-context";
import { hasMathContent } from "../../services/tool-context";

/**
 * Calculator tool registration
 *
 * Supports:
 * - Basic, scientific, and graphing calculators via Desmos
 * - Context-aware visibility (shows when math content is detected)
 * - All levels except assessment (section, item, passage, rubric, element)
 */
export const calculatorToolRegistration: ToolRegistration = {
	toolId: "calculator",
	name: "Calculator",
	description: "Multi-type calculator (basic, scientific, graphing)",
	icon: "calculator",

	// Calculator can appear at all levels except assessment
	supportedLevels: ["section", "item", "passage", "rubric", "element"],

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
	 * Calculator is relevant when:
	 * - Context contains mathematical content (MathML, LaTeX, arithmetic)
	 * - Section/item level (always show - student might need for any problem)
	 */
	isVisibleInContext(context: ToolContext): boolean {
		// At section/item level, always show (student might need it)
		if (context.level === "section" || context.level === "item") {
			return true;
		}

		// At passage/rubric/element level, show if math content detected
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
				options.ariaLabel || "Open calculator - Press to activate calculator tool",
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
		// Create calculator web component
		const calculator = document.createElement(
			"pie-tool-calculator",
		) as HTMLElement & {
			visible: boolean;
			calculatorType: string;
			availableTypes: string[];
			toolkitCoordinator: unknown;
		};

		// Set default calculator type (can be overridden via config)
		const calculatorType =
			(options.config?.calculatorType as string) || "scientific";
		const availableTypes =
			(options.config?.availableTypes as string[]) || [
				"basic",
				"scientific",
				"graphing",
			];

		// Configure calculator
		calculator.visible = true;
		calculator.calculatorType = calculatorType;
		calculator.availableTypes = availableTypes;

		// Pass toolkit coordinator if available from context
		if (options.config?.toolkitCoordinator) {
			calculator.toolkitCoordinator = options.config.toolkitCoordinator;
		}

		// Handle close callback
		if (options.onClose) {
			calculator.addEventListener("close", options.onClose);
		}

		return calculator;
	},
};
