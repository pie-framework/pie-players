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
			overlayElement: { className: "pie-tool-calculator" } as any,
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
			overlayElement: { className: "tts-tool" } as any,
		};
	},
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
			});
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

	describe("renderForToolbar", () => {
		const toolbarContext: ToolbarContext = {
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
			ensureTTSReady: null,
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
			expect(renderResult?.overlayElement?.className).toBe("pie-tool-calculator");
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
});
