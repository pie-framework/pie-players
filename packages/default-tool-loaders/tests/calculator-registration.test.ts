import { describe, expect, test } from "bun:test";
import { calculatorToolRegistration } from "../src/registrations/calculator.js";
import {
	DEFAULT_CALCULATOR_PROVIDER_ID,
	resolveCalculatorProviderId,
} from "../src/registrations/calculator.js";
import { PACKAGED_TOOL_TAG_MAP } from "../src/packaged-capability-composition.js";
import type { ToolContext } from "@pie-players/pie-assessment-toolkit/tools/registration";
import type { ToolbarContext } from "@pie-players/pie-assessment-toolkit/tools/registration";
import { resolveInterfaceI18n } from "@pie-players/pie-players-shared/i18n/provider";

const createFakeElement = (tag: string) =>
	({
		tagName: tag.toUpperCase(),
		attrs: new Map<string, string>(),
		setAttribute(name: string, value: string) {
			this.attrs.set(name, value);
		},
		removeAttribute(name: string) {
			this.attrs.delete(name);
		},
		getAttribute(name: string) {
			return this.attrs.get(name) || null;
		},
	}) as any;

const withFakeDocument = <T>(fn: () => T): T => {
	const previousDocument = (globalThis as { document?: Document }).document;
	(globalThis as { document?: Document }).document = {
		createElement: (tag: string) => createFakeElement(tag),
	} as unknown as Document;
	try {
		return fn();
	} finally {
		(globalThis as { document?: Document }).document = previousDocument;
	}
};

describe("calculator tool registration", () => {
	test("keeps Desmos as the default and selects packaged providers explicitly", () => {
		expect(resolveCalculatorProviderId(undefined)).toBe(
			DEFAULT_CALCULATOR_PROVIDER_ID,
		);
		expect(resolveCalculatorProviderId({})).toBe(
			DEFAULT_CALCULATOR_PROVIDER_ID,
		);
		expect(resolveCalculatorProviderId({ provider: {} })).toBe(
			DEFAULT_CALCULATOR_PROVIDER_ID,
		);
		expect(
			calculatorToolRegistration.provider?.createProvider(undefined)
				.providerName,
		).toBe("Desmos Calculator");

		const geogebraConfig = {
			provider: { id: "calculator-geogebra" },
		};
		expect(resolveCalculatorProviderId(geogebraConfig)).toBe(
			"calculator-geogebra",
		);
		expect(
			calculatorToolRegistration.provider?.createProvider(geogebraConfig)
				.providerName,
		).toBe("GeoGebra Calculator");

		const cortexConfig = { provider: { id: "calculator-cortex" } };
		expect(resolveCalculatorProviderId(cortexConfig)).toBe("calculator-cortex");
		expect(
			calculatorToolRegistration.provider?.createProvider(cortexConfig)
				.providerName,
		).toBe("PIE Open-Source Calculator");
	});

	test("rejects unknown calculator implementations", () => {
		expect(() =>
			resolveCalculatorProviderId({ provider: { id: "calculator-unknown" } }),
		).toThrow("Unsupported calculator provider");
	});

	test("uses only a host-supplied Desmos credential fetcher", () => {
		const getAuthFetcher = calculatorToolRegistration.provider?.getAuthFetcher;
		expect(getAuthFetcher?.(undefined)).toBeUndefined();

		const authFetcher = async () => ({ apiKey: "licensed-application-key" });
		expect(
			getAuthFetcher?.({
				provider: { runtime: { authFetcher } },
			} as any),
		).toBe(authFetcher);
	});

	test("supports only item level", () => {
		expect(calculatorToolRegistration.supportedLevels).toEqual(["item"]);
	});

	test("is visible for element context with math content", () => {
		const context: ToolContext = {
			level: "element",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					elements: {
						"el-1": "<div>Compute 7 * 8</div>",
					},
				},
			} as any,
			elementId: "el-1",
		};

		expect(calculatorToolRegistration.isVisibleInContext(context)).toBe(true);
	});

	test("is visible when math is in model prompt", () => {
		const context: ToolContext = {
			level: "element",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					models: [
						{
							id: "el-1",
							element: "multiple-choice",
							prompt: "<div>Solve 12 / 3</div>",
						},
					],
				},
			} as any,
			elementId: "el-1",
		};

		expect(calculatorToolRegistration.isVisibleInContext(context)).toBe(true);
	});

	test("is not visible for element context without math content", () => {
		const context: ToolContext = {
			level: "element",
			assessment: {} as any,
			itemRef: {} as any,
			item: {
				config: {
					elements: {
						"el-1": "<div>Explain the passage in your own words.</div>",
					},
				},
			} as any,
			elementId: "el-1",
		};

		expect(calculatorToolRegistration.isVisibleInContext(context)).toBe(false);
	});

	test("renderToolbar consumes resolved calculator render params", () => {
		const context: ToolContext = {
			level: "item",
			assessment: {} as any,
			itemRef: { id: "i1" } as any,
			item: { id: "i1", config: {} } as any,
		};
		const toolbarContext = {
			scope: { level: "item", scopeId: "i1" },
			itemId: "i1",
			catalogId: "i1",
			language: "en-US",
			// `ToolbarContext.i18n` is required: the toolbar resolves it once and a
			// registration reads it rather than re-implementing the fallback. Outside
			// a toolbar, the facade over the English-only default is what it gets.
			i18n: resolveInterfaceI18n(null),
			toolCoordinator: null,
			toolkitCoordinator: null,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
			getToolRenderParams: () => ({
				calculatorType: "basic",
				availableTypes: ["basic"],
			}),
			// The registry installs this map through `setComponentOverrides`, and the
			// toolkit no longer carries a packaged default to fall back to. A
			// registration exercised outside a registry has to supply it.
			componentOverrides: { toolTagMap: PACKAGED_TOOL_TAG_MAP },
		} as ToolbarContext;

		const result = withFakeDocument(() =>
			calculatorToolRegistration.renderToolbar(context, toolbarContext),
		);
		const element = result.elements?.[0]?.element as
			| (HTMLElement & {
					calculatorType?: string;
					availableTypes?: string[];
			  })
			| undefined;

		expect(result.button?.label).toBe("Basic Calculator");
		// The accessible name is the variant's own name and does not change with the
		// open/closed state; the toolbar exposes that through `aria-pressed`.
		expect(result.button?.ariaLabel).toBe("Basic Calculator");
		expect(result.button?.tooltip).toBe("Basic Calculator");
		expect(element?.calculatorType).toBe("basic");
		expect(element?.availableTypes).toEqual(["basic"]);
		expect(element?.getAttribute("calculator-type")).toBe("basic");
		// The element finds its provider under its own tool id, through the runtime
		// context; the registration hands it neither.
		expect((element as any)?.providerId).toBeUndefined();
		expect(element?.getAttribute("provider-id")).toBeNull();
		expect((element as any)?.toolkitCoordinator).toBeUndefined();
	});

	test("defaults the type to the policy parameters' type, under the render params", () => {
		const context: ToolContext = {
			level: "item",
			assessment: {} as any,
			itemRef: { id: "i1" } as any,
			item: { id: "i1", config: {} } as any,
		};
		const render = (
			parameters: Record<string, unknown> | null,
			renderParams: Record<string, unknown> | null,
		) => {
			const toolbarContext = {
				scope: { level: "item", scopeId: "i1" },
				itemId: "i1",
				catalogId: "i1",
				i18n: resolveInterfaceI18n(null),
				toolCoordinator: null,
				toolkitCoordinator: null,
				ttsService: null,
				elementToolStateStore: null,
				toggleTool: () => {},
				isToolVisible: () => false,
				subscribeVisibility: null,
				getToolRenderParams: () => renderParams,
				getToolParameters: (toolId: string) =>
					toolId === "calculator" ? parameters : null,
				componentOverrides: { toolTagMap: PACKAGED_TOOL_TAG_MAP },
			} as unknown as ToolbarContext;
			const result = withFakeDocument(() =>
				calculatorToolRegistration.renderToolbar(context, toolbarContext),
			);
			const element = result.elements?.[0]?.element as HTMLElement & {
				calculatorType?: string;
				availableTypes?: string[];
			};
			return {
				label: result.button?.label,
				calculatorType: element.calculatorType,
				availableTypes: element.availableTypes,
			};
		};

		expect(render({ type: "graphing" }, null)).toEqual({
			label: "Graphing Calculator",
			calculatorType: "graphing",
			availableTypes: ["graphing"],
		});
		expect(
			render({ type: "graphing" }, { calculatorType: "basic" }).calculatorType,
		).toBe("basic");
		expect(render({ type: "abacus" }, null).calculatorType).toBeUndefined();
	});

	test("declares a panel size per calculator type, and one before the type resolves", () => {
		/*
		 * The sizes, and the fact that they differ, because the toolbar builds a shell
		 * from the first render and `getToolRenderParams` is empty until the resolved
		 * tool context arrives. Every graphing calculator therefore opened at the
		 * untyped size until the shell learned to adopt a declared size that changed —
		 * a 380px panel for a layout that needs 700, with the plot column clipped.
		 * These assertions are the precondition that made that bug possible, so a
		 * change to either half has to face the other.
		 */
		const context = {
			level: "item",
			assessment: {},
			itemRef: { id: "i1" },
			item: { id: "i1", config: {} },
		} as ToolContext;
		const shellFor = (params: Record<string, unknown>) => {
			const toolbarContext = {
				scope: { level: "item", scopeId: "i1" },
				i18n: resolveInterfaceI18n(null),
				toolCoordinator: null,
				toolkitCoordinator: null,
				toggleTool: () => {},
				isToolVisible: () => false,
				subscribeVisibility: null,
				getToolRenderParams: () => params,
				componentOverrides: { toolTagMap: PACKAGED_TOOL_TAG_MAP },
			} as unknown as ToolbarContext;
			const result = withFakeDocument(() =>
				calculatorToolRegistration.renderToolbar(context, toolbarContext),
			);
			return result.elements?.[0]?.shell;
		};

		const untyped = shellFor({});
		const basic = shellFor({ calculatorType: "basic" });
		const scientific = shellFor({ calculatorType: "scientific" });
		const graphing = shellFor({ calculatorType: "graphing" });

		expect([untyped?.initialWidth, untyped?.initialHeight]).toEqual([380, 560]);
		expect([basic?.initialWidth, basic?.initialHeight]).toEqual([380, 500]);
		expect([scientific?.initialWidth, scientific?.initialHeight]).toEqual([
			380, 560,
		]);
		expect([graphing?.initialWidth, graphing?.initialHeight]).toEqual([720, 660]);

		// What the toolbar has to notice: the shell it built before the type resolved
		// is not the shell this type asks for.
		expect(graphing?.initialWidth).not.toBe(untyped?.initialWidth);

		/*
		 * The opening size varies by type; the resize floor does not. This
		 * registration serves three vendors, so a per-type floor would move the limit
		 * under two whose layouts were never measured for it — below the floor a
		 * calculator scrolls its own content, which is the contract already.
		 */
		for (const shell of [untyped, basic, scientific, graphing]) {
			expect([shell?.minWidth, shell?.minHeight]).toEqual([380, 480]);
		}
	});

	test("forwards provider-neutral and implementation settings to the surface", () => {
		const context = {
			level: "item",
			assessment: {},
			itemRef: { id: "i1" },
			item: { id: "i1", config: {} },
		} as ToolContext;
		const toolbarContext = {
			scope: { level: "item", scopeId: "i1" },
			i18n: resolveInterfaceI18n(null),
			toolCoordinator: null,
			toolkitCoordinator: {
				getToolConfig: (toolId: string) =>
					toolId === "calculator"
						? {
								provider: { id: "calculator-geogebra" },
								settings: { showResetIcon: true },
								restrictedMode: true,
								locale: "nl-NL",
							}
						: null,
			},
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
			getToolRenderParams: () => ({ calculatorType: "graphing" }),
			componentOverrides: { toolTagMap: PACKAGED_TOOL_TAG_MAP },
		} as unknown as ToolbarContext;

		const result = withFakeDocument(() =>
			calculatorToolRegistration.renderToolbar(context, toolbarContext),
		);
		const element = result.elements?.[0]?.element as any;
		expect(result.button?.label).toBe("Graphing Calculator");
		expect(element.calculatorType).toBe("graphing");
		expect(element.calculatorConfig).toEqual({
			settings: { showResetIcon: true },
			restrictedMode: true,
			locale: "nl-NL",
			theme: undefined,
		});
	});
});
