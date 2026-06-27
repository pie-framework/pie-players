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

	test("derives concrete backend delivery identity for embedded items", async () => {
		const { getItemPlayerParams } = await loadViewStateModule();
		const params = getItemPlayerParams({
			item: { id: "source-item-1", config: {} } as any,
			compositionModel: {
				itemSessions: {},
				itemViewModels: [
					{
						itemId: "source-item-1",
						canonicalItemId: "canonical-item-1",
						session: { id: "item-session-1", data: [] },
					},
				],
			} as any,
			resolvedPlayerEnv: { mode: "gather", role: "student" },
			resolvedPlayerAttributes: {},
			resolvedPlayerProps: {
				backend: {
					delivery: {
						enabled: true,
						baseUrl: "/qe",
						assignmentId: "attempt-1",
						endpoints: { load: "/api/player/load" },
						autosave: { enabled: true, debounceMs: 250 },
					},
				},
			},
			playerStrategy: "iife",
		});

		expect((params.props?.backend as any).delivery).toEqual(
			expect.objectContaining({
				enabled: true,
				baseUrl: "/qe",
				assignmentId: "attempt-1",
				itemId: "canonical-item-1",
				sessionId: "item-session-1",
			}),
		);
	});

	test("falls back to item.id when canonical item id is missing", async () => {
		const { getItemPlayerParams } = await loadViewStateModule();
		const params = getItemPlayerParams({
			item: { id: "fallback-item", config: {} } as any,
			compositionModel: {
				itemSessions: {},
				itemViewModels: [],
			} as any,
			resolvedPlayerEnv: {},
			resolvedPlayerAttributes: {},
			resolvedPlayerProps: {
				backend: {
					delivery: {
						enabled: true,
						baseUrl: "/qe",
					},
				},
			},
			playerStrategy: "iife",
		});

		expect((params.props?.backend as any).delivery.itemId).toBe(
			"fallback-item",
		);
	});

	test("overwrites shared delivery identity with concrete embedded item identity", async () => {
		const { getItemPlayerParams } = await loadViewStateModule();
		const baseArgs = {
			compositionModel: {
				itemSessions: {},
				itemViewModels: [
					{
						itemId: "source-a",
						canonicalItemId: "canonical-a",
						session: { id: "session-a", data: [] },
					},
					{
						itemId: "source-b",
						canonicalItemId: "canonical-b",
						session: { id: "session-b", data: [] },
					},
				],
			} as any,
			resolvedPlayerEnv: {},
			resolvedPlayerAttributes: {},
			resolvedPlayerProps: {
				backend: {
					delivery: {
						enabled: true,
						baseUrl: "/qe",
						itemId: "shared-static-item",
						sessionId: "shared-static-session",
						assignmentId: "attempt-1",
					},
				},
			},
			playerStrategy: "iife",
		};

		const first = getItemPlayerParams({
			...baseArgs,
			item: { id: "source-a", config: {} } as any,
		});
		const second = getItemPlayerParams({
			...baseArgs,
			item: { id: "source-b", config: {} } as any,
		});

		expect((first.props?.backend as any).delivery).toEqual(
			expect.objectContaining({
				itemId: "canonical-a",
				sessionId: "session-a",
				assignmentId: "attempt-1",
			}),
		);
		expect((second.props?.backend as any).delivery).toEqual(
			expect.objectContaining({
				itemId: "canonical-b",
				sessionId: "session-b",
				assignmentId: "attempt-1",
			}),
		);
	});

	test("passes absent item session as undefined to resolveBackend", async () => {
		const { getItemPlayerParams } = await loadViewStateModule();
		const resolveBackend = mock((context: any, baseBackend: any) => baseBackend);

		const params = getItemPlayerParams({
			item: { id: "item-without-session", config: {} } as any,
			compositionModel: {
				itemSessions: {},
				itemViewModels: [],
			} as any,
			resolvedPlayerEnv: {},
			resolvedPlayerAttributes: {},
			resolvedPlayerProps: {
				backend: {
					delivery: {
						enabled: true,
						baseUrl: "/qe",
					},
				},
				resolveBackend,
			},
			playerStrategy: "iife",
		});

		expect(params.session).toEqual({ id: "", data: [] });
		expect(resolveBackend).toHaveBeenCalledTimes(1);
		expect(resolveBackend.mock.calls[0]?.[0].itemSession).toBeUndefined();
	});

	test("does not synthesize a custom delivery client when merging resolver overrides", async () => {
		const { getItemPlayerParams } = await loadViewStateModule();
		const params = getItemPlayerParams({
			item: { id: "source-item-1", config: {} } as any,
			compositionModel: {
				itemSessions: {},
				itemViewModels: [],
			} as any,
			resolvedPlayerEnv: {},
			resolvedPlayerAttributes: {},
			resolvedPlayerProps: {
				backend: {
					delivery: {
						enabled: true,
						baseUrl: "/qe",
						endpoints: { load: "/load" },
					},
				},
				resolveBackend: (_context: any, baseBackend: any) => ({
					...baseBackend,
					delivery: {
						...baseBackend.delivery,
						endpoints: {
							...baseBackend.delivery.endpoints,
							saveSession: "/save",
						},
					},
				}),
			},
			playerStrategy: "iife",
		});

		expect((params.props?.backend as any).delivery.client).toBeUndefined();
		expect((params.props?.backend as any).delivery.endpoints).toEqual({
			load: "/load",
			saveSession: "/save",
		});
	});

	test("lets resolveBackend override identity without mutating shared runtime props", async () => {
		const { getItemPlayerParams } = await loadViewStateModule();
		const sharedBackend = {
			delivery: {
				enabled: true,
				baseUrl: "/qe",
				assignmentId: "attempt-1",
			},
		};
		const resolveBackend = (context: any, baseBackend: any) => {
			baseBackend.delivery.itemId = "mutated-inside-resolver";
			return {
				...baseBackend,
				delivery: {
					...baseBackend.delivery,
					itemId: `resolved-${context.itemIndex}-${context.itemId}`,
				},
			};
		};
		const baseArgs = {
			compositionModel: {
				itemSessions: {},
				itemViewModels: [],
			} as any,
			resolvedPlayerEnv: { mode: "gather", role: "student" },
			resolvedPlayerAttributes: {},
			resolvedPlayerProps: {
				backend: sharedBackend,
				resolveBackend,
			},
			playerStrategy: "iife",
		};

		const first = getItemPlayerParams({
			...baseArgs,
			item: { id: "item-a", config: {} } as any,
		});
		const second = getItemPlayerParams({
			...baseArgs,
			item: { id: "item-b", config: {} } as any,
		});

		expect((first.props?.backend as any).delivery.itemId).toBe(
			"resolved-0-item-a",
		);
		expect((second.props?.backend as any).delivery.itemId).toBe(
			"resolved-0-item-b",
		);
		expect(sharedBackend).toEqual({
			delivery: {
				enabled: true,
				baseUrl: "/qe",
				assignmentId: "attempt-1",
			},
		});
		expect(first.props).not.toHaveProperty("resolveBackend");
	});

	test("strips item delivery backend from embedded passages but keeps shared backend props", async () => {
		const { getPassagePlayerParams } = await loadViewStateModule();
		const params = getPassagePlayerParams({
			passage: { config: {} } as any,
			resolvedPlayerEnv: { mode: "gather", role: "student" },
			resolvedPlayerAttributes: { strategy: "iife" },
			resolvedPlayerProps: {
				backend: {
					auth: { token: "shared-token" },
					delivery: {
						enabled: true,
						baseUrl: "/qe",
					},
					authoring: {
						enabled: true,
						baseUrl: "/authoring",
					},
				},
				resolveBackend: () => ({}),
				loaderOptions: { bundleHost: "https://proxy.pie-api.com/bundles" },
				customRuntimeProp: "keep-me",
			},
			playerStrategy: "iife",
		});

		expect((params.props?.backend as any).delivery).toBeUndefined();
		expect((params.props?.backend as any).auth).toEqual({
			token: "shared-token",
		});
		expect((params.props?.backend as any).authoring).toEqual({
			enabled: true,
			baseUrl: "/authoring",
		});
		expect(params.props).not.toHaveProperty("resolveBackend");
		expect(params.props?.loaderOptions).toEqual({
			bundleHost: "https://proxy.pie-api.com/bundles",
		});
		expect(params.props?.customRuntimeProp).toBe("keep-me");
	});

	test("preserves PIE contract ids, versioned tags, and contract attributes", async () => {
		const { getItemPlayerParams } = await loadViewStateModule();
		const params = getItemPlayerParams({
			item: {
				id: "item-source",
				config: {
					markup:
						'<pie-custom--version-1-2-3 id="Model_ID-1" data-pie-owned="yes"></pie-custom--version-1-2-3>',
				},
			} as any,
			compositionModel: {
				itemSessions: {},
				itemViewModels: [
					{
						itemId: "item-source",
						canonicalItemId: "Item_ID--Version-1",
						session: {
							id: "Session_ID--Version-1",
							data: [
								{
									id: "Model_ID-1",
									element: "pie-custom--version-1-2-3",
									value: "kept",
								},
							],
						},
					},
				],
			} as any,
			resolvedPlayerEnv: {},
			resolvedPlayerAttributes: {
				"data-pie-contract": "keep",
				"aria-label": "Contract Item",
				"pie-mode": "delivery",
			},
			resolvedPlayerProps: {
				backend: { delivery: { enabled: true, baseUrl: "/qe" } },
			},
			playerStrategy: "iife",
		});

		expect((params.props?.backend as any).delivery.itemId).toBe(
			"Item_ID--Version-1",
		);
		expect((params.props?.backend as any).delivery.sessionId).toBe(
			"Session_ID--Version-1",
		);
		expect(params.session?.data).toEqual([
			{
				id: "Model_ID-1",
				element: "pie-custom--version-1-2-3",
				value: "kept",
			},
		]);
		expect(params.attributes).toEqual(
			expect.objectContaining({
				"data-pie-contract": "keep",
				"aria-label": "Contract Item",
				"pie-mode": "delivery",
				strategy: "iife",
			}),
		);
	});
});
