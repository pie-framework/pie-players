import { describe, expect, test } from "bun:test";
import {
	createPackagedToolRegistry,
	DEFAULT_TOOL_MODULE_LOADERS,
	ITEM_TOOL_MODULE_LOADERS,
	PACKAGED_TOOL_ORDER,
	PACKAGED_TOOL_PLACEMENT,
	PACKAGED_TOOL_REGISTRATIONS,
	PACKAGED_TOOL_TAG_MAP,
	SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT,
	SECTION_TOOL_MODULE_LOADERS,
	UNIVERSAL_SUPPORTS_PRESET,
} from "../src/index";
import { assertPackagedCapabilityComposition } from "../src/packaged-capability-composition";

const collectPlacementIds = (
	placement: Record<string, readonly string[]>,
): string[] => Object.values(placement).flatMap((toolIds) => [...toolIds]);

describe("packaged capability composition", () => {
	test("passes the strict release-time composition invariants", () => {
		expect(() => assertPackagedCapabilityComposition()).not.toThrow();
	});

	test("projects every public catalogue facet from one coherent capability set", () => {
		const registeredIds = new Set(
			PACKAGED_TOOL_REGISTRATIONS.map(({ toolId }) => toolId),
		);
		const projectedIds = [
			...Object.keys(PACKAGED_TOOL_TAG_MAP),
			...Object.keys(DEFAULT_TOOL_MODULE_LOADERS),
			...PACKAGED_TOOL_ORDER,
			...collectPlacementIds(PACKAGED_TOOL_PLACEMENT),
			...collectPlacementIds(SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT),
		];

		expect(registeredIds.size).toBe(PACKAGED_TOOL_REGISTRATIONS.length);
		for (const toolId of projectedIds) {
			expect(registeredIds.has(toolId)).toBe(true);
		}
	});

	test("keeps loader subsets as projections of the default loader map", () => {
		for (const [toolId, loader] of Object.entries({
			...ITEM_TOOL_MODULE_LOADERS,
			...SECTION_TOOL_MODULE_LOADERS,
		})) {
			expect(DEFAULT_TOOL_MODULE_LOADERS[toolId]).toBe(loader);
			expect(PACKAGED_TOOL_TAG_MAP[toolId]).toBeDefined();
		}
	});

	test("keeps region capabilities out of element and toolbar projections", () => {
		const transcript = PACKAGED_TOOL_REGISTRATIONS.find(
			({ toolId }) => toolId === "transcript",
		);
		expect(transcript?.activation).toBe("region");
		expect(PACKAGED_TOOL_TAG_MAP.transcript).toBeUndefined();
		expect(DEFAULT_TOOL_MODULE_LOADERS.transcript).toBeUndefined();
		expect(PACKAGED_TOOL_ORDER).not.toContain("transcript");
		expect(collectPlacementIds(PACKAGED_TOOL_PLACEMENT)).not.toContain(
			"transcript",
		);
		expect(
			collectPlacementIds(SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT),
		).not.toContain("transcript");
		expect(UNIVERSAL_SUPPORTS_PRESET).not.toContain("transcript");
	});

	test("retains fail-soft host selection while registering every known selection", () => {
		const selected = createPackagedToolRegistry({
			toolIds: ["calculator", "hostCapabilityNotInThisPackage"],
		});
		expect(selected.getAllTools().map(({ toolId }) => toolId)).toEqual([
			"calculator",
		]);

		// An empty selection has always meant "use the packaged set", not "none".
		expect(
			createPackagedToolRegistry({ toolIds: [] }).getAllTools(),
		).toHaveLength(PACKAGED_TOOL_REGISTRATIONS.length);
	});

	test("retains registration overrides without changing unrelated capabilities", () => {
		const calculator = PACKAGED_TOOL_REGISTRATIONS.find(
			({ toolId }) => toolId === "calculator",
		);
		expect(calculator).toBeDefined();
		if (!calculator) return;

		const overridden = {
			...calculator,
			supportedLevels: ["section" as const],
		};
		const registry = createPackagedToolRegistry({
			overrides: { calculator: overridden },
		});

		expect(registry.get("calculator")).toBe(overridden);
		expect(registry.get("textToSpeech")).toBe(
			PACKAGED_TOOL_REGISTRATIONS.find(
				({ toolId }) => toolId === "textToSpeech",
			),
		);
	});
});
