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
 *     local `resolvePlayerRuntime`. Pinning the propagation +
 *     precedence behavior here proves the wrapper still threads
 *     handlers through the engine-side orchestrator unchanged.
 *
 * The pure two-tier-mirror behavior of `resolveRuntime`,
 * `resolveToolsConfig`, and the per-key precedence rule lives in
 * `packages/assessment-toolkit/tests/runtime/core/engine-resolver.test.ts`
 * (re-pointed in M7 PR 1). This file deliberately does not re-cover
 * those — they have a single source of truth in the toolkit suite.
 */

import { describe, expect, mock, test } from "bun:test";

mock.module("@pie-players/pie-item-player", () => ({}));

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

		expect((runtime.resolvedPlayerProps as any).loaderConfig).toBe(loaderConfig);
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
		expect((runtime.resolvedPlayerProps as any).loaderOptions.moduleResolution).toBe(
			"import-map",
		);
	});
});

describe("resolveSectionPlayerRuntimeState", () => {
	test("propagates onFrameworkError into effectiveRuntime", async () => {
		const { resolveSectionPlayerRuntimeState } = await loadHostRuntime();
		const handler = () => {};
		const state = resolveSectionPlayerRuntimeState({
			assessmentId: "a1",
			playerType: "iife",
			player: null,
			lazyInit: true,
			tools: null,
			accessibility: null,
			coordinator: null,
			env: null,
			toolConfigStrictness: "error",
			onFrameworkError: handler,
			runtime: null,
			enabledTools: "",
		});
		expect((state.effectiveRuntime as any).onFrameworkError).toBe(handler);
	});

	test("propagates onStageChange into effectiveRuntime", async () => {
		const { resolveSectionPlayerRuntimeState } = await loadHostRuntime();
		const handler = () => {};
		const state = resolveSectionPlayerRuntimeState({
			assessmentId: "a1",
			playerType: "iife",
			player: null,
			lazyInit: true,
			tools: null,
			accessibility: null,
			coordinator: null,
			env: null,
			toolConfigStrictness: "error",
			onStageChange: handler,
			runtime: null,
			enabledTools: "",
		});
		expect((state.effectiveRuntime as any).onStageChange).toBe(handler);
	});

	test("propagates onLoadingComplete into effectiveRuntime", async () => {
		const { resolveSectionPlayerRuntimeState } = await loadHostRuntime();
		const handler = () => {};
		const state = resolveSectionPlayerRuntimeState({
			assessmentId: "a1",
			playerType: "iife",
			player: null,
			lazyInit: true,
			tools: null,
			accessibility: null,
			coordinator: null,
			env: null,
			toolConfigStrictness: "error",
			onLoadingComplete: handler,
			runtime: null,
			enabledTools: "",
		});
		expect((state.effectiveRuntime as any).onLoadingComplete).toBe(handler);
	});

	test("runtime.onStageChange wins over the top-level prop", async () => {
		const { resolveSectionPlayerRuntimeState } = await loadHostRuntime();
		const fromRuntime = () => {};
		const fromProp = () => {};
		const state = resolveSectionPlayerRuntimeState({
			assessmentId: "a1",
			playerType: "iife",
			player: null,
			lazyInit: true,
			tools: null,
			accessibility: null,
			coordinator: null,
			env: null,
			toolConfigStrictness: "error",
			onStageChange: fromProp,
			runtime: { onStageChange: fromRuntime },
			enabledTools: "",
		});
		expect((state.effectiveRuntime as any).onStageChange).toBe(fromRuntime);
	});

	test("runtime.onLoadingComplete wins over the top-level prop", async () => {
		const { resolveSectionPlayerRuntimeState } = await loadHostRuntime();
		const fromRuntime = () => {};
		const fromProp = () => {};
		const state = resolveSectionPlayerRuntimeState({
			assessmentId: "a1",
			playerType: "iife",
			player: null,
			lazyInit: true,
			tools: null,
			accessibility: null,
			coordinator: null,
			env: null,
			toolConfigStrictness: "error",
			onLoadingComplete: fromProp,
			runtime: { onLoadingComplete: fromRuntime },
			enabledTools: "",
		});
		expect((state.effectiveRuntime as any).onLoadingComplete).toBe(fromRuntime);
	});

	test("threads through resolved playerRuntime so the host can read both halves at once", async () => {
		const { resolveSectionPlayerRuntimeState } = await loadHostRuntime();
		const state = resolveSectionPlayerRuntimeState({
			assessmentId: "a1",
			playerType: "iife",
			player: null,
			lazyInit: true,
			tools: null,
			accessibility: null,
			coordinator: null,
			env: { mode: "gather" },
			toolConfigStrictness: "error",
			runtime: null,
			enabledTools: "",
		});
		expect(state.playerRuntime.effectivePlayerType).toBe("iife");
		expect(state.playerRuntime.resolvedPlayerTag).toBeDefined();
		expect(state.effectiveRuntime).toBeDefined();
		expect(state.effectiveToolsConfig).toBeDefined();
	});
});

describe("mapRenderablesToItems", () => {
	test("flattens composition entries to their `entity` fields", async () => {
		const { mapRenderablesToItems } = await loadHostRuntime();
		const a = { id: "a" } as unknown;
		const b = { id: "b" } as unknown;
		const result = mapRenderablesToItems([
			{ entity: a },
			{ entity: b },
		]);
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
