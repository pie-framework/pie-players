import { describe, expect, mock, test } from "bun:test";

mock.module("@pie-players/pie-item-player", () => ({
	ensureItemPlayerMathRenderingReady: async () => undefined,
}));

async function loadViewStateModule() {
	return import("../src/components/shared/section-player-view-state");
}

describe("section player view state", () => {
	test("forces embedded item strategy to preloaded when section strategy is iife", async () => {
		const { getItemPlayerParams } = await loadViewStateModule();
		const params = getItemPlayerParams({
			item: {
				id: "item-1",
				config: {
					elements: {
						"pie-multiple-choice": "@pie-element/multiple-choice@1.0.0",
					},
				},
			} as any,
			compositionModel: {
				itemSessions: {},
				itemViewModels: [],
			} as any,
			resolvedPlayerEnv: { mode: "gather", role: "student" },
			resolvedPlayerAttributes: { strategy: "iife" },
			resolvedPlayerProps: {},
			playerStrategy: "iife",
		});

		expect(params.attributes?.strategy).toBe("preloaded");
	});

	test("keeps embedded strategy aligned for non-iife section strategies", async () => {
		const { getPassagePlayerParams } = await loadViewStateModule();
		const params = getPassagePlayerParams({
			passage: { config: {} } as any,
			resolvedPlayerEnv: { mode: "gather", role: "student" },
			resolvedPlayerAttributes: { strategy: "esm" },
			resolvedPlayerProps: {},
			playerStrategy: "esm",
		});

		expect(params.attributes?.strategy).toBe("esm");
	});
});
