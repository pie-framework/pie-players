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
import type { ToolProviderConfig } from "../../services/tools-config-normalizer.js";
import type { ToolContext } from "../../services/tool-context.js";
import { hasMathContent } from "../../services/tool-context.js";
import { createScopedToolId } from "../../services/tool-instance-id.js";
import { DesmosToolProvider } from "../../services/tool-providers/index.js";
import { createToolElement } from "../tool-tag-map.js";

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
		const fullToolId = createScopedToolId(
			this.toolId,
			toolbarContext.scope.level,
			toolbarContext.scope.scopeId,
		);
		const componentOverrides = toolbarContext.componentOverrides;
		const overlay = createToolElement(
			this.toolId,
			context,
			toolbarContext,
			componentOverrides,
		) as HTMLElement & {
			visible?: boolean;
			toolId?: string;
			toolkitCoordinator?: unknown;
		};
		overlay.setAttribute("tool-id", fullToolId);
		overlay.toolkitCoordinator = toolbarContext.toolkitCoordinator;
		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: false,
			ariaLabel: "Open scientific calculator",
			tooltip: "Calculator",
			onClick: () => toolbarContext.toggleTool(this.toolId),
			active: toolbarContext.isToolVisible(fullToolId),
		};
		let lastVisibleState: boolean | undefined = button.active;
		overlay.visible = button.active;

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
						initialWidth: 720,
						initialHeight: 620,
						minWidth: 360,
						minHeight: 420,
					},
				},
			],
			button,
			sync: () => {
				const active = toolbarContext.isToolVisible(fullToolId);
				button.active = active;
				button.ariaLabel = active
					? "Close scientific calculator"
					: "Open scientific calculator";
				button.tooltip = active ? "Close calculator" : "Calculator";
				if (lastVisibleState !== active) {
					overlay.visible = active;
					lastVisibleState = active;
				}
				if (overlay.toolkitCoordinator !== toolbarContext.toolkitCoordinator) {
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
