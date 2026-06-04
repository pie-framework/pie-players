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
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "../../services/ToolRegistry.js";
import type { ToolCoordinatorApi } from "../../services/interfaces.js";
import type { ToolProviderConfig } from "../../services/tools-config-normalizer.js";
import type { ToolContext } from "../../services/tool-context.js";
import { hasMathContent } from "../../services/tool-context.js";
import { createScopedToolId } from "../../services/tool-instance-id.js";
import { DesmosToolProvider } from "../../services/tool-providers/index.js";
import { createToolElement } from "../tool-tag-map.js";

type CalculatorType = "basic" | "scientific";

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
	return value === "basic" || value === "scientific" ? value : null;
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
		displayName:
			calculatorType === "scientific"
				? "Scientific Calculator"
				: calculatorType === "basic"
					? "Basic Calculator"
					: "Calculator",
	};
}

function applyCalculatorParamsToElement(
	element: HTMLElement,
	calculatorType: CalculatorType | null,
	availableTypes: CalculatorType[] | null,
): void {
	const calculatorElement = element as HTMLElement & {
		calculatorType?: CalculatorType;
		availableTypes?: CalculatorType[];
	};

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
 * - Basic, scientific, and graphing calculators via Desmos
 * - Context-aware visibility (shows only when math content is detected)
 * - Item level only
 */
export const calculatorToolRegistration: ToolRegistration = {
	toolId: "calculator",
	name: "Calculator",
	description: "Multi-type calculator (basic, scientific, graphing)",
	icon: "calculator",
	provider: {
		getProviderId: (config: ToolProviderConfig | undefined) =>
			typeof config?.provider?.id === "string" && config.provider.id.length > 0
				? config.provider.id
				: "calculator-desmos",
		createProvider: () => new DesmosToolProvider(),
		getInitConfig: (config: ToolProviderConfig | undefined) =>
			config?.provider?.init ?? {},
		getAuthFetcher: (config: ToolProviderConfig | undefined) => {
			const runtimeAuthFetcher = config?.provider?.runtime?.authFetcher;
			if (typeof runtimeAuthFetcher === "function") return runtimeAuthFetcher;
			return async () => {
				const response = await fetch("/api/tools/desmos/auth", {
					method: "GET",
					credentials: "same-origin",
				});
				if (!response.ok) {
					throw new Error(
						`Failed to fetch Desmos auth config (${response.status})`,
					);
				}
				return (await response.json()) as Record<string, unknown>;
			};
		},
		lazy: true,
	},

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

	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		const { calculatorType, availableTypes, displayName } =
			getCalculatorRenderParams(toolbarContext);
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
		applyCalculatorParamsToElement(overlay, calculatorType, availableTypes);
		const openLabel =
			calculatorType === null
				? "Open scientific calculator"
				: `Open ${displayName.toLowerCase()}`;
		const closeLabel =
			calculatorType === null
				? "Close scientific calculator"
				: `Close ${displayName.toLowerCase()}`;
		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: displayName,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: false,
			ariaLabel: openLabel,
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
						title: this.name,
						draggable: true,
						resizable: true,
						closeable: true,
						initialWidth: 380,
						initialHeight: 420,
						minWidth: 380,
						minHeight: 420,
						initialAlign: "bottom-right",
						initialMargin: 16,
					},
				},
			],
			button,
			sync: () => {
				const active = toolbarContext.isToolVisible(fullToolId);
				button.active = active;
				button.label = displayName;
				button.ariaLabel = active ? closeLabel : openLabel;
				button.tooltip = active
					? `Close ${displayName.toLowerCase()}`
					: displayName;
				if (lastVisibleState !== active) {
					overlay.visible = active;
					lastVisibleState = active;
				}
				if (overlay.toolkitCoordinator !== toolbarContext.toolkitCoordinator) {
					overlay.toolkitCoordinator = toolbarContext.toolkitCoordinator;
				}
				applyCalculatorParamsToElement(overlay, calculatorType, availableTypes);
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
