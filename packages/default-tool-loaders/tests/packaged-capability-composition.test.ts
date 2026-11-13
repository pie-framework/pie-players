import { describe, expect, spyOn, test } from "bun:test";
import { ToolRegistry } from "@pie-players/pie-assessment-toolkit";
import { resolveFallbackToolIcon } from "@pie-players/pie-assessment-toolkit/tools/registration";
import {
	createPackagedToolRegistry,
	createUniversalPersonalNeedsProfile,
	DEFAULT_TOOL_MODULE_LOADERS,
	PACKAGED_TOOL_REGISTRATIONS,
	PACKAGED_TOOL_TAG_MAP,
	SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT,
} from "../src/index";
import { assertPackagedCapabilityComposition } from "../src/packaged-capability-composition";
import { resolveToolbarFaGlyph } from "../src/registrations/toolbar-glyphs";

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
			...collectPlacementIds(SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT),
		];

		expect(registeredIds.size).toBe(PACKAGED_TOOL_REGISTRATIONS.length);
		for (const toolId of projectedIds) {
			expect(registeredIds.has(toolId)).toBe(true);
		}
	});

	test("names a built-in icon for every packaged toolbar button", () => {
		// An icon-only toolbar button whose name has no built-in markup renders as a
		// blank square. A region-activated capability renders no button.
		const buttons = PACKAGED_TOOL_REGISTRATIONS.filter(
			(registration) => registration.renderToolbar,
		);
		const missing = buttons
			.filter(
				({ icon }) =>
					typeof icon !== "string" || resolveFallbackToolIcon(icon) === null,
			)
			.map(({ toolId, icon }) => `${toolId}: ${String(icon)}`);
		expect(buttons.length).toBeGreaterThan(10);
		expect(missing).toEqual([]);
	});

	test("gives every packaged toolbar button a FontAwesome glyph", () => {
		// A button without one keeps the toolbar's square button when the host
		// enables NDS icons, beside the circular NDS buttons of the rest.
		const missing = PACKAGED_TOOL_REGISTRATIONS.filter(
			(registration) => registration.renderToolbar,
		)
			.filter(
				({ icon }) =>
					typeof icon !== "string" || resolveToolbarFaGlyph(icon) === undefined,
			)
			.map(({ toolId, icon }) => `${toolId}: ${String(icon)}`);
		expect(missing).toEqual([]);
	});

	test("gives every loaded capability an element tag", () => {
		for (const toolId of Object.keys(DEFAULT_TOOL_MODULE_LOADERS)) {
			expect(PACKAGED_TOOL_TAG_MAP[toolId]).toBeDefined();
		}
	});

	test("keeps region capabilities out of element and placement projections", () => {
		const transcript = PACKAGED_TOOL_REGISTRATIONS.find(
			({ toolId }) => toolId === "transcript",
		);
		expect(transcript?.activation).toBe("region");
		expect(PACKAGED_TOOL_TAG_MAP.transcript).toBeUndefined();
		expect(DEFAULT_TOOL_MODULE_LOADERS.transcript).toBeUndefined();
		expect(
			collectPlacementIds(SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT),
		).not.toContain("transcript");
		expect(createUniversalPersonalNeedsProfile().supports).not.toContain(
			"transcript",
		);
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

	test("installs the packaged loaders unless toolModuleLoaders replaces them", () => {
		const install = spyOn(ToolRegistry.prototype, "setToolModuleLoaders");
		try {
			createPackagedToolRegistry();
			createPackagedToolRegistry({ toolModuleLoaders: {} });
			const ruler = async () => {};
			createPackagedToolRegistry({ toolModuleLoaders: { ruler } });
			expect(install.mock.calls.map(([loaders]) => loaders)).toEqual([
				{ ...DEFAULT_TOOL_MODULE_LOADERS },
				{},
				{ ruler },
			]);
		} finally {
			install.mockRestore();
		}
	});
});
