/**
 * Section runtime engine resolver.
 *
 * Canonical home of `resolveRuntime`, `resolveToolsConfig`, and their
 * supporting helpers/types; section-player consumes them through
 * `@pie-players/pie-assessment-toolkit/runtime/engine`.
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
 * Each input has one tier. `assessmentId`, the tools and player config and the
 * `on*` callbacks arrive on `runtime`. The primitive inputs (`nds-icons`,
 * `locale`, `tool-config-strictness`) are element attributes; the resolver takes
 * `toolConfigStrictness` beside `runtime`.
 */

import type { LoaderConfig } from "@pie-players/pie-players-shared/loader-config";
import type {
	LoadingCompleteDetail,
	StageChangeDetail,
} from "@pie-players/pie-players-shared/pie";
import type { FrameworkErrorModel } from "../../services/framework-error.js";
import type { ToolConfigStrictness } from "../../services/tool-config-validation.js";

export const DEFAULT_PLAYER_TYPE = "iife";
export const DEFAULT_LAZY_INIT = false;
export const DEFAULT_ISOLATION = "inherit";
export const DEFAULT_ENV = { mode: "gather", role: "student" } as Record<
	string,
	unknown
>;

export type PlayerOverrides = {
	/** The host has already loaded the item bundles; the player loads none. */
	hosted?: boolean;
	loaderConfig?: LoaderConfig;
	loaderOptions?: Record<string, unknown>;
	/** The item player's `backend` config, passed through unread. */
	backend?: Record<string, unknown> | null;
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
	 * Content language: a BCP-47 tag naming the language the authored content is
	 * written in, which read-aloud speaks it in and catalog lookups select
	 * alternates by. A `lang` in the content's markup wins over it. Purely
	 * presentational — no engine effect.
	 *
	 * Unset reads as `en-US` wherever the markup names no language.
	 */
	contentLanguage?: string;

	onFrameworkError?: FrameworkErrorHandler;
	/** Called with each `pie-stage-change` detail. */
	onStageChange?: StageChangeHandler;
	/** Called with each `pie-loading-complete` detail. */
	onLoadingComplete?: LoadingCompleteHandler;
};

export type RuntimeInputs = {
	runtime: RuntimeConfig | null;
	toolConfigStrictness?: ToolConfigStrictness;
};

/**
 * The id a section runs under: the host's `section-id`, else the section's own
 * `identifier`, else one named after the assessment. The toolkit keys the
 * section's controller by it, and the layout kernel its stage cohort.
 */
export function resolveSectionId(args: {
	sectionId?: string | null;
	section?: unknown;
	assessmentId?: string | null;
}): string {
	const identifier = (args.section as { identifier?: unknown } | null)
		?.identifier;
	return (
		args.sectionId ||
		(typeof identifier === "string" ? identifier : "") ||
		`section-${args.assessmentId || "default"}`
	);
}

export function resolveToolsConfig(args: { runtime: RuntimeConfig | null }) {
	const runtimeTools = (args.runtime?.tools || {}) as Record<string, unknown>;
	const placement = (runtimeTools.placement || {}) as Record<string, unknown>;
	const overlayToolsConfig = { ...runtimeTools, placement: { ...placement } };
	// Keep host-provided shape intact; framework-owned validation surfaces malformed config.
	return overlayToolsConfig;
}

export function resolveRuntime(args: {
	runtime: RuntimeConfig | null;
	effectiveToolsConfig: unknown;
	toolConfigStrictness?: ToolConfigStrictness;
}) {
	const r = args.runtime || {};
	const runtimePlayer = r.player ? { ...r.player } : null;
	return {
		...r,
		playerType: r.playerType ?? DEFAULT_PLAYER_TYPE,
		player: runtimePlayer,
		lazyInit: r.lazyInit ?? DEFAULT_LAZY_INIT,
		accessibility: r.accessibility ?? null,
		coordinator: r.coordinator ?? null,
		createSectionController: r.createSectionController,
		isolation: r.isolation ?? DEFAULT_ISOLATION,
		env: r.env ?? DEFAULT_ENV,
		toolConfigStrictness: args.toolConfigStrictness ?? "error",
		tools: args.effectiveToolsConfig,
	};
}

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
	const effectiveToolsConfig = resolveToolsConfig({
		runtime: args.runtime,
	});
	const effectiveRuntime = resolveRuntime({
		runtime: args.runtime,
		effectiveToolsConfig,
		toolConfigStrictness: args.toolConfigStrictness,
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
