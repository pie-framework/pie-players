import { describe, expect, test, beforeEach } from "bun:test";
import { ToolRegistry } from "../src/services/ToolRegistry";
import type { ToolRegistration } from "../src/services/ToolRegistry";
import type { ToolbarContext } from "../src/services/ToolRegistry";
import type { ToolContext } from "../src/services/tool-context";

// Mock tool registration
const mockCalculatorTool: ToolRegistration = {
	toolId: "calculator",
	name: "Calculator",
	description: "Basic calculator tool",
	icon: "calculator-icon",
	supportedLevels: ["item", "section", "element"],
	pnpSupportIds: ["calculator", "basicCalculator", "scientificCalculator"],
	isVisibleInContext: (context: ToolContext) => {
		// Simple mock: always visible for testing
		return true;
	},
	renderToolbar: (_context, _toolbarContext) => {
		return {
			toolId: "calculator",
			elements: [
				{
					element: { className: "pie-tool-calculator" } as any,
					mount: "after-buttons" as const,
				},
			],
		};
	},
};

const mockTTSTool: ToolRegistration = {
	toolId: "textToSpeech",
	name: "Text to Speech",
	description: "Read content aloud",
	icon: "speaker-icon",
	supportedLevels: ["item", "passage", "element"],
	pnpSupportIds: ["textToSpeech", "tts"],
	isVisibleInContext: (context: ToolContext) => {
		return true;
	},
	renderToolbar: (_context, _toolbarContext) => {
		return {
			toolId: "textToSpeech",
			elements: [
				{
					element: { className: "tts-tool" } as any,
					mount: "after-buttons" as const,
				},
			],
		};
	},
};

const mockSelectionGatewayTool: ToolRegistration = {
	toolId: "annotationToolbar",
	name: "Annotation Toolbar",
	description: "Selection-driven text annotation gateway",
	icon: "highlighter",
	supportedLevels: ["item", "passage", "element"],
	activation: "selection-gateway",
	singletonScope: "section",
	pnpSupportIds: ["annotations", "highlighting"],
	isVisibleInContext: () => true,
	renderToolbar: () => null,
};

const mockRegionTool: ToolRegistration = {
	toolId: "hostAlternateMedia",
	name: "Host Alternate Media",
	description: "Host-contributed capability rendering into a card region",
	supportedLevels: ["item"],
	activation: "region",
	surfaces: ["item-media"],
	pnpSupportIds: ["hostAlternateMedia"],
	isVisibleInContext: () => true,
	renderSurface: (context) => ({
		element: { className: `region-${context.surface}` } as any,
	}),
};

describe("ToolRegistry", () => {
	let registry: ToolRegistry;

	beforeEach(() => {
		registry = new ToolRegistry();
	});

	describe("register", () => {
		test("registers a tool successfully", () => {
			registry.register(mockCalculatorTool);
			expect(registry.has("calculator")).toBe(true);
			expect(registry.get("calculator")).toEqual(mockCalculatorTool);
		});

		test("throws error when registering duplicate tool ID", () => {
			registry.register(mockCalculatorTool);
			expect(() => registry.register(mockCalculatorTool)).toThrow(
				"Tool 'calculator' is already registered",
			);
		});

		test("indexes PNP support IDs", () => {
			registry.register(mockCalculatorTool);
			const toolIds = registry.getToolsByPNPSupport("calculator");
			expect(toolIds.has("calculator")).toBe(true);
		});

		test("indexes multiple PNP support IDs for same tool", () => {
			registry.register(mockCalculatorTool);
			expect(
				registry.getToolsByPNPSupport("calculator").has("calculator"),
			).toBe(true);
			expect(
				registry.getToolsByPNPSupport("basicCalculator").has("calculator"),
			).toBe(true);
			expect(
				registry.getToolsByPNPSupport("scientificCalculator").has("calculator"),
			).toBe(true);
		});
	});

	describe("override", () => {
		test("overrides existing tool registration", () => {
			registry.register(mockCalculatorTool);

			const updatedTool: ToolRegistration = {
				...mockCalculatorTool,
				name: "Updated Calculator",
			};

			registry.override(updatedTool);
			expect(registry.get("calculator")?.name).toBe("Updated Calculator");
		});

		test("throws error when overriding non-existent tool", () => {
			expect(() => registry.override(mockCalculatorTool)).toThrow(
				"Cannot override non-existent tool 'calculator'",
			);
		});

		test("updates PNP index when overriding", () => {
			registry.register(mockCalculatorTool);

			const updatedTool: ToolRegistration = {
				...mockCalculatorTool,
				pnpSupportIds: ["calculator", "graphingCalculator"], // Changed PNP IDs
			};

			registry.override(updatedTool);

			// Old PNP ID should be removed
			expect(registry.getToolsByPNPSupport("basicCalculator").size).toBe(0);

			// New PNP ID should be added
			expect(
				registry.getToolsByPNPSupport("graphingCalculator").has("calculator"),
			).toBe(true);
		});
	});

	describe("unregister", () => {
		test("removes tool from registry", () => {
			registry.register(mockCalculatorTool);
			registry.unregister("calculator");
			expect(registry.has("calculator")).toBe(false);
		});

		test("removes tool from PNP index", () => {
			registry.register(mockCalculatorTool);
			registry.unregister("calculator");
			expect(registry.getToolsByPNPSupport("calculator").size).toBe(0);
		});

		test("does nothing when unregistering non-existent tool", () => {
			expect(() => registry.unregister("nonexistent")).not.toThrow();
		});
	});

	describe("get", () => {
		test("returns registered tool", () => {
			registry.register(mockCalculatorTool);
			expect(registry.get("calculator")).toEqual(mockCalculatorTool);
		});

		test("returns undefined for non-existent tool", () => {
			expect(registry.get("nonexistent")).toBeUndefined();
		});
	});

	describe("getAllToolIds", () => {
		test("returns all registered tool IDs", () => {
			registry.register(mockCalculatorTool);
			registry.register(mockTTSTool);
			const toolIds = registry.getAllToolIds();
			expect(toolIds).toContain("calculator");
			expect(toolIds).toContain("textToSpeech");
			expect(toolIds.length).toBe(2);
		});

		test("returns empty array when no tools registered", () => {
			expect(registry.getAllToolIds()).toEqual([]);
		});
	});

	describe("getAllTools", () => {
		test("returns all tool registrations", () => {
			registry.register(mockCalculatorTool);
			registry.register(mockTTSTool);
			const tools = registry.getAllTools();
			expect(tools.length).toBe(2);
			expect(tools).toContainEqual(mockCalculatorTool);
			expect(tools).toContainEqual(mockTTSTool);
		});
	});

	describe("getToolsByPNPSupport", () => {
		test("returns tools that support given PNP ID", () => {
			registry.register(mockCalculatorTool);
			registry.register(mockTTSTool);

			const calcTools = registry.getToolsByPNPSupport("calculator");
			expect(calcTools.has("calculator")).toBe(true);
			expect(calcTools.has("textToSpeech")).toBe(false);
		});

		test("returns empty set for unknown PNP ID", () => {
			registry.register(mockCalculatorTool);
			const tools = registry.getToolsByPNPSupport("unknown");
			expect(tools.size).toBe(0);
		});

		test("handles multiple tools supporting same PNP ID", () => {
			const calculator2: ToolRegistration = {
				...mockCalculatorTool,
				toolId: "calculator2",
				pnpSupportIds: ["calculator"], // Same PNP ID
			};

			registry.register(mockCalculatorTool);
			registry.register(calculator2);

			const tools = registry.getToolsByPNPSupport("calculator");
			expect(tools.size).toBe(2);
			expect(tools.has("calculator")).toBe(true);
			expect(tools.has("calculator2")).toBe(true);
		});
	});

	describe("getToolsByLevel", () => {
		test("returns tools that support given level", () => {
			registry.register(mockCalculatorTool);
			registry.register(mockTTSTool);

			const itemTools = registry.getToolsByLevel("item");
			expect(itemTools.length).toBe(2); // Both support item level

			const passageTools = registry.getToolsByLevel("passage");
			expect(passageTools.length).toBe(1); // Only TTS supports passage
			expect(passageTools[0].toolId).toBe("textToSpeech");
		});

		test("returns empty array for level with no tools", () => {
			registry.register(mockCalculatorTool);
			const assessmentTools = registry.getToolsByLevel("assessment");
			expect(assessmentTools.length).toBe(0);
		});
	});

	describe("filterVisibleInContext", () => {
		test("filters tools by visibility", () => {
			const conditionalTool: ToolRegistration = {
				...mockCalculatorTool,
				toolId: "conditional",
				isVisibleInContext: (context) => {
					// Only visible at item level
					return context.level === "item";
				},
			};

			registry.register(conditionalTool);

			const itemContext: ToolContext = {
				level: "item",
				assessment: {} as any,
				itemRef: {} as any,
				item: {} as any,
			};

			const sectionContext: ToolContext = {
				level: "section",
				assessment: {} as any,
				section: {} as any,
			};

			// Should be visible at item level
			const visibleAtItem = registry.filterVisibleInContext(
				["conditional"],
				itemContext,
			);
			expect(visibleAtItem.length).toBe(1);

			// Should not be visible at section level
			const visibleAtSection = registry.filterVisibleInContext(
				["conditional"],
				sectionContext,
			);
			expect(visibleAtSection.length).toBe(0);
		});

		test("enforces one-way veto (orchestrator gate)", () => {
			const alwaysVisibleTool: ToolRegistration = {
				...mockCalculatorTool,
				isVisibleInContext: () => true, // Tool says YES
			};

			registry.register(alwaysVisibleTool);

			const context: ToolContext = {
				level: "item",
				assessment: {} as any,
				itemRef: {} as any,
				item: {} as any,
			};

			// Orchestrator says NO (empty allowed list)
			const visible = registry.filterVisibleInContext([], context);
			expect(visible.length).toBe(0); // Tool can't override orchestrator's NO
		});

		test("skips tools not in registry", () => {
			const context: ToolContext = {
				level: "item",
				assessment: {} as any,
				itemRef: {} as any,
				item: {} as any,
			};

			// Request tool that doesn't exist
			const visible = registry.filterVisibleInContext(["nonexistent"], context);
			expect(visible.length).toBe(0);
		});

		test("filters by supported level", () => {
			registry.register(mockCalculatorTool); // Supports: item, section, element

			const assessmentContext: ToolContext = {
				level: "assessment",
				assessment: {} as any,
			};

			// Calculator doesn't support assessment level
			const visible = registry.filterVisibleInContext(
				["calculator"],
				assessmentContext,
			);
			expect(visible.length).toBe(0);
		});
	});

	describe("getToolMetadata", () => {
		test("returns metadata for all tools", () => {
			registry.register(mockCalculatorTool);
			registry.register(mockTTSTool);

			const metadata = registry.getToolMetadata();
			expect(metadata.length).toBe(2);

			const calcMeta = metadata.find((m) => m.toolId === "calculator");
			expect(calcMeta).toEqual({
				toolId: "calculator",
				name: "Calculator",
				description: "Basic calculator tool",
				pnpSupportIds: [
					"calculator",
					"basicCalculator",
					"scientificCalculator",
				],
				supportedLevels: ["item", "section", "element"],
				activation: "toolbar-toggle",
				singletonScope: null,
				surfaces: [],
				requiresAuthoredContent: false,
				contentDependencyDescription: null,
			});
		});
	});

	describe("activation metadata", () => {
		test("defaults activation to toolbar-toggle", () => {
			registry.register(mockCalculatorTool);
			expect(registry.getToolActivation("calculator")).toBe("toolbar-toggle");
		});

		test("returns configured activation and singleton scope", () => {
			registry.register(mockSelectionGatewayTool);
			expect(registry.getToolActivation("annotationToolbar")).toBe(
				"selection-gateway",
			);
			expect(registry.getToolSingletonScope("annotationToolbar")).toBe(
				"section",
			);
		});

		test("filters tool IDs by activation", () => {
			registry.register(mockCalculatorTool);
			registry.register(mockSelectionGatewayTool);
			const gatewayTools = registry.filterToolIdsByActivation(
				["calculator", "annotationToolbar"],
				"selection-gateway",
			);
			expect(gatewayTools).toEqual(["annotationToolbar"]);
		});
	});

	describe("generatePNPSupportsFromTools", () => {
		test("generates unique PNP support IDs", () => {
			registry.register(mockCalculatorTool);
			registry.register(mockTTSTool);

			const pnpSupports = registry.generatePNPSupportsFromTools([
				"calculator",
				"textToSpeech",
			]);

			expect(pnpSupports).toContain("calculator");
			expect(pnpSupports).toContain("basicCalculator");
			expect(pnpSupports).toContain("scientificCalculator");
			expect(pnpSupports).toContain("textToSpeech");
			expect(pnpSupports).toContain("tts");

			// Should be unique
			expect(new Set(pnpSupports).size).toBe(pnpSupports.length);
		});

		test("ignores tools without PNP support IDs", () => {
			const toolWithoutPNP: ToolRegistration = {
				...mockCalculatorTool,
				toolId: "custom",
				pnpSupportIds: undefined,
			};

			registry.register(toolWithoutPNP);

			const pnpSupports = registry.generatePNPSupportsFromTools(["custom"]);
			expect(pnpSupports.length).toBe(0);
		});
	});

	describe("clear", () => {
		test("removes all registrations", () => {
			registry.register(mockCalculatorTool);
			registry.register(mockTTSTool);

			registry.clear();

			expect(registry.getAllToolIds().length).toBe(0);
			expect(registry.getToolsByPNPSupport("calculator").size).toBe(0);
		});
	});

	describe("onRegistryChange", () => {
		test("emits successful mutations synchronously in operation order", () => {
			const events: Array<{ kind: string; toolIds: readonly string[] }> = [];
			registry.onRegistryChange((event) => events.push(event));
			const updated = { ...mockCalculatorTool, name: "Updated Calculator" };

			registry.register(mockCalculatorTool);
			registry.override(updated);
			registry.unregister(updated.toolId);

			expect(events).toEqual([
				{ kind: "register", toolIds: ["calculator"] },
				{ kind: "override", toolIds: ["calculator"] },
				{ kind: "unregister", toolIds: ["calculator"] },
			]);
		});

		test("reports clear, component overrides, and changed lazy loaders", () => {
			const events: Array<{ kind: string; toolIds: readonly string[] }> = [];
			registry.onRegistryChange((event) => events.push(event));
			const overrides = {};
			const loader = async () => undefined;

			registry.register(mockCalculatorTool);
			registry.setComponentOverrides(overrides);
			registry.setComponentOverrides(overrides);
			registry.setToolModuleLoaders({ calculator: loader });
			registry.setToolModuleLoaders({ calculator: loader });
			registry.clear();
			registry.clear();

			expect(events.slice(1)).toEqual([
				{ kind: "component-overrides", toolIds: [] },
				{ kind: "module-loaders", toolIds: ["calculator"] },
				{ kind: "clear", toolIds: ["calculator"] },
			]);
		});

		test("does not emit invalid or no-op mutations and isolates listeners", () => {
			let calls = 0;
			const unsubscribe = registry.onRegistryChange(() => {
				throw new Error("listener failure");
			});
			registry.onRegistryChange(() => {
				calls += 1;
			});

			expect(() => registry.unregister("missing")).not.toThrow();
			expect(() => registry.override(mockCalculatorTool)).toThrow();
			registry.register(mockCalculatorTool);
			expect(calls).toBe(1);
			unsubscribe();
			unsubscribe();
			registry.unregister(mockCalculatorTool.toolId);
			expect(calls).toBe(2);
		});
	});

	describe("renderForToolbar", () => {
		const toolbarContext: ToolbarContext = {
			scope: {
				level: "item",
				scopeId: "item-1",
				itemId: "item-1",
			},
			itemId: "item-1",
			catalogId: "item-1",
			language: "en",
			toolCoordinator: null,
			toolkitCoordinator: null,
			ttsService: null,
			elementToolStateStore: null,
			toggleTool: () => {},
			isToolVisible: () => false,
			subscribeVisibility: null,
		};

		test("renders toolbar output for registered tool", () => {
			registry.register(mockCalculatorTool);
			const context: ToolContext = {
				level: "item",
				assessment: {} as any,
				itemRef: {} as any,
				item: {} as any,
			};
			const renderResult = registry.renderForToolbar(
				"calculator",
				context,
				toolbarContext,
			);
			expect(renderResult?.elements?.[0]?.element?.className).toBe(
				"pie-tool-calculator",
			);
		});

		test("throws when tool is not registered", () => {
			const context: ToolContext = {
				level: "item",
				assessment: {} as any,
				itemRef: {} as any,
				item: {} as any,
			};
			expect(() =>
				registry.renderForToolbar("missing-tool", context, toolbarContext),
			).toThrow("Tool 'missing-tool' is not registered");
		});
	});
	describe("region activation and host surfaces", () => {
		test("registers a capability with no icon and no renderToolbar", () => {
			// The point of the mechanism: a host can contribute a capability that
			// renders somewhere other than a toolbar, with no id of ours involved.
			expect(() => registry.register(mockRegionTool)).not.toThrow();
			expect(registry.getToolActivation("hostAlternateMedia")).toBe("region");
		});

		test("discovers surface capabilities by surface name, not by tool id", () => {
			registry.register(mockRegionTool);
			registry.register(mockCalculatorTool);

			expect(
				registry.getToolsBySurface("item-media").map((tool) => tool.toolId),
			).toEqual(["hostAlternateMedia"]);
			expect(registry.getToolsBySurface("section-overlay")).toEqual([]);
			expect(registry.getToolsBySurface("")).toEqual([]);
		});

		test("finds a toolbar tool that also declares a surface", () => {
			// The annotation toolbar is both: a button at item/passage level and a
			// section-scoped singleton. Declaring a surface must not remove it from
			// the toolbar path.
			registry.register({
				...mockSelectionGatewayTool,
				surfaces: ["section-overlay"],
				renderSurface: () => ({ element: {} as any }),
			});

			expect(
				registry.getToolsBySurface("section-overlay").map((t) => t.toolId),
			).toEqual(["annotationToolbar"]);
			expect(
				registry.filterToolIdsByActivation(
					["annotationToolbar"],
					"selection-gateway",
				),
			).toEqual(["annotationToolbar"]);
		});

		test("reports surfaces in tool metadata", () => {
			registry.register(mockRegionTool);
			const meta = registry
				.getToolMetadata()
				.find((entry) => entry.toolId === "hostAlternateMedia");
			expect(meta?.activation).toBe("region");
			expect(meta?.surfaces).toEqual(["item-media"]);
		});

		test("rejects a region tool with no surfaces", () => {
			expect(() =>
				registry.register({ ...mockRegionTool, surfaces: [] }),
			).toThrow("must declare at least one host surface");
		});

		test("rejects a region tool with no renderSurface", () => {
			const { renderSurface: _omitted, ...withoutRenderSurface } =
				mockRegionTool;
			expect(() =>
				registry.register(withoutRenderSurface as ToolRegistration),
			).toThrow('must implement "renderSurface"');
		});

		test("rejects a renderSurface no host can find", () => {
			// A surface renderer with no surface silently never renders, which is the
			// failure mode this mechanism exists to remove.
			const { surfaces: _omitted, ...withoutSurfaces } = mockRegionTool;
			expect(() =>
				registry.register({
					...withoutSurfaces,
					activation: "toolbar-toggle",
					icon: "x",
					renderToolbar: () => null,
				} as ToolRegistration),
			).toThrow('requires at least one entry in "surfaces"');
		});

		test("rejects non-string surfaces", () => {
			expect(() =>
				registry.register({
					...mockRegionTool,
					surfaces: ["item-media", " "],
				}),
			).toThrow('"surfaces" must be an array of non-empty strings');
		});

		test("still requires an icon and renderToolbar for toolbar activations", () => {
			const { icon: _icon, ...noIcon } = mockCalculatorTool;
			expect(() => registry.register(noIcon as ToolRegistration)).toThrow(
				'"icon" must be a string or function',
			);

			const { renderToolbar: _render, ...noToolbar } = mockTTSTool;
			expect(() => registry.register(noToolbar as ToolRegistration)).toThrow(
				'"renderToolbar" must be a function',
			);
		});

		test("renderForToolbar names the activation instead of failing on a missing method", () => {
			registry.register(mockRegionTool);
			const context: ToolContext = {
				level: "item",
				assessment: {} as any,
				itemRef: {} as any,
				item: {} as any,
			};
			expect(() =>
				registry.renderForToolbar("hostAlternateMedia", context, {} as any),
			).toThrow(/renders into a host surface, not a toolbar/);
		});
	});
	describe("content dependency", () => {
		const contentDependentTool: ToolRegistration = {
			toolId: "hostSignedAlternate",
			name: "Host Signed Alternate",
			description: "Host-contributed signed alternate",
			supportedLevels: ["item"],
			activation: "region",
			surfaces: ["item-media"],
			pnpSupportIds: ["hostSignLanguage", "hostSigning"],
			requiresAuthoredContent: {
				description: "a signing card on the item",
				resolve: (context) => context.catalogs?.cards[0]?.card.content ?? null,
			},
			isVisibleInContext: () => true,
			renderSurface: () => ({ element: {} as any }),
		};

		test("resolves content the host hands straight back", () => {
			registry.register(contentDependentTool);
			const tool = registry.get("hostSignedAlternate");

			// The host never inspects the result; it passes it through to
			// renderSurface. That is what keeps it from knowing which accommodation
			// it is resolving.
			expect(
				tool?.requiresAuthoredContent?.resolve({
					featureId: "hostSignLanguage",
					catalogs: {
						cards: [
							{
								catalogId: "prompt",
								card: { catalog: "sign-language", content: "a-card" },
							},
						],
					},
					granted: true,
				}),
			).toBe("a-card");

			expect(
				tool?.requiresAuthoredContent?.resolve({
					featureId: "hostSignLanguage",
					catalogs: { cards: [] },
					granted: true,
				}),
			).toBeNull();
		});

		test("exposes content-dependent support ids for a host grant list", () => {
			// The structural replacement for the compile-time exclusion array: a host
			// filters on the declaration, so it can add its own accommodation.
			registry.register(contentDependentTool);
			registry.register(mockCalculatorTool);

			expect(registry.getContentDependentSupportIds()).toEqual([
				"hostSignLanguage",
				"hostSigning",
			]);
		});

		test("reports the dependency in tool metadata", () => {
			registry.register(contentDependentTool);
			const meta = registry
				.getToolMetadata()
				.find((entry) => entry.toolId === "hostSignedAlternate");
			expect(meta?.requiresAuthoredContent).toBe(true);
			expect(meta?.contentDependencyDescription).toBe(
				"a signing card on the item",
			);
		});

		test("reports no dependency for a capability without one", () => {
			registry.register(mockCalculatorTool);
			const meta = registry
				.getToolMetadata()
				.find((entry) => entry.toolId === "calculator");
			expect(meta?.requiresAuthoredContent).toBe(false);
			expect(meta?.contentDependencyDescription).toBeNull();
			expect(registry.getContentDependentSupportIds()).toEqual([]);
		});

		test("rejects a dependency with no resolve function", () => {
			expect(() =>
				registry.register({
					...contentDependentTool,
					requiresAuthoredContent: { description: "x" } as any,
				}),
			).toThrow('must be an object with a "resolve" function');
		});

		test("rejects a dependency with no support id to filter on", () => {
			// Declaring a content dependency with no support id would silently drop
			// the keep-it-out-of-a-wholesale-grant guarantee.
			const { pnpSupportIds: _omitted, ...withoutSupportIds } =
				contentDependentTool;
			expect(() =>
				registry.register(withoutSupportIds as ToolRegistration),
			).toThrow('requires at least one entry in "pnpSupportIds"');
		});
	});
});
