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
 * Runtime-owned configuration flows through `runtime.<key>`. Layout-only
 * inputs stay on the section-player host elements.
 */

import type { LoaderConfig } from "@pie-players/pie-players-shared/loader-config";
import type {
	LoadingCompleteDetail,
	StageChangeDetail,
} from "@pie-players/pie-players-shared/pie";
import type { FrameworkErrorModel } from "../../services/framework-error.js";
import type { ToolConfigStrictness } from "../../services/tool-config-validation.js";

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
 * Section runtime config.
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
	toolContextResolvers?: Record<string, unknown> | null;
	accessibility?: Record<string, unknown> | null;
	coordinator?: unknown;
	createSectionController?: unknown;
	isolation?: string;
	env?: Record<string, unknown>;
	/**
	 * Presentation flag: opt-in to the vendored `<nds-icon-button>` for the
	 * toolbar tool buttons, the calculator shell controls, inline-TTS
	 * play/pause, and the section scroll-hint. NDS icons render only when
	 * this is explicitly `true`; unset/`false` keeps the plain `<button>`
	 * markup (the default). Purely visual — no engine effect.
	 */
	ndsIcons?: boolean;
	toolConfigStrictness?: ToolConfigStrictness;

	// Canonical framework-error callback.
	onFrameworkError?: FrameworkErrorHandler;

	// Canonical stage-change callback. The DOM event
	// `pie-stage-change` remains the primary channel; this callback is
	// the convenience surface that mirrors the event one-to-one.
	onStageChange?: StageChangeHandler;

	// Canonical loading-complete callback. Mirrors the
	// `pie-loading-complete` DOM event, which the engine dispatches
	// once per cohort when every item has finished loading.
	onLoadingComplete?: LoadingCompleteHandler;
};

export type RuntimeInputs = {
	assessmentId?: string;
	toolConfigStrictness?: ToolConfigStrictness;
	onFrameworkError?: FrameworkErrorHandler;
	onStageChange?: StageChangeHandler;
	onLoadingComplete?: LoadingCompleteHandler;
	runtime: RuntimeConfig | null;
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

export function resolveToolsConfig(args: { runtime: RuntimeConfig | null }) {
	const runtimeTools = (args.runtime?.tools || {}) as Record<string, unknown>;
	const placement = (runtimeTools.placement || {}) as Record<string, unknown>;
	const overlayToolsConfig = { ...runtimeTools, placement: { ...placement } };
	// Keep host-provided shape intact; framework-owned validation surfaces malformed config.
	return overlayToolsConfig;
}

export function resolveRuntime(args: {
	assessmentId: string;
	runtime: RuntimeConfig | null;
	effectiveToolsConfig: unknown;
	toolConfigStrictness?: ToolConfigStrictness;
	onFrameworkError?: FrameworkErrorHandler;
	onStageChange?: StageChangeHandler;
	onLoadingComplete?: LoadingCompleteHandler;
}) {
	const r = args.runtime || {};
	const runtimePlayer = r.player ? { ...r.player } : null;
	return {
		...r,
		assessmentId: pick(r.assessmentId, args.assessmentId),
		playerType: r.playerType ?? DEFAULT_PLAYER_TYPE,
		player: runtimePlayer,
		lazyInit: r.lazyInit ?? DEFAULT_LAZY_INIT,
		accessibility: r.accessibility ?? null,
		coordinator: r.coordinator ?? null,
		createSectionController: r.createSectionController,
		isolation: r.isolation ?? DEFAULT_ISOLATION,
		env: r.env ?? DEFAULT_ENV,
		toolConfigStrictness:
			pick(r.toolConfigStrictness, args.toolConfigStrictness) ?? "error",

		// Runtime callback wins; top-level callback remains a layout CE event
		// convenience for hosts that do not use DOM listeners.
		onFrameworkError: resolveOnFrameworkError({
			runtime: args.runtime,
			onFrameworkError: args.onFrameworkError,
		}),

		// Runtime callback wins over the top-level callback prop.
		onStageChange: pick(r.onStageChange, args.onStageChange),

		// Runtime callback wins over the top-level callback prop.
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
 * Engine-side orchestrator that powers `resolveSectionPlayerRuntimeState`
 * from section-player and takes
 * `resolvePlayerRuntime` as an injected callable so the toolkit core
 * stays free of host-coupled defaults (`DEFAULT_PLAYER_DEFINITIONS`).
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

	const effectiveToolsConfig = resolveToolsConfig({
		runtime: args.runtime,
	});
	const effectiveRuntime = resolveRuntime({
		assessmentId,
		runtime: args.runtime,
		effectiveToolsConfig,
		toolConfigStrictness: args.toolConfigStrictness,
		onFrameworkError: args.onFrameworkError,
		onStageChange: args.onStageChange,
		onLoadingComplete: args.onLoadingComplete,
	});
	const playerRuntime = deps.resolvePlayerRuntime({
		effectiveRuntime: effectiveRuntime as Record<string, unknown>,
		playerType: String(effectiveRuntime.playerType ?? DEFAULT_PLAYER_TYPE),
		env: (effectiveRuntime.env as Record<string, unknown> | null) ?? null,
	});
	return {
		effectiveToolsConfig,
		effectiveRuntime,
		playerRuntime,
	};
}
