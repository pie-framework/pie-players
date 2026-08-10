/**
 * Section-player host-runtime tests (post M7 PR 7).
 *
 * Covers the player-coupled helpers that stay in section-player after
 * the M7 rip-out:
 *
 *   - `resolvePlayerRuntime` — depends on `DEFAULT_PLAYER_DEFINITIONS`
 *     (which side-effect-imports `@pie-players/pie-item-player`), so
 *     it cannot move into the toolkit-side engine resolver.
 *   - `resolveSectionPlayerRuntimeState` — thin wrapper over the
 *     toolkit's `resolveSectionEngineRuntimeState` that supplies the
 *     local `resolvePlayerRuntime`. Pinning propagation here proves the
 *     wrapper still threads handlers through the engine-side orchestrator.
 *
 * The pure runtime resolver behavior of `resolveRuntime`,
 * `resolveToolsConfig`, and callback precedence lives in
 * `packages/assessment-toolkit/tests/runtime/core/engine-resolver.test.ts`
 * (re-pointed in M7 PR 1). This file deliberately does not re-cover
 * those — they have a single source of truth in the toolkit suite.
 */

import { describe, expect, mock, test } from "bun:test";

mock.module("@pie-players/pie-item-player", () => ({
	ensureItemPlayerMathRenderingReady: async () => undefined,
}));

async function loadHostRuntime() {
	return import("../src/components/shared/section-player-host-runtime");
}

describe("resolvePlayerRuntime", () => {
	test("forwards runtime player.loaderConfig into resolved player props", async () => {
		const { resolvePlayerRuntime } = await loadHostRuntime();
		const instrumentationProvider = {
			providerId: "custom",
			providerName: "Custom",
			initialize: async () => {},
			trackError: () => {},
			trackEvent: () => {},
			destroy: () => {},
			isReady: () => true,
		};
		const loaderConfig = {
			trackPageActions: true,
			instrumentationProvider,
		};

		const runtime = resolvePlayerRuntime({
			effectiveRuntime: {
				playerType: "iife",
				player: {
					loaderConfig,
				},
			},
			playerType: "iife",
			env: null,
		});

		expect((runtime.resolvedPlayerProps as any).loaderConfig).toBe(
			loaderConfig,
		);
		expect(
			(runtime.resolvedPlayerProps as any).loaderConfig.instrumentationProvider,
		).toBe(instrumentationProvider);
	});

	test("merges runtime loaderOptions with strategy defaults", async () => {
		const { resolvePlayerRuntime } = await loadHostRuntime();
		const runtime = resolvePlayerRuntime({
			effectiveRuntime: {
				playerType: "iife",
				player: {
					loaderOptions: {
						moduleResolution: "import-map",
					},
				},
			},
			playerType: "iife",
			env: null,
		});

		expect((runtime.resolvedPlayerProps as any).loaderOptions.bundleHost).toBe(
			"https://proxy.pie-api.com/bundles",
		);
		expect(
			(runtime.resolvedPlayerProps as any).loaderOptions.moduleResolution,
		).toBe("import-map");
	});

	test("passes backend config through resolved player props unchanged", async () => {
		const { resolvePlayerRuntime } = await loadHostRuntime();
		const backend = {
			delivery: {
				enabled: true,
				itemId: "item-1",
				sessionId: "session-1",
			},
		};
		const runtime = resolvePlayerRuntime({
			effectiveRuntime: {
				playerType: "iife",
				player: {
					backend,
				},
			},
			playerType: "iife",
			env: null,
		});

		expect((runtime.resolvedPlayerProps as any).backend).toBe(backend);
	});

	test("defaults hosted mode on when delivery backend is enabled", async () => {
		const { resolvePlayerRuntime } = await loadHostRuntime();
		const runtime = resolvePlayerRuntime({
			effectiveRuntime: {
				playerType: "iife",
				player: {
					backend: {
						delivery: {
							enabled: true,
							itemId: "item-1",
							sessionId: "session-1",
						},
					},
				},
			},
			playerType: "iife",
			env: null,
		});

		expect((runtime.resolvedPlayerProps as any).hosted).toBe(true);
	});

	test("does not default hosted mode on when delivery backend is disabled", async () => {
		const { resolvePlayerRuntime } = await loadHostRuntime();
		const runtime = resolvePlayerRuntime({
			effectiveRuntime: {
				playerType: "iife",
				player: {
					backend: {
						delivery: {
							enabled: false,
							itemId: "item-1",
							sessionId: "session-1",
						},
					},
				},
			},
			playerType: "iife",
			env: null,
		});

		expect((runtime.resolvedPlayerProps as any).hosted).toBeUndefined();
	});

	test("preserves explicit hosted override when delivery backend is enabled", async () => {
		const { resolvePlayerRuntime } = await loadHostRuntime();
		const runtime = resolvePlayerRuntime({
			effectiveRuntime: {
				playerType: "iife",
				player: {
					hosted: false,
					backend: {
						delivery: {
							enabled: true,
							itemId: "item-1",
							sessionId: "session-1",
						},
					},
				},
			},
			playerType: "iife",
			env: null,
		});

		expect((runtime.resolvedPlayerProps as any).hosted).toBe(false);
	});
});

describe("resolveSectionPlayerRuntimeState", () => {
	test("propagates onFrameworkError into effectiveRuntime", async () => {
		const { resolveSectionPlayerRuntimeState } = await loadHostRuntime();
		const handler = () => {};
		const state = resolveSectionPlayerRuntimeState({
			assessmentId: "a1",
			toolConfigStrictness: "error",
			onFrameworkError: handler,
			runtime: null,
		});
		expect((state.effectiveRuntime as any).onFrameworkError).toBe(handler);
	});

	test("propagates onStageChange into effectiveRuntime", async () => {
		const { resolveSectionPlayerRuntimeState } = await loadHostRuntime();
		const handler = () => {};
		const state = resolveSectionPlayerRuntimeState({
			assessmentId: "a1",
			toolConfigStrictness: "error",
			onStageChange: handler,
			runtime: null,
		});
		expect((state.effectiveRuntime as any).onStageChange).toBe(handler);
	});

	test("propagates onLoadingComplete into effectiveRuntime", async () => {
		const { resolveSectionPlayerRuntimeState } = await loadHostRuntime();
		const handler = () => {};
		const state = resolveSectionPlayerRuntimeState({
			assessmentId: "a1",
			toolConfigStrictness: "error",
			onLoadingComplete: handler,
			runtime: null,
		});
		expect((state.effectiveRuntime as any).onLoadingComplete).toBe(handler);
	});

	test("runtime.onStageChange wins over the top-level prop", async () => {
		const { resolveSectionPlayerRuntimeState } = await loadHostRuntime();
		const fromRuntime = () => {};
		const fromProp = () => {};
		const state = resolveSectionPlayerRuntimeState({
			assessmentId: "a1",
			toolConfigStrictness: "error",
			onStageChange: fromProp,
			runtime: { onStageChange: fromRuntime },
		});
		expect((state.effectiveRuntime as any).onStageChange).toBe(fromRuntime);
	});

	test("runtime.onLoadingComplete wins over the top-level prop", async () => {
		const { resolveSectionPlayerRuntimeState } = await loadHostRuntime();
		const fromRuntime = () => {};
		const fromProp = () => {};
		const state = resolveSectionPlayerRuntimeState({
			assessmentId: "a1",
			toolConfigStrictness: "error",
			onLoadingComplete: fromProp,
			runtime: { onLoadingComplete: fromRuntime },
		});
		expect((state.effectiveRuntime as any).onLoadingComplete).toBe(fromRuntime);
	});

	test("threads through resolved playerRuntime so the host can read both halves at once", async () => {
		const { resolveSectionPlayerRuntimeState } = await loadHostRuntime();
		const state = resolveSectionPlayerRuntimeState({
			assessmentId: "a1",
			toolConfigStrictness: "error",
			runtime: {
				playerType: "iife",
				env: {
					mode: "gather",
					"@pie-element": { lockChoiceOrder: true },
				},
			},
		});
		expect(state.playerRuntime.effectivePlayerType).toBe("iife");
		expect(state.playerRuntime.resolvedPlayerTag).toBeDefined();
		expect(state.playerRuntime.resolvedPlayerEnv).toEqual({
			mode: "gather",
			"@pie-element": { lockChoiceOrder: true },
		});
		expect(state.effectiveRuntime).toBeDefined();
		expect(state.effectiveToolsConfig).toBeDefined();
	});
});

describe("mapRenderablesToItems", () => {
	test("flattens composition entries to their `entity` fields", async () => {
		const { mapRenderablesToItems } = await loadHostRuntime();
		const a = { id: "a" } as unknown;
		const b = { id: "b" } as unknown;
		const result = mapRenderablesToItems([{ entity: a }, { entity: b }]);
		expect(result[0]).toBe(a as never);
		expect(result[1]).toBe(b as never);
	});

	test("returns undefined entries for renderables that omit `entity`", async () => {
		const { mapRenderablesToItems } = await loadHostRuntime();
		const result = mapRenderablesToItems([{}, { entity: { id: "ok" } }]);
		expect(result[0]).toBeUndefined();
		expect((result[1] as { id: string }).id).toBe("ok");
	});
});

/**
 * Heading depth is composition context: the section player publishes one level
 * and each content kind derives its own from it. These pin the derivation and
 * the precedence, because both are silent when wrong — a resolver that reads a
 * stale or absent level still renders, it just renders the wrong outline.
 * See `docs/architecture/composition-context.md`.
 */
describe("heading composition context", () => {
	async function loadViewState() {
		return import("../src/components/shared/section-player-view-state");
	}

	test("an invalid level falls back to the default rather than an <h0>", async () => {
		const { normalizeBaseHeadingLevel, DEFAULT_SECTION_BASE_HEADING_LEVEL } =
			await loadViewState();
		expect(normalizeBaseHeadingLevel(3)).toBe(3);
		expect(normalizeBaseHeadingLevel("4")).toBe(4);
		for (const bad of [0, 7, -1, 2.5, "x", null, undefined, {}]) {
			expect(normalizeBaseHeadingLevel(bad)).toBe(
				DEFAULT_SECTION_BASE_HEADING_LEVEL,
			);
		}
	});

	test("an item card heading fills the item's slot, so the element adds none", async () => {
		const { itemHeadingContext } = await loadViewState();
		expect(itemHeadingContext(2)).toEqual({
			baseHeadingLevel: 2,
			includeSrHeading: false,
		});
	});

	test("a passage card heading is a group label, so the title sits below it", async () => {
		const { passageHeadingContext } = await loadViewState();
		expect(passageHeadingContext(2)).toEqual({ baseHeadingLevel: 3 });
		// Clamped: an h7 is not a heading.
		expect(passageHeadingContext(6)).toEqual({ baseHeadingLevel: 6 });
	});

	test("the two content kinds derive different levels from one published value", async () => {
		const { getItemPlayerParams, getPassagePlayerParams } = await loadViewState();
		const shared = {
			resolvedPlayerEnv: {},
			resolvedPlayerAttributes: {},
			resolvedPlayerProps: {},
			playerStrategy: "iife",
			baseHeadingLevel: 3 as const,
		};
		const item = getItemPlayerParams({
			item: { id: "i1", config: {} } as never,
			compositionModel: {
				items: [],
				passages: [],
				itemViewModels: [],
				sessions: [],
			} as never,
			...shared,
		});
		const passage = getPassagePlayerParams({
			passage: { id: "p1", config: {} },
			...shared,
		});
		expect(item.props?.baseHeadingLevel).toBe(3);
		expect(item.props?.includeSrHeading).toBe(false);
		expect(passage.props?.baseHeadingLevel).toBe(4);
	});

	test("a host naming either prop through runtime.player wins", async () => {
		const { getItemPlayerParams, getPassagePlayerParams } = await loadViewState();
		const shared = {
			resolvedPlayerEnv: {},
			resolvedPlayerAttributes: {},
			// What `runtime.player` resolves into.
			resolvedPlayerProps: { baseHeadingLevel: 5, includeSrHeading: true },
			playerStrategy: "iife",
			baseHeadingLevel: 2 as const,
		};
		const item = getItemPlayerParams({
			item: { id: "i1", config: {} } as never,
			compositionModel: {
				items: [],
				passages: [],
				itemViewModels: [],
				sessions: [],
			} as never,
			...shared,
		});
		const passage = getPassagePlayerParams({
			passage: { id: "p1", config: {} },
			...shared,
		});
		expect(item.props?.baseHeadingLevel).toBe(5);
		expect(item.props?.includeSrHeading).toBe(true);
		expect(passage.props?.baseHeadingLevel).toBe(5);
	});
});
