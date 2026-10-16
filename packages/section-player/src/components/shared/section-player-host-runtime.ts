/**
 * The player-coupled half of section-player runtime resolution. The toolkit's
 * `resolveSectionEngineRuntimeState` (`@pie-players/pie-assessment-toolkit/runtime/engine`)
 * resolves the runtime config; `resolvePlayerRuntime` lives here because it reads
 * `DEFAULT_PLAYER_DEFINITIONS`, which side-effect-imports
 * `@pie-players/pie-item-player`, and the toolkit core imports no player package.
 */

import {
	DEFAULT_PLAYER_TYPE,
	resolveSectionEngineRuntimeState,
	type PlayerOverrides,
	type RuntimeInputs,
} from "@pie-players/pie-assessment-toolkit/runtime/engine";
import {
	normalizeItemPlayerStrategy,
	type ItemEntity,
} from "@pie-players/pie-players-shared";
import { DEFAULT_PLAYER_DEFINITIONS } from "../../component-definitions.js";

function hasExplicitHostedOverride(playerOverrides: PlayerOverrides): boolean {
	return playerOverrides.hosted !== undefined;
}

function hasEnabledDeliveryBackend(playerOverrides: PlayerOverrides): boolean {
	const backend = playerOverrides.backend as
		| { delivery?: { enabled?: boolean } | null }
		| null
		| undefined;
	return !!backend?.delivery && backend.delivery.enabled !== false;
}

/**
 * Resolve the player-runtime view (player tag, attributes, props,
 * env, strategy) for the section-player host. Stays in section-player
 * because of the `DEFAULT_PLAYER_DEFINITIONS` dependency, which
 * side-effect-imports `@pie-players/pie-item-player`.
 *
 * Pinned by `tests/section-player-runtime.test.ts`.
 */
export function resolvePlayerRuntime(args: {
	effectiveRuntime: Record<string, unknown>;
	playerType: string;
	env: Record<string, unknown> | null;
	/** The `iife-bundle-host` attribute, used when `runtime.player.loaderOptions.bundleHost` is unset. */
	iifeBundleHost?: string | null;
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
	const strategy = normalizeItemPlayerStrategy(
		resolvedPlayerAttributes?.strategy || effectivePlayerType,
		"iife",
	);
	// Between the runtime's bundle host and the definition default, so the
	// attribute reaches the rendered item players as well as the pre-warm.
	const attributeBundleHost =
		strategy === "iife" ? String(args.iifeBundleHost ?? "").trim() : "";
	const attributeLoaderOptions = attributeBundleHost
		? { bundleHost: attributeBundleHost }
		: {};
	const hostedDefault =
		!hasExplicitHostedOverride(runtimePlayerOverrides) &&
		hasEnabledDeliveryBackend(runtimePlayerOverrides)
			? { hosted: true }
			: {};
	const resolvedPlayerProps = {
		...definitionProps,
		...hostedDefault,
		...runtimePlayerOverrides,
		loaderOptions: {
			...definitionLoaderOptions,
			...attributeLoaderOptions,
			...runtimeLoaderOptions,
		},
	};
	const resolvedPlayerEnv = ((args.effectiveRuntime?.env as Record<
		string,
		unknown
	>) ||
		args.env ||
		{}) as Record<string, unknown>;
	return {
		effectivePlayerType,
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
 * Pinned by `tests/section-player-runtime.test.ts`.
 */
export function resolveSectionPlayerRuntimeState(
	args: RuntimeInputs & { iifeBundleHost?: string | null },
) {
	return resolveSectionEngineRuntimeState(args, {
		resolvePlayerRuntime: (resolverArgs) =>
			resolvePlayerRuntime({
				...resolverArgs,
				iifeBundleHost: args.iifeBundleHost,
			}),
	});
}
