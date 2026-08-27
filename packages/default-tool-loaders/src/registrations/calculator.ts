/**
 * Calculator Tool Registration
 *
 * Registers the calculator tool with support for multiple calculator types
 * (basic, scientific, graphing) through a host-selected provider.
 *
 * Maps to QTI 3.0 standard access features:
 * - calculator (cognitive support)
 * - graphingCalculator (assessment tool)
 */

import type {
	ToolRegistration,
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import type { ToolCoordinatorApi } from "@pie-players/pie-assessment-toolkit/tools/internal";
import type { ToolProviderConfig } from "@pie-players/pie-assessment-toolkit/tools/internal";
import type { ToolContext } from "@pie-players/pie-assessment-toolkit/tools/internal";
import type { MessageKey } from "@pie-players/pie-players-shared/i18n/types";
import { hasMathContent } from "@pie-players/pie-assessment-toolkit/tools/internal";
import { createScopedToolId } from "@pie-players/pie-assessment-toolkit/tools/internal";
import { DesmosToolProvider } from "@pie-players/pie-assessment-toolkit/tools/internal";
import { CortexToolProvider } from "@pie-players/pie-assessment-toolkit/tools/internal";
import { GeoGebraToolProvider } from "@pie-players/pie-assessment-toolkit/tools/internal";
import { createToolElement } from "@pie-players/pie-assessment-toolkit/tools/internal";
import type { CalculatorProviderConfig } from "@pie-players/pie-assessment-toolkit/tools/client";

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

// The toolbar parent re-derives `renderedTools` whenever item state changes
// (e.g. the learner answers a question and `effectiveItem`/`renderContext`
// recompute). Calculator initialization is expensive (Desmos boot, container
// mount), so we cache the overlay element by coordinator + scoped tool id.
// Reusing the same element keeps `mountContent` a no-op and avoids tearing
// down and re-initializing the calculator on every re-render.
const overlayElementCache = new WeakMap<
	ToolCoordinatorApi,
	Map<string, HTMLElement>
>();

function getCachedOverlay(
	coordinator: ToolCoordinatorApi | null,
	fullToolId: string,
): HTMLElement | null {
	if (!coordinator) return null;
	const scoped = overlayElementCache.get(coordinator);
	const element = scoped?.get(fullToolId);
	if (!element) return null;
	// Svelte custom elements destroy their component when disconnected.
	// A detached cached element is a dead instance — drop it and recreate.
	if (!element.isConnected) {
		scoped?.delete(fullToolId);
		return null;
	}
	return element;
}

function setCachedOverlay(
	coordinator: ToolCoordinatorApi | null,
	fullToolId: string,
	element: HTMLElement,
): void {
	if (!coordinator) return;
	let scoped = overlayElementCache.get(coordinator);
	if (!scoped) {
		scoped = new Map();
		overlayElementCache.set(coordinator, scoped);
	}
	scoped.set(fullToolId, element);
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
	const calculatorType = normalizeCalculatorType(params.calculatorType);
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
	providerId: CalculatorProviderId,
	calculatorConfig: CalculatorProviderConfig,
): void {
	const calculatorElement = element as HTMLElement & {
		calculatorType?: CalculatorType;
		availableTypes?: CalculatorType[];
		providerId?: CalculatorProviderId;
		calculatorConfig?: CalculatorProviderConfig;
	};
	calculatorElement.providerId = providerId;
	calculatorElement.calculatorConfig = calculatorConfig;
	element.setAttribute("provider-id", providerId);

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
		getProviderId: resolveCalculatorProviderId,
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

	// PNP support IDs that enable this tool
	// Maps to QTI 3.0 standard features: calculator, graphingCalculator
	// A type is not a feature id: `calculatorType` arrives through the host's
	// render params, so `basicCalculator` / `scientificCalculator` granted the
	// same untyped calculator these two do and only looked like they selected a
	// variant.
	pnpSupportIds: [
		"calculator", // QTI 3.0 standard (cognitive.calculator)
		"graphingCalculator", // QTI 3.0 standard (assessment.graphingCalculator)
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

	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		const { calculatorType, availableTypes, displayName } =
			getCalculatorRenderParams(toolbarContext);
		const calculatorToolConfig =
			toolbarContext.toolkitCoordinator?.config.tools?.providers?.calculator;
		const providerId = resolveCalculatorProviderId(calculatorToolConfig);
		const calculatorConfig = getCalculatorInstanceConfig(calculatorToolConfig);
		const fullToolId = createScopedToolId(
			this.toolId,
			toolbarContext.scope.level,
			toolbarContext.scope.scopeId,
		);
		const componentOverrides = toolbarContext.componentOverrides;
		const cachedOverlay = getCachedOverlay(
			toolbarContext.toolCoordinator,
			fullToolId,
		);
		const overlay = (cachedOverlay ??
			createToolElement(
				this.toolId,
				context,
				toolbarContext,
				componentOverrides,
			)) as HTMLElement & {
			visible?: boolean;
			toolId?: string;
			toolkitCoordinator?: unknown;
		};
		if (!cachedOverlay) {
			setCachedOverlay(toolbarContext.toolCoordinator, fullToolId, overlay);
		}
		overlay.setAttribute("tool-id", fullToolId);
		overlay.toolkitCoordinator = toolbarContext.toolkitCoordinator;
		applyCalculatorParamsToElement(
			overlay,
			calculatorType,
			availableTypes,
			providerId,
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
			active: toolbarContext.isToolVisible(fullToolId),
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
						 * Sized to hold a display and a keypad. 420px of height was chosen
						 * when the Cortex calculator was a text field and three buttons; a
						 * keypad needs about 210px of that on its own, and at 420 the keys
						 * fell past the content box, which the shell clips rather than
						 * scrolls sideways. Graphing additionally needs the width its rail
						 * and plot both want — below that the calculator stacks them, which
						 * works but leaves the plot small.
						 *
						 * `minWidth` stays 380: the keypad is five columns at ~66px, which is
						 * exactly what fits there, and the shell's own reflow contract
						 * (`applyContentMinWidth`) pans below that rather than reflowing.
						 */
						initialWidth: calculatorType === "graphing" ? 720 : 380,
						initialHeight: calculatorType === "graphing" ? 620 : 560,
						minWidth: 380,
						minHeight: 480,
						initialAlign: "bottom-right",
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
				const active = toolbarContext.isToolVisible(fullToolId);
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
				if (overlay.toolkitCoordinator !== toolbarContext.toolkitCoordinator) {
					overlay.toolkitCoordinator = toolbarContext.toolkitCoordinator;
				}
				applyCalculatorParamsToElement(
					overlay,
					calculatorType,
					availableTypes,
					providerId,
					calculatorConfig,
				);
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
