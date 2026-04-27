/**
 * Section-player host runtime helpers (M7 PR 7).
 *
 * The Variant C engine resolver in
 * `@pie-players/pie-assessment-toolkit/runtime/internal` consolidated
 * `resolveRuntime`, `resolveToolsConfig`, and the two-tier mirror
 * helpers into the toolkit's runtime package (PR 1, PR 3). The
 * **player-coupled** parts of the legacy
 * `section-player-runtime.ts` cannot follow that move:
 *
 *   - `resolvePlayerRuntime` reads from
 *     `DEFAULT_PLAYER_DEFINITIONS` in
 *     `../../component-definitions.js`, which side-effect-imports
 *     `@pie-players/pie-item-player`. Pulling that import into the
 *     toolkit runtime core would break the package's
 *     "core stays player-package-free" invariant
 *     (`engine-resolver.ts` doc-comment, "What is NOT absorbed").
 *
 *   - `mapRenderablesToItems` is a tiny helper consumed by
 *     `section-player-view-state.ts`. It belongs alongside the
 *     other host-runtime helpers, not in the toolkit core.
 *
 *   - `resolveSectionPlayerRuntimeState` is the historical orchestrator
 *     that hosts call when they need an effective runtime + a resolved
 *     player runtime in one shot. PR 7 keeps it as a thin wrapper over
 *     the toolkit's `resolveSectionEngineRuntimeState` so the
 *     two-tier-mirror path is owned by the toolkit and the
 *     player-coupling stays in section-player.
 *
 * Section-player imports for the relocated symbols (`DEFAULT_*`,
 * `resolveOnFrameworkError`, `RuntimeConfig`, the handler types,
 * `createReadinessDetail`, `createStageTracker`, etc.) point directly
 * at `@pie-players/pie-assessment-toolkit/runtime/internal` /
 * `@pie-players/pie-players-shared/pie`. This module deliberately does
 * not re-export them: a single canonical import path per symbol keeps
 * the dist-export contract honest and prevents future drift.
 */

import {
	DEFAULT_PLAYER_TYPE,
	resolveSectionEngineRuntimeState,
	type PlayerOverrides,
	type RuntimeInputs,
} from "@pie-players/pie-assessment-toolkit/runtime/internal";
import {
	normalizeItemPlayerStrategy,
	type ItemEntity,
} from "@pie-players/pie-players-shared";
import { DEFAULT_PLAYER_DEFINITIONS } from "../../component-definitions.js";

/**
 * Resolve the player-runtime view (player tag, attributes, props,
 * env, strategy) for the section-player host. Stays in section-player
 * because of the `DEFAULT_PLAYER_DEFINITIONS` dependency, which
 * side-effect-imports `@pie-players/pie-item-player`.
 *
 * Verbatim absorption of the pre-PR-7 `resolvePlayerRuntime` from
 * `section-player-runtime.ts`; behavior is byte-for-byte identical
 * (the existing `tests/section-player-runtime.test.ts` test suite
 * pins this module's export at PR 7).
 */
export function resolvePlayerRuntime(args: {
	effectiveRuntime: Record<string, unknown>;
	playerType: string;
	env: Record<string, unknown> | null;
}) {
	const effectivePlayerType = String(
		(args.effectiveRuntime?.playerType as string) ||
			args.playerType ||
			DEFAULT_PLAYER_TYPE,
	);
	const resolvedPlayerDefinition =
		DEFAULT_PLAYER_DEFINITIONS[effectivePlayerType] ||
		DEFAULT_PLAYER_DEFINITIONS.iife;
	const resolvedPlayerTag =
		resolvedPlayerDefinition?.tagName || "pie-item-player";
	const resolvedPlayerAttributes = resolvedPlayerDefinition?.attributes || {};
	const definitionProps = (resolvedPlayerDefinition?.props || {}) as Record<
		string,
		unknown
	>;
	const runtimePlayerOverrides = ((args.effectiveRuntime
		?.player as PlayerOverrides) || {}) as PlayerOverrides;
	const definitionLoaderOptions = (definitionProps.loaderOptions ||
		{}) as Record<string, unknown>;
	const runtimeLoaderOptions = (runtimePlayerOverrides.loaderOptions ||
		{}) as Record<string, unknown>;
	const resolvedPlayerProps = {
		...definitionProps,
		...runtimePlayerOverrides,
		loaderOptions: {
			...definitionLoaderOptions,
			...runtimeLoaderOptions,
		},
	};
	const resolvedPlayerEnv = ((args.effectiveRuntime?.env as Record<
		string,
		unknown
	>) ||
		args.env ||
		{}) as Record<string, unknown>;
	const strategy = normalizeItemPlayerStrategy(
		resolvedPlayerAttributes?.strategy || effectivePlayerType,
		"iife",
	);
	return {
		effectivePlayerType,
		resolvedPlayerDefinition,
		resolvedPlayerTag,
		resolvedPlayerAttributes,
		resolvedPlayerProps,
		resolvedPlayerEnv,
		strategy,
	};
}

/**
 * Map the layout's `renderables` array (composition-model entries) to
 * a flat `ItemEntity[]`. Used by `section-player-view-state.ts` to
 * project the kernel's composition snapshot into the per-item card
 * view. Stays in section-player because the consumer is a
 * section-player module.
 */
export function mapRenderablesToItems(renderables: unknown[]): ItemEntity[] {
	return renderables.map((entry) => {
		const entity = (entry as { entity?: ItemEntity })?.entity;
		return entity as ItemEntity;
	});
}

/**
 * Section-player host orchestrator. Thin wrapper over the toolkit's
 * `resolveSectionEngineRuntimeState`, supplying section-player's
 * local `resolvePlayerRuntime` so the toolkit core never imports
 * `DEFAULT_PLAYER_DEFINITIONS`.
 *
 * Pre-PR-7 callers used the legacy
 * `resolveSectionPlayerRuntimeState` from `section-player-runtime.ts`;
 * post-PR-7 the legacy file is deleted and this wrapper is the only
 * orchestrator entry point.
 *
 * Behavior is byte-for-byte identical to the pre-PR-7 implementation
 * (pinned by `tests/section-player-runtime.test.ts`).
 */
export function resolveSectionPlayerRuntimeState(args: RuntimeInputs) {
	return resolveSectionEngineRuntimeState(args, {
		resolvePlayerRuntime,
	});
}
