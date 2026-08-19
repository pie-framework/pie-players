import { describe, expect, it } from "bun:test";
import type { ToolSurfaceServices } from "@pie-players/pie-assessment-toolkit/tools/internal";
import { buildSelectionActions } from "../src/registrations/selection-actions.js";

type Requested = { toolId: string; params?: Record<string, unknown> };

function services(coordinator: unknown): ToolSurfaceServices {
	return {
		toolkitCoordinator: coordinator,
		ttsService: null,
		catalogResolver: null,
	} as unknown as ToolSurfaceServices;
}

function requestCapable(hosted: string[]) {
	const requested: Requested[] = [];
	return {
		requested,
		coordinator: {
			canRequestTool: (toolId: string) => hosted.includes(toolId),
			requestTool: (request: Requested) => {
				requested.push(request);
				return true;
			},
		},
	};
}

describe("buildSelectionActions", () => {
	it("offers the dictionaries, in the order the toolbar shows them", () => {
		const { coordinator } = requestCapable(["dictionary", "pictureDictionary"]);
		const actions = buildSelectionActions(services(coordinator));
		expect(actions.map((action) => action.id)).toEqual([
			"dictionary",
			"pictureDictionary",
		]);
	});

	it("names the selection in each accessible name, as the strip's own controls do", () => {
		const { coordinator } = requestCapable(["dictionary"]);
		const [dictionary] = buildSelectionActions(services(coordinator));
		expect(dictionary.label).toContain("selected text");
	});

	// The icon has to be the one the tool's toolbar button draws, or the learner sees
	// two unrelated affordances for the same tool.
	it("carries the same built-in icon markup the toolbar button uses", () => {
		const { coordinator } = requestCapable(["dictionary"]);
		const [dictionary] = buildSelectionActions(services(coordinator));
		expect(dictionary.iconSvg).toContain("<svg");
	});

	it("asks availability live, so a tool the PNP stops granting stops being offered", () => {
		const hosted = ["dictionary"];
		const coordinator = {
			canRequestTool: (toolId: string) => hosted.includes(toolId),
			requestTool: () => true,
		};
		const [dictionary] = buildSelectionActions(services(coordinator));

		expect(dictionary.isAvailable?.()).toBe(true);
		hosted.length = 0;
		expect(dictionary.isAvailable?.()).toBe(false);
	});

	it("requests the tool with the selected text as its term", () => {
		const { coordinator, requested } = requestCapable(["dictionary"]);
		const [dictionary] = buildSelectionActions(services(coordinator));

		dictionary.run({ text: "chloroplast", range: null });

		expect(requested).toEqual([
			{ toolId: "dictionary", params: { term: "chloroplast" } },
		]);
	});

	it("spends no request on a selection that is only whitespace", () => {
		const { coordinator, requested } = requestCapable(["dictionary"]);
		const [dictionary] = buildSelectionActions(services(coordinator));

		dictionary.run({ text: "   ", range: null });

		expect(requested).toEqual([]);
	});

	// A host may hand the gateway a coordinator predating the request seam. Offering
	// an action it cannot service would put a dead button in front of a learner.
	it("offers nothing when the coordinator cannot service a request", () => {
		expect(buildSelectionActions(services(null))).toEqual([]);
		expect(buildSelectionActions(services({}))).toEqual([]);
		expect(
			buildSelectionActions(services({ canRequestTool: () => true })),
		).toEqual([]);
	});
});
