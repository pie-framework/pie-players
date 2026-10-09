/**
 * Calculator Tool Registration
 *
 * Registers the calculator tool with support for multiple calculator types
 * (basic, scientific, graphing) through a host-selected provider.
 */

import type {
	ToolRegistration,
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "@pie-players/pie-assessment-toolkit/tools/registration";
import type { ToolProviderConfig } from "@pie-players/pie-assessment-toolkit/tools/registration";
import type { ToolContext } from "@pie-players/pie-assessment-toolkit/tools/registration";
import type { MessageKey } from "@pie-players/pie-players-shared/i18n/types";
import { hasMathContent } from "@pie-players/pie-assessment-toolkit/tools/registration";
import { createScopedToolId } from "@pie-players/pie-assessment-toolkit/tools/registration";
import { createToolElement } from "@pie-players/pie-assessment-toolkit/tools/registration";
import type { CalculatorProviderConfig } from "@pie-players/pie-calculator";
import { CortexToolProvider } from "../calculator-providers/CortexToolProvider.js";
import { DesmosToolProvider } from "../calculator-providers/DesmosToolProvider.js";
import { GeoGebraToolProvider } from "../calculator-providers/GeoGebraToolProvider.js";
import { resolveOverlayElement } from "./overlay-element-cache.js";

type CalculatorType = "basic" | "scientific" | "graphing";
export type CalculatorProviderId =
	| "calculator-desmos"
	| "calculator-geogebra"
	| "calculator-cortex";
export const DEFAULT_CALCULATOR_PROVIDER_ID: CalculatorProviderId =
	"calculator-desmos";

export function resolveCalculatorProviderId(
	config: ToolProviderConfig | undefined,
): CalculatorProviderId {
	const configured = config?.provider?.id;
	if (configured === undefined || configured === "") {
		return DEFAULT_CALCULATOR_PROVIDER_ID;
	}
	if (
		configured === "calculator-desmos" ||
		configured === "calculator-geogebra" ||
		configured === "calculator-cortex"
	) {
		return configured;
	}
	throw new Error(
		`Unsupported calculator provider "${String(configured)}". Expected "calculator-desmos", "calculator-geogebra", or "calculator-cortex".`,
	);
}

function createCalculatorToolProvider(config: ToolProviderConfig | undefined) {
	switch (resolveCalculatorProviderId(config)) {
		case "calculator-cortex":
			return new CortexToolProvider();
		case "calculator-geogebra":
			return new GeoGebraToolProvider();
		default:
			return new DesmosToolProvider();
	}
}

function getCalculatorInstanceConfig(
	config: ToolProviderConfig | undefined,
): CalculatorProviderConfig {
	const theme = config?.theme;
	return {
		settings:
			config?.settings && typeof config.settings === "object"
				? { ...config.settings }
				: {},
		restrictedMode: config?.restrictedMode === true,
		locale: typeof config?.locale === "string" ? config.locale : undefined,
		theme:
			theme === "light" || theme === "dark" || theme === "auto"
				? theme
				: undefined,
	};
}

function normalizeCalculatorType(value: unknown): CalculatorType | null {
	return value === "basic" || value === "scientific" || value === "graphing"
		? value
		: null;
}

function getCalculatorRenderParams(toolbarContext: ToolbarContext): {
	calculatorType: CalculatorType | null;
	availableTypes: CalculatorType[] | null;
	displayName: string;
} {
	const params = toolbarContext.getToolRenderParams?.("calculator") ?? {};
	// A host resolver or a request names the type; the policy parameters'
	// `type` is the default beneath both.
	const calculatorType =
		normalizeCalculatorType(params.calculatorType) ??
		normalizeCalculatorType(
			toolbarContext.getToolParameters?.("calculator")?.type,
		);
	const availableTypesRaw = params.availableTypes;
	const availableTypes = Array.isArray(availableTypesRaw)
		? availableTypesRaw
				.map((value) => normalizeCalculatorType(value))
				.filter((value): value is CalculatorType => value !== null)
		: calculatorType
			? [calculatorType]
			: null;

	return {
		calculatorType,
		availableTypes,
		displayName: toolbarContext.i18n.t(
			CALCULATOR_NAME_KEYS[calculatorType ?? "untyped"],
		),
	};
}

/**
 * The calculator's displayed name, per host-declared type.
 *
 * `untyped` keeps the pre-adoption behaviour of naming the scientific
 * calculator, which is what the toolbar has always announced when the host
 * declares no type.
 */
const CALCULATOR_NAME_KEYS: Record<CalculatorType | "untyped", MessageKey> = {
	basic: "tools.calculator.nameBasic",
	scientific: "tools.calculator.nameScientific",
	graphing: "tools.calculator.nameGraphing",
	untyped: "tools.calculator.name",
};

function applyCalculatorParamsToElement(
	element: HTMLElement,
	calculatorType: CalculatorType | null,
	availableTypes: CalculatorType[] | null,
	calculatorConfig: CalculatorProviderConfig,
): void {
	const calculatorElement = element as HTMLElement & {
		calculatorType?: CalculatorType;
		availableTypes?: CalculatorType[];
		calculatorConfig?: CalculatorProviderConfig;
	};
	calculatorElement.calculatorConfig = calculatorConfig;

	if (calculatorType) {
		calculatorElement.calculatorType = calculatorType;
		element.setAttribute("calculator-type", calculatorType);
	} else {
		delete calculatorElement.calculatorType;
		element.removeAttribute("calculator-type");
	}

	if (availableTypes && availableTypes.length > 0) {
		calculatorElement.availableTypes = availableTypes;
	} else {
		delete calculatorElement.availableTypes;
	}
}

/**
 * Calculator tool registration
 *
 * Supports:
 * - Basic, scientific, and graphing calculators through Desmos, GeoGebra, or Cortex
 * - Context-aware visibility (shows only when math content is detected)
 * - Item level only
 */
export const calculatorToolRegistration: ToolRegistration = {
	toolId: "calculator",
	name: "Calculator",
	description: "Multi-type calculator (basic, scientific, graphing)",
	nameKey: "tools.calculator.name",
	descriptionKey: "tools.calculator.description",
	icon: "calculator",
	provider: {
		createProvider: createCalculatorToolProvider,
		getInitConfig: (config: ToolProviderConfig | undefined) =>
			config?.provider?.init ?? {},
		getAuthFetcher: (config: ToolProviderConfig | undefined) => {
			const runtimeAuthFetcher = config?.provider?.runtime?.authFetcher;
			return typeof runtimeAuthFetcher === "function"
				? runtimeAuthFetcher
				: undefined;
		},
		lazy: true,
	},

	// Calculator is item-level in this player architecture.
	supportedLevels: ["item"],

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
		const { calculatorType, availableTypes, displayName } =
			getCalculatorRenderParams(toolbarContext);
		const calculatorToolConfig =
			toolbarContext.toolkitCoordinator?.getToolConfig(this.toolId) ||
			undefined;
		const calculatorConfig = getCalculatorInstanceConfig(calculatorToolConfig);
		const fullToolId = createScopedToolId(
			this.toolId,
			toolbarContext.scope.level,
			toolbarContext.scope.scopeId,
		);
		const componentOverrides = toolbarContext.componentOverrides;
		// Reused across renders: besides keeping state, this spares a Desmos boot
		// and container mount on every re-render.
		const overlay = resolveOverlayElement(
			toolbarContext,
			fullToolId,
			() =>
				createToolElement(
					this.toolId,
					context,
					toolbarContext,
					componentOverrides,
				) as HTMLElement & {
					visible?: boolean;
					toolId?: string;
				},
		);
		overlay.setAttribute("tool-id", fullToolId);
		applyCalculatorParamsToElement(
			overlay,
			calculatorType,
			availableTypes,
			calculatorConfig,
		);

		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: displayName,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			// Routes this button through <nds-icon-button> where the host enables NDS
			// icons. Declared here because which capabilities render in the host's
			// design system is a composition decision; the toolbar used to map it from
			// the `calculator` toolId, which put a capability name in the generic core.
			faIconName: "calculator",
			disabled: false,
			// The name stays put across open and closed. The toolbar mirrors
			// `active` onto the button as `aria-pressed`, so the state is already
			// exposed; a name that also swapped to "Close …" would contradict it.
			ariaLabel: displayName,
			tooltip: displayName,
			onClick: () => toolbarContext.toggleTool(this.toolId),
			active: toolbarContext.isToolVisible(this.toolId),
		};
		let lastVisibleState: boolean | undefined = button.active;
		if (overlay.visible !== button.active) {
			overlay.visible = button.active;
		}

		return {
			toolId: this.toolId,
			elements: [
				{
					element: overlay,
					mount: "after-buttons",
					shell: {
						// The variant name the button already carries — "Basic Calculator",
						// not the registration's generic one.
						title: displayName,
						draggable: true,
						resizable: true,
						closeable: true,
						/*
						 * Sized per type from what each layout measures, rather than one
						 * size for all three. A shell subtracts ~74px of header from the
						 * height it is given, and the numbers below are the content each
						 * type needs plus room for its history tape:
						 *
						 * - basic: strip, display, edit row and a four-row keypad measure
						 *   398px. 560 left ~90px of blank above the entry line, which is
						 *   the gap that made the panel look mis-sized.
						 * - scientific: the same plus a keypad layer tab row.
						 * - graphing: the expression rail beside the plot, whose column
						 *   wants 486px on its own — viewport controls, a 14rem board floor
						 *   and the readout that *is* the graph for assistive technology,
						 *   since the board itself is `aria-hidden`. At 620 that column was
						 *   12px short and the readout's last line was cut off.
						 *
						 * The minimums stay shared across types and providers. This
						 * registration serves Desmos, GeoGebra and Cortex alike, so a
						 * graphing-only floor would move the resize limit under two vendors
						 * whose layouts were never measured for it. Cortex below 42rem
						 * stacks the rail above the plot and needs 701px there, which no
						 * spacing tier closes — it scrolls its own content instead of
						 * clipping it, which is the contract every size below the opening
						 * one already relies on.
						 */
						initialWidth: calculatorType === "graphing" ? 720 : 380,
						initialHeight:
							calculatorType === "graphing"
								? 660
								: calculatorType === "basic"
									? 500
									: 560,
						minWidth: 380,
						minHeight: 480,
						/*
						 * `bottom-right` put a 560-620px-tall shell over the items
						 * column it shares the viewport with — tall enough, at
						 * ordinary viewport heights, to sit on top of a sibling
						 * item's own toolbar row and block its button from mouse
						 * and touch input. `bottom-left` keeps the same footprint
						 * over the passage column instead, which carries no
						 * per-item controls to collide with.
						 */
						initialAlign: "bottom-left",
						initialMargin: 16,
						// Header controls in the host's design system, and the layout that
						// goes with them.
						ndsHeaderControls: true,
						// A learner reads the question while using the calculator, so Tab and
						// Shift+Tab cross between the page and the shell instead of cycling
						// inside it.
						pageTabOrder: true,
						content: {
							overflowY: "auto",
							preserveMinHeight: true,
						},
					},
				},
			],
			button,
			sync: () => {
				const active = toolbarContext.isToolVisible(this.toolId);
				button.active = active;
				button.label = displayName;
				// Static across the toggle. The previous `Close ${name.toLowerCase()}`
				// was a hardcoded English template built by lowercasing a localized
				// noun — "Close rekenmachine" under nl-NL — and it is the state
				// `aria-pressed` already carries.
				button.ariaLabel = displayName;
				button.tooltip = displayName;
				if (lastVisibleState !== active) {
					overlay.visible = active;
					lastVisibleState = active;
				}
				applyCalculatorParamsToElement(
					overlay,
					calculatorType,
					availableTypes,
					calculatorConfig,
				);
			},
			subscribeActive: (callback: (active: boolean) => void) => {
				if (!toolbarContext.subscribeVisibility) return () => {};
				return toolbarContext.subscribeVisibility(() => {
					callback(toolbarContext.isToolVisible(this.toolId));
				});
			},
		};
	},
};
