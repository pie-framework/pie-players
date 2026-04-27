/**
 * Section runtime engine resolver (M7).
 *
 * Canonical home of `resolveRuntime`, `resolveToolsConfig`, and their
 * supporting helpers/types. As of M7 PR 7 the previous duplicates in
 * `packages/section-player/src/components/shared/section-player-runtime.ts`
 * have been deleted; section-player now consumes these helpers via
 * `@pie-players/pie-assessment-toolkit/runtime/internal`.
 *
 * What is NOT absorbed in this module:
 * - `resolvePlayerRuntime` stays in section-player because it depends on
 *   `DEFAULT_PLAYER_DEFINITIONS` (which side-effect-imports the
 *   item-player package). The toolkit core stays free of that
 *   dependency by exposing a parametrized orchestrator —
 *   `resolveSectionEngineRuntimeState` — that takes a `resolvePlayerRuntime`
 *   callable. The section-player wrapper
 *   (`resolveSectionPlayerRuntimeState` in
 *   `packages/section-player/src/components/shared/section-player-host-runtime.ts`)
 *   hands its local implementation in.
 *
 * The strict mirror rule (M5) and the `runtime.<key>` precedence rule
 * are preserved bit-for-bit; the per-key precedence test in
 * `engine-resolver.test.ts` is the guardrail.
 */

import type { LoaderConfig } from "@pie-players/pie-players-shared/loader-config";
import type {
	LoadingCompleteDetail,
	StageChangeDetail,
} from "@pie-players/pie-players-shared/pie";
import type { FrameworkErrorModel } from "../../services/framework-error.js";
import type { ToolConfigStrictness } from "../../services/tool-config-validation.js";
import { warnDeprecatedOnce } from "../../services/deprecation-warnings.js";
import { parseToolList } from "../../services/tools-config-normalizer.js";

export const DEFAULT_ASSESSMENT_ID = "section-demo-direct";
export const DEFAULT_PLAYER_TYPE = "iife";
export const DEFAULT_LAZY_INIT = true;
export const DEFAULT_ISOLATION = "inherit";
export const DEFAULT_ENV = { mode: "gather", role: "student" } as Record<
	string,
	unknown
>;

export type PlayerOverrides = {
	loaderConfig?: LoaderConfig;
	loaderOptions?: Record<string, unknown>;
	[key: string]: unknown;
};

export type FrameworkErrorHandler = (model: FrameworkErrorModel) => void;
export type StageChangeHandler = (detail: StageChangeDetail) => void;
export type LoadingCompleteHandler = (detail: LoadingCompleteDetail) => void;

/**
 * Two-tier section runtime config (M5 strict mirror, post-trim).
 *
 * Mirror rule: `kebab-attribute ↔ camelCaseProp ↔ runtime.<sameCamelCaseKey>`.
 * `runtime.<key>` always wins over the equivalent prop/attribute.
 *
 * Documented exceptions (no runtime mirror, by design): identity
 * (`section-id`, `attempt-id`, `section`); layout-only shell knobs
 * (`show-toolbar`, `toolbar-position`, etc.); and layout-shell host
 * data (`policies`, `hooks`, `toolRegistry`, `*HostButtons`). Those
 * surfaces are layout-shell concerns; the runtime engine does not see
 * them. See section-player's ARCHITECTURE.md for the full policy.
 */
export type RuntimeConfig = {
	assessmentId?: string;
	playerType?: string;
	player?: PlayerOverrides | null;
	lazyInit?: boolean;
	tools?: Record<string, unknown> | null;
	accessibility?: Record<string, unknown> | null;
	coordinator?: unknown;
	createSectionController?: unknown;
	isolation?: string;
	env?: Record<string, unknown>;
	toolConfigStrictness?: ToolConfigStrictness;

	// M3 mirror — canonical onFrameworkError handler.
	onFrameworkError?: FrameworkErrorHandler;

	// M5 mirror — `enabledTools` is the canonical tier-1 shorthand for
	// `tools.placement.section`; `resolveToolsConfig` reads it from
	// `runtime?.enabledTools` when present.
	enabledTools?: string;

	// M6 mirror — canonical stage-change callback. The DOM event
	// `pie-stage-change` remains the primary channel; this callback is
	// the convenience surface that mirrors the event one-to-one.
	onStageChange?: StageChangeHandler;

	// M6 mirror — canonical loading-complete callback. Mirrors the
	// `pie-loading-complete` DOM event, which the engine dispatches
	// once per cohort when every item has finished loading.
	onLoadingComplete?: LoadingCompleteHandler;
};

export type RuntimeInputs = {
	assessmentId?: string;
	playerType?: string;
	player?: PlayerOverrides | null;
	lazyInit?: boolean;
	tools?: Record<string, unknown> | null;
	accessibility?: Record<string, unknown> | null;
	coordinator?: unknown;
	createSectionController?: unknown;
	isolation?: string;
	env?: Record<string, unknown> | null;
	toolConfigStrictness?: ToolConfigStrictness;
	onFrameworkError?: FrameworkErrorHandler;
	onStageChange?: StageChangeHandler;
	onLoadingComplete?: LoadingCompleteHandler;
	runtime: RuntimeConfig | null;
	enabledTools: string;
	itemToolbarTools: string;
	passageToolbarTools: string;
};

/**
 * Pick the runtime-tier value when defined, otherwise the prop/attribute
 * value. The strict mirror rule means every tier-1 surface is resolved
 * with this single helper; per-feature special-casing is forbidden.
 */
function pick<T>(
	runtimeVal: T | undefined,
	attrVal: T | undefined,
): T | undefined {
	return runtimeVal !== undefined ? runtimeVal : attrVal;
}

/**
 * Resolve the canonical `onFrameworkError` handler from the two-tier
 * surface. Precedence (highest first): `runtime.onFrameworkError`,
 * then top-level `onFrameworkError`. Layout CEs and the kernel call
 * this so every entry point converges on the same handler.
 */
export function resolveOnFrameworkError(args: {
	runtime: RuntimeConfig | null;
	onFrameworkError?: FrameworkErrorHandler;
}): FrameworkErrorHandler | undefined {
	const r = args.runtime ?? {};
	if (r.onFrameworkError !== undefined) return r.onFrameworkError;
	return args.onFrameworkError;
}

export function resolveToolsConfig(args: {
	runtime: RuntimeConfig | null;
	tools: Record<string, unknown> | null;
	enabledTools: string;
	itemToolbarTools: string;
	passageToolbarTools: string;
}) {
	const runtimeTools = (args.runtime?.tools || args.tools || {}) as Record<
		string,
		unknown
	>;
	// `runtime.enabledTools` is the canonical mirror; the kebab attribute is
	// the easy-tier alias. Per Decision B1, it merges into
	// `tools.placement.section`. The object form (`runtime.tools`) keeps
	// precedence over both — that lock lives in the merge below.
	const effectiveEnabledTools =
		pick(args.runtime?.enabledTools, args.enabledTools) ?? "";
	if (args.itemToolbarTools && args.itemToolbarTools.length > 0) {
		warnDeprecatedOnce(
			"section-player:itemToolbarTools",
			"<pie-section-player-...>'s `item-toolbar-tools` attribute is deprecated; set `tools.placement.item` (object form) or `runtime.tools.placement.item` instead.",
		);
	}
	if (args.passageToolbarTools && args.passageToolbarTools.length > 0) {
		warnDeprecatedOnce(
			"section-player:passageToolbarTools",
			"<pie-section-player-...>'s `passage-toolbar-tools` attribute is deprecated; set `tools.placement.passage` (object form) or `runtime.tools.placement.passage` instead.",
		);
	}
	const sectionTools = parseToolList(effectiveEnabledTools);
	const itemTools = parseToolList(args.itemToolbarTools);
	const passageTools = parseToolList(args.passageToolbarTools);
	const placement = (runtimeTools.placement || {}) as Record<string, unknown>;
	const overlayToolsConfig = {
		...runtimeTools,
		placement: {
			...placement,
			...(sectionTools.length > 0 ? { section: sectionTools } : {}),
			...(itemTools.length > 0 ? { item: itemTools } : {}),
			...(passageTools.length > 0 ? { passage: passageTools } : {}),
		},
	};
	// Keep host-provided shape intact; framework-owned validation surfaces malformed config.
	return overlayToolsConfig;
}

export function resolveRuntime(args: {
	assessmentId: string;
	playerType: string;
	player: PlayerOverrides | null;
	lazyInit: boolean;
	accessibility: Record<string, unknown> | null;
	coordinator: unknown;
	createSectionController: unknown;
	isolation: string;
	env: Record<string, unknown> | null;
	runtime: RuntimeConfig | null;
	effectiveToolsConfig: unknown;
	toolConfigStrictness?: ToolConfigStrictness;
	onFrameworkError?: FrameworkErrorHandler;
	onStageChange?: StageChangeHandler;
	onLoadingComplete?: LoadingCompleteHandler;
}) {
	const r = args.runtime || {};
	const topLevelPlayer = (args.player || {}) as PlayerOverrides;
	const runtimePlayer = (r.player || {}) as PlayerOverrides;
	const mergedPlayerCandidate = {
		...topLevelPlayer,
		...runtimePlayer,
		loaderOptions: {
			...((topLevelPlayer.loaderOptions || {}) as Record<string, unknown>),
			...((runtimePlayer.loaderOptions || {}) as Record<string, unknown>),
		},
		loaderConfig: {
			...((topLevelPlayer.loaderConfig || {}) as Record<string, unknown>),
			...((runtimePlayer.loaderConfig || {}) as Record<string, unknown>),
		},
	};
	const mergedPlayer =
		Object.keys(mergedPlayerCandidate).length > 0 ? mergedPlayerCandidate : null;
	return {
		...r,
		assessmentId: pick(r.assessmentId, args.assessmentId),
		playerType: pick(r.playerType, args.playerType),
		player: mergedPlayer,
		lazyInit: pick(r.lazyInit, args.lazyInit),
		accessibility: pick(r.accessibility, args.accessibility),
		coordinator: pick(r.coordinator, args.coordinator),
		createSectionController: pick(
			r.createSectionController,
			args.createSectionController,
		),
		isolation: pick(r.isolation, args.isolation),
		env: pick(r.env, args.env) ?? DEFAULT_ENV,
		toolConfigStrictness:
			pick(r.toolConfigStrictness, args.toolConfigStrictness) ?? "error",

		// M3 mirror absorbed via the shared helper so every layout CE wires
		// `onFrameworkError` identically.
		onFrameworkError: resolveOnFrameworkError({
			runtime: args.runtime,
			onFrameworkError: args.onFrameworkError,
		}),

		// M6 mirror — `onStageChange` follows the same precedence as every
		// other tier-1 surface: `runtime.onStageChange` wins over the
		// top-level prop.
		onStageChange: pick(r.onStageChange, args.onStageChange),

		// M6 mirror — `onLoadingComplete` follows the same precedence
		// rule.
		onLoadingComplete: pick(r.onLoadingComplete, args.onLoadingComplete),

		tools: args.effectiveToolsConfig,
	};
}

/**
 * Effective runtime returned by `resolveRuntime`. The shape is exposed
 * as `unknown` at the public boundary because consumers spread it into
 * arbitrary host props; downstream call sites narrow with the specific
 * keys they need.
 */
export type EffectiveRuntime = ReturnType<typeof resolveRuntime>;

/**
 * Engine-side orchestrator that mirrors the legacy
 * `resolveSectionPlayerRuntimeState` from section-player but takes
 * `resolvePlayerRuntime` as an injected callable so the toolkit core
 * stays free of host-coupled defaults (`DEFAULT_PLAYER_DEFINITIONS`).
 *
 * The legacy section-player wrapper passes its local `resolvePlayerRuntime`
 * here in M7 PR 5 when the kernel switches onto the engine.
 */
export function resolveSectionEngineRuntimeState<P>(
	args: RuntimeInputs,
	deps: {
		resolvePlayerRuntime: (resolverArgs: {
			effectiveRuntime: Record<string, unknown>;
			playerType: string;
			env: Record<string, unknown> | null;
		}) => P;
	},
): {
	effectiveToolsConfig: unknown;
	effectiveRuntime: EffectiveRuntime;
	playerRuntime: P;
} {
	const assessmentId = args.assessmentId ?? DEFAULT_ASSESSMENT_ID;
	const playerType = args.playerType ?? DEFAULT_PLAYER_TYPE;
	const player = args.player ?? null;
	const lazyInit = args.lazyInit ?? DEFAULT_LAZY_INIT;
	const accessibility = args.accessibility ?? null;
	const coordinator = args.coordinator ?? null;
	const createSectionController = args.createSectionController ?? null;
	const isolation = args.isolation ?? DEFAULT_ISOLATION;
	const env = args.env ?? null;
	const tools = args.tools ?? null;

	const effectiveToolsConfig = resolveToolsConfig({
		runtime: args.runtime,
		tools,
		enabledTools: args.enabledTools,
		itemToolbarTools: args.itemToolbarTools,
		passageToolbarTools: args.passageToolbarTools,
	});
	const effectiveRuntime = resolveRuntime({
		assessmentId,
		playerType,
		player,
		lazyInit,
		accessibility,
		coordinator,
		createSectionController,
		isolation,
		env,
		runtime: args.runtime,
		effectiveToolsConfig,
		toolConfigStrictness: args.toolConfigStrictness,
		onFrameworkError: args.onFrameworkError,
		onStageChange: args.onStageChange,
		onLoadingComplete: args.onLoadingComplete,
	});
	const playerRuntime = deps.resolvePlayerRuntime({
		effectiveRuntime: effectiveRuntime as Record<string, unknown>,
		playerType,
		env,
	});
	return {
		effectiveToolsConfig,
		effectiveRuntime,
		playerRuntime,
	};
}
