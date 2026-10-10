/**
 * The examples in `docs/TOOL_REGISTRY.md`, run as written against the toolkit's
 * own entries. `check:docs:examples` typechecks a fence only when it imports a
 * package, and treats every name an earlier fence declared as `any`; this runs
 * each one with real values and asserts what the doc says it does.
 *
 * `createPackagedToolRegistry` and `SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT`
 * belong to `@pie-players/pie-default-tool-loaders`, which depends on this
 * package, so the fences built on them run here on a registry of the doc's own
 * registrations and test stubs. The loaders' own tests cover their options.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

import { resolveInterfaceI18n } from "@pie-players/pie-players-shared/i18n/provider";
import type {
	AssessmentEntity,
	AssessmentItemRef,
	ItemEntity,
} from "@pie-players/pie-players-shared/types";

import { ToolkitCoordinator, createToolsConfig } from "../src/index.js";
import type {
	ItemToolContext,
	ToolContext,
	ToolRegistration,
	ToolRegistryChangeEvent,
	ToolSurfaceRenderContext,
	ToolSurfaceServices,
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "../src/index.js";
import type { ToolProviderApi } from "../src/tools/registration.js";
import {
	ToolRegistry,
	createScopedToolId,
	createToolElement,
	hasChoiceInteraction,
	hasMathContent,
	hasReadableText,
	hasScienceContent,
	resolveToolTag,
} from "../src/tools/registration.js";
import { createTestToolRegistration } from "./fixtures/test-tool-registry.js";

beforeAll(() => {
	GlobalRegistrator.register();
});
afterAll(() => {
	if (GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

// "Registering a Tool".
const calculatorToolRegistration: ToolRegistration = {
	toolId: "calculator",
	name: "Calculator",
	description: "Multi-type calculator (basic, scientific, graphing)",
	icon: "calculator",
	supportedLevels: ["item"],
	isVisibleInContext(context: ToolContext): boolean {
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
		const calculator = createToolElement(
			this.toolId,
			context,
			toolbarContext,
			toolbarContext.componentOverrides,
		) as HTMLElement & { visible?: boolean };
		calculator.setAttribute("tool-id", fullToolId);

		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: "calculator",
			ariaLabel: "Calculator",
			tooltip: "Calculator",
			onClick: () => toolbarContext.toggleTool(this.toolId),
			active: toolbarContext.isToolVisible(this.toolId),
		};
		calculator.visible = button.active;

		return {
			toolId: this.toolId,
			button,
			elements: [
				{
					element: calculator,
					mount: "after-buttons",
					shell: {
						title: "Calculator",
						draggable: true,
						resizable: true,
						closeable: true,
					},
				},
			],
			sync: () => {
				button.active = toolbarContext.isToolVisible(this.toolId);
				calculator.visible = button.active;
			},
		};
	},
};

// "Creating Custom Tools", step 1.
const myToolRegistration: ToolRegistration = {
	toolId: "myTool",
	name: "My Tool",
	description: "Custom tool description",
	icon: "custom-icon",
	supportedLevels: ["item", "element"],
	isVisibleInContext(_context: ToolContext): boolean {
		return true;
	},
	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		const element = createToolElement(
			this.toolId,
			context,
			toolbarContext,
			toolbarContext.componentOverrides,
		) as HTMLElement & { visible?: boolean };
		const button = {
			toolId: this.toolId,
			label: this.name,
			ariaLabel: this.name,
			onClick: () => toolbarContext.toggleTool(this.toolId),
			active: toolbarContext.isToolVisible(this.toolId),
		};
		element.visible = button.active;

		return {
			toolId: this.toolId,
			button,
			elements: [{ element, mount: "after-buttons", shell: { title: this.name } }],
			sync: () => {
				button.active = toolbarContext.isToolVisible(this.toolId);
				element.visible = button.active;
			},
		};
	},
};

const assessment = {
	id: "a1",
	personalNeedsProfile: { supports: ["calculator"] },
} satisfies AssessmentEntity;

const itemRef = {
	identifier: "question-1",
	settings: { requiredTools: ["textToSpeech"] },
} satisfies AssessmentItemRef;

function itemEntity(markup: string): ItemEntity {
	return {
		baseId: "question-1",
		version: { major: 1, minor: 0, patch: 0 },
		config: { markup, elements: {}, models: [] },
	};
}

const mathItem = itemEntity("<div>Solve 3 + 5 = ?</div>");
const proseItem = itemEntity("<div>Read the passage and answer.</div>");

/**
 * The context `<pie-item-toolbar>` builds: `toggleTool` and `isToolVisible`
 * take a base tool id and scope it to the toolbar's item.
 */
function itemToolbarContext(itemId: string): ToolbarContext {
	const shown = new Set<string>();
	const instance = (toolId: string) => createScopedToolId(toolId, "item", itemId);
	return {
		scope: { level: "item", scopeId: itemId, itemId },
		itemId,
		catalogId: itemId,
		language: "en",
		i18n: resolveInterfaceI18n(null),
		toolCoordinator: null,
		toolkitCoordinator: null,
		ttsService: null,
		elementToolStateStore: null,
		toggleTool: (toolId) => {
			const id = instance(toolId);
			if (!shown.delete(id)) shown.add(id);
		},
		isToolVisible: (toolId) => shown.has(instance(toolId)),
		subscribeVisibility: null,
	};
}

function docRegistry(): ToolRegistry {
	const registry = new ToolRegistry();
	registry.register(calculatorToolRegistration);
	registry.register(
		createTestToolRegistration({
			toolId: "textToSpeech",
			supportedLevels: ["item", "passage"],
		}),
	);
	registry.setComponentOverrides({
		toolTagMap: { calculator: "pie-tool-calculator" },
	});
	return registry;
}

function docCoordinator(toolRegistry: ToolRegistry) {
	const coordinator = new ToolkitCoordinator({
		assessmentId: assessment.id,
		lazyInit: true,
		toolRegistry,
		tools: { placement: { item: ["calculator", "textToSpeech"] } },
	});
	coordinator.updateAssessment(assessment);
	coordinator.registerItemSettings(itemRef.identifier, itemRef.settings);
	return coordinator;
}

describe("TOOL_REGISTRY.md examples", () => {
	test("Registering a Tool: the button and element follow this toolbar's instance", () => {
		const registry = docRegistry();
		const context: ItemToolContext = {
			level: "item",
			assessment,
			itemRef,
			item: mathItem,
		};
		const toolbarContext = itemToolbarContext("question-1");

		expect(calculatorToolRegistration.isVisibleInContext?.(context)).toBe(true);
		expect(
			calculatorToolRegistration.isVisibleInContext?.({ ...context, item: proseItem }),
		).toBe(false);

		const result = registry.renderForToolbar("calculator", context, toolbarContext);
		const element = result?.elements?.[0]?.element as HTMLElement & {
			visible?: boolean;
		};
		expect(element.tagName.toLowerCase()).toBe("pie-tool-calculator");
		expect(element.getAttribute("tool-id")).toBe(
			createScopedToolId("calculator", "item", "question-1"),
		);
		expect(result?.button?.active).toBe(false);

		result?.button?.onClick();
		result?.sync?.();
		expect(result?.button?.active).toBe(true);
		expect(element.visible).toBe(true);
	});

	test("Context Helper Functions answer on content", () => {
		const context: ItemToolContext = {
			level: "item",
			assessment,
			itemRef,
			item: itemEntity(
				"<div>Sodium chloride (NaCl) dissolves in water before the reaction.</div>",
			),
		};
		expect(hasReadableText(context)).toBe(true);
		expect(hasMathContent(context)).toBe(false);
		expect(hasScienceContent(context)).toBe(true);
		expect(hasChoiceInteraction(context)).toBe(false);
	});

	test("PNP Resolution: the placement validates and the item toolbar shows both tools", () => {
		const toolRegistry = docRegistry();
		const validated = createToolsConfig({
			strictness: "error",
			toolRegistry,
			tools: { placement: { item: ["calculator", "textToSpeech"] } },
		});
		expect(validated.diagnostics).toEqual([]);

		const allowedToolIds = docCoordinator(toolRegistry)
			.decideToolPolicy({
				level: "item",
				scope: { level: "item", scopeId: itemRef.identifier },
			})
			.visibleTools.map((tool) => tool.toolId);
		expect(allowedToolIds).toEqual(["calculator", "textToSpeech"]);
	});

	test("Filtering by Context and Toolbar Rendering: a granted entry skips relevance", async () => {
		const toolRegistry = docRegistry();
		const coordinator = docCoordinator(toolRegistry);
		const decision = coordinator.decideToolPolicy({
			level: "item",
			scope: { level: "item", scopeId: itemRef.identifier },
		});
		// Prose: the calculator's relevance check says no, and the profile's grant
		// keeps it.
		const context: ItemToolContext = {
			level: "item",
			assessment,
			itemRef,
			item: proseItem,
		};

		const visibleToolIds = toolRegistry.filterDecidedToolIds(
			decision.visibleTools,
			"item",
			[context],
		);
		expect(visibleToolIds).toEqual(["calculator", "textToSpeech"]);
		expect(
			toolRegistry.filterDecidedToolIds(
				decision.visibleTools.map((entry) => ({
					...entry,
					required: false,
					alwaysAvailable: false,
				})),
				"item",
				[context],
			),
		).toEqual(["textToSpeech"]);

		expect((await toolRegistry.ensureToolModulesLoaded(visibleToolIds)).size).toBe(0);
		const toolbarContext = itemToolbarContext(itemRef.identifier);
		const rendered: string[] = [];
		for (const toolId of visibleToolIds) {
			const result = toolRegistry.renderForToolbar(toolId, context, toolbarContext);
			if (!result) continue;
			rendered.push(result.toolId);
		}
		// The text-to-speech stub renders nothing, so the loop skips it.
		expect(rendered).toEqual(["calculator"]);
	});

	test("Selection Actions: a toolbar claims requests for the tools it hosts", () => {
		const registry = docRegistry();
		registry.register(
			createTestToolRegistration({ toolId: "dictionary", supportedLevels: ["section"] }),
		);
		const coordinator = new ToolkitCoordinator({
			assessmentId: "selection-actions",
			lazyInit: true,
			toolRegistry: registry,
			tools: { placement: { section: ["dictionary"], item: ["calculator"] } },
		});
		const opened: Array<{ toolId: string; params?: Record<string, unknown> }> = [];
		coordinator.registerToolRequestTarget({
			level: "section",
			scopeId: "s1",
			hostsTool: (toolId) => toolId === "dictionary",
			open: (toolId, params) => {
				opened.push({ toolId, params });
			},
		});
		coordinator.registerToolRequestTarget({
			level: "item",
			scopeId: "question-1",
			hostsTool: (toolId) => toolId === "calculator",
			open: () => {},
		});
		const term = "chloroplast";

		expect(coordinator.canRequestTool("dictionary")).toBe(true);
		expect(coordinator.requestTool({ toolId: "dictionary", params: { term } })).toBe(
			true,
		);
		expect(opened).toEqual([{ toolId: "dictionary", params: { term } }]);
		expect(coordinator.canRequestTool("calculator", "item", "question-1")).toBe(true);
		expect(coordinator.canRequestTool("calculator", "item", "question-2")).toBe(false);
		// With no level, a request prefers the section toolbar and falls back to any
		// toolbar hosting the tool.
		expect(coordinator.canRequestTool("calculator")).toBe(true);
		expect(coordinator.canRequestTool("calculator", "section")).toBe(false);
	});

	test("Host Surfaces: a region capability renders through its mapped tag and syncs", () => {
		const findAlternateMediaCard = (
			catalogs: unknown,
		): { src: string } | null => (catalogs ? { src: "media.mp4" } : null);
		const alternateMediaRegistration: ToolRegistration = {
			toolId: "hostAlternateMedia",
			name: "Alternate media",
			description: "Docked alternate media for an item",
			supportedLevels: ["item"],
			activation: "region",
			surfaces: ["content-media"],
			requiresAuthoredContent: {
				description: "an alternate-media catalog card on the item",
				resolve: ({ catalogs }) => findAlternateMediaCard(catalogs),
			},
			renderSurface: (context) => {
				const tagName = resolveToolTag(
					context.toolId,
					context.componentOverrides ?? {},
				);
				if (!customElements.get(tagName)) return null;
				const element = document.createElement(tagName) as HTMLElement & {
					media?: unknown;
				};
				const apply = (current: ToolSurfaceRenderContext) => {
					element.media = current.content;
				};
				apply(context);
				return { element, ariaLabel: "Alternate media", sync: apply };
			},
		};

		const registry = new ToolRegistry();
		registry.register(alternateMediaRegistration);
		expect(registry.getToolActivation("hostAlternateMedia")).toBe("region");
		expect(
			registry.getToolsBySurface("content-media").map((tool) => tool.toolId),
		).toEqual(["hostAlternateMedia"]);
		expect(registry.getContentDependentSupportIds()).toEqual(["hostAlternateMedia"]);

		const surfaceContext = (content: unknown): ToolSurfaceRenderContext => ({
			toolId: "hostAlternateMedia",
			granted: true,
			surface: "content-media",
			content,
			services: {} as ToolSurfaceServices,
			componentOverrides: { toolTagMap: { hostAlternateMedia: "host-alternate-media" } },
		});
		expect(alternateMediaRegistration.renderSurface?.(surfaceContext("a"))).toBeNull();

		customElements.define("host-alternate-media", class extends HTMLElement {});
		const rendered = alternateMediaRegistration.renderSurface?.(surfaceContext("a"));
		const element = rendered?.element as HTMLElement & { media?: unknown };
		expect(element.tagName.toLowerCase()).toBe("host-alternate-media");
		expect(element.media).toBe("a");
		rendered?.sync?.(surfaceContext("b"));
		expect(element.media).toBe("b");
	});

	test("Host Surfaces: onRegistryChange reports each mutation until unsubscribed", () => {
		const registry = new ToolRegistry();
		const events: ToolRegistryChangeEvent[] = [];
		const reconcileSurface = (event: ToolRegistryChangeEvent) => {
			events.push(event);
		};

		const unsubscribe = registry.onRegistryChange((event) => {
			reconcileSurface(event);
		});
		registry.register(myToolRegistration);
		unsubscribe();
		registry.unregister("myTool");

		expect(events).toEqual([{ kind: "register", toolIds: ["myTool"] }]);
	});

	test("Creating Custom Tools: the registry's tag map names the element", () => {
		const registry = new ToolRegistry();
		registry.register(myToolRegistration);
		registry.setComponentOverrides({ toolTagMap: { myTool: "my-tool" } });

		const context: ItemToolContext = {
			level: "item",
			assessment,
			itemRef,
			item: proseItem,
		};
		const toolbarContext = itemToolbarContext("question-1");
		const result = registry.renderForToolbar("myTool", context, toolbarContext);
		expect(result?.elements?.[0]?.element?.tagName.toLowerCase()).toBe("my-tool");

		result?.button?.onClick();
		result?.sync?.();
		expect(result?.button?.active).toBe(true);
	});

	test("Services, Providers and Config Hooks: validation sanitizes, then validates", () => {
		class MyToolProvider implements ToolProviderApi {
			readonly providerName = "My tool";
			readonly category = "other" as const;
			readonly version = "1.0.0";
			readonly requiresAuth = false;
			constructor(readonly implementation?: string) {}
			async initialize(): Promise<void> {}
			async createInstance(): Promise<unknown> {
				return {};
			}
			isReady(): boolean {
				return true;
			}
			destroy(): void {}
		}
		const registration: ToolRegistration = {
			...myToolRegistration,
			provider: {
				createProvider: (config) => new MyToolProvider(config?.provider?.id),
				getInitConfig: (config) => config?.provider?.init ?? {},
			},
			sanitizeConfig: (config) => ({ ...config, settings: { ...config.settings } }),
			validateConfig: (config) =>
				config.settings?.mode === "unknown"
					? [
							{
								code: "tools.providerValidateFailed",
								severity: "error",
								path: "providers.myTool.settings.mode",
								message: "Unknown mode.",
							},
						]
					: [],
		};
		const toolRegistry = new ToolRegistry();
		toolRegistry.register(registration);

		const result = createToolsConfig({
			strictness: "warn",
			toolRegistry,
			tools: {
				placement: { item: ["myTool"] },
				providers: { myTool: { settings: { mode: "unknown" } } },
			},
		});
		expect(result.diagnostics).toEqual([
			expect.objectContaining({
				code: "tools.providerValidateFailed",
				path: "providers.myTool.settings.mode",
			}),
		]);
		expect(
			registration.provider?.createProvider({ provider: { id: "local" } }),
		).toMatchObject({ implementation: "local" });
	});
});
