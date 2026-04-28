import { describe, expect, mock, test } from "bun:test";

mock.module("@pie-players/pie-item-player", () => ({
	ensureItemPlayerMathRenderingReady: async () => undefined,
}));

async function loadViewStateModule() {
	return import("../src/components/shared/section-player-view-state");
}

describe("section player view state", () => {
	// The section-player used to substitute `iife` -> `preloaded` for
	// embedded item-players. That parent-to-child strategy coupling was the
	// root cause of the sporadic "missing tags" section-swap race. With the
	// deep ElementLoader primitive the strategy is propagated verbatim; the
	// item-player independently calls ensureRegistered and no longer
	// depends on a cached readiness claim from the section.
	test("propagates iife strategy verbatim to embedded items (no substitution)", async () => {
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

		expect(params.attributes?.strategy).toBe("iife");
	});

	test("propagates esm strategy verbatim to embedded passages", async () => {
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

	test("propagates preloaded strategy verbatim to embedded items", async () => {
		const { getItemPlayerParams } = await loadViewStateModule();
		const params = getItemPlayerParams({
			item: { id: "item-1", config: {} } as any,
			compositionModel: {
				itemSessions: {},
				itemViewModels: [],
			} as any,
			resolvedPlayerEnv: {},
			resolvedPlayerAttributes: {},
			resolvedPlayerProps: {},
			playerStrategy: "preloaded",
		});

		expect(params.attributes?.strategy).toBe("preloaded");
	});
});
