import {
	parseToolList,
	warnDeprecatedOnce,
	type FrameworkErrorModel,
	type ToolConfigStrictness,
	type ToolRegistry,
	type ToolbarItem,
} from "@pie-players/pie-assessment-toolkit";
import {
	normalizeItemPlayerStrategy,
	type ItemEntity,
} from "@pie-players/pie-players-shared";
import type { LoaderConfig } from "@pie-players/pie-players-shared/loader-config";
import { DEFAULT_PLAYER_DEFINITIONS } from "../../component-definitions.js";
import type { SectionPlayerHostHooks } from "../../contracts/host-hooks.js";
import type { SectionPlayerPolicies } from "../../policies/types.js";

export const DEFAULT_ASSESSMENT_ID = "section-demo-direct";
export const DEFAULT_PLAYER_TYPE = "iife";
export const DEFAULT_LAZY_INIT = true;
export const DEFAULT_ISOLATION = "inherit";
export const DEFAULT_ENV = { mode: "gather", role: "student" } as Record<
	string,
	unknown
>;

type PlayerOverrides = {
	loaderConfig?: LoaderConfig;
	loaderOptions?: Record<string, unknown>;
	[key: string]: unknown;
};

export type FrameworkErrorHandler = (model: FrameworkErrorModel) => void;
export type LegacyFrameworkErrorHook = (
	errorModel: Record<string, unknown>,
) => void;

/**
 * Two-tier section player runtime config.
 *
 * Mirror rule (locked in M5): every tier-1 surface has the shape
 *   `kebab-attribute ↔ camelCaseProp ↔ runtime.<sameCamelCaseKey>`
 *
 * `runtime.<key>` always wins over the equivalent prop/attribute. Adding a new
 * tier-1 surface means appending a key here AND adding the matching layout-CE
 * prop entry; `m5-mirror-rule.test.ts` is the CI guardrail for this invariant.
 *
 * Documented exceptions (no runtime mirror, by design):
 * - Identity (`section-id`, `attempt-id`, `section`): per-attempt host state.
 * - Layout-only shell knobs (`show-toolbar`, `toolbar-position`,
 *   `narrow-layout-breakpoint`, `split-pane-collapse-strategy`): layout-CE
 *   concerns; the resolver does not see them.
 *
 * See `packages/section-player/ARCHITECTURE.md` for the full policy.
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

	// M5 mirrors of currently-prop-only tier-1 surfaces.
	enabledTools?: string;
	toolRegistry?: ToolRegistry | null;
	policies?: SectionPlayerPolicies;
	hooks?: SectionPlayerHostHooks;
	sectionHostButtons?: ToolbarItem[];
	itemHostButtons?: ToolbarItem[];
	passageHostButtons?: ToolbarItem[];

	// M5 mirrors of demoted kebab attributes (Decision D1: every reachable
	// configuration value is reachable via `runtime.<key>` if a host wants
	// the override path).
	iifeBundleHost?: string;
	debug?: string | boolean;
	contentMaxWidthNoPassage?: number;
	contentMaxWidthWithPassage?: number;
	splitPaneMinRegionWidth?: number;
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
	toolRegistry?: ToolRegistry | null;
	toolConfigStrictness?: ToolConfigStrictness;
	onFrameworkError?: FrameworkErrorHandler;
	frameworkErrorHook?: LegacyFrameworkErrorHook;
	policies?: SectionPlayerPolicies;
	hooks?: SectionPlayerHostHooks;
	sectionHostButtons?: ToolbarItem[];
	itemHostButtons?: ToolbarItem[];
	passageHostButtons?: ToolbarItem[];
	iifeBundleHost?: string;
	debug?: string | boolean;
	contentMaxWidthNoPassage?: number;
	contentMaxWidthWithPassage?: number;
	splitPaneMinRegionWidth?: number;
	runtime: RuntimeConfig | null;
	enabledTools: string;
	itemToolbarTools: string;
	passageToolbarTools: string;
};

/**
 * Pick the runtime-tier value when defined, otherwise the prop/attribute
 * value. The strict mirror rule means every tier-1 surface is resolved with
 * this single helper; per-feature special-casing is forbidden.
 */
function pick<T>(
	runtimeVal: T | undefined,
	attrVal: T | undefined,
): T | undefined {
	return runtimeVal !== undefined ? runtimeVal : attrVal;
}

/**
 * Resolve the canonical `onFrameworkError` handler from the two-tier surface
 * plus the deprecated `frameworkErrorHook` alias.
 *
 * Precedence (highest first):
 *   1. `runtime.onFrameworkError`
 *   2. top-level `onFrameworkError` prop
 *   3. legacy `frameworkErrorHook` prop (deprecated; emits a one-time dev warn)
 *
 * Layout CEs and the kernel call this so every entry point converges on the
 * same handler — the toolkit element invokes it exactly once per error.
 */
export function resolveOnFrameworkError(args: {
	runtime: RuntimeConfig | null;
	onFrameworkError?: FrameworkErrorHandler;
	frameworkErrorHook?: LegacyFrameworkErrorHook;
}): FrameworkErrorHandler | undefined {
	const r = args.runtime ?? {};
	if (r.onFrameworkError !== undefined) return r.onFrameworkError;
	if (args.onFrameworkError !== undefined) return args.onFrameworkError;
	if (args.frameworkErrorHook !== undefined) {
		warnDeprecatedOnce(
			"section-player:frameworkErrorHook",
			"<pie-section-player-...>'s `frameworkErrorHook` prop is deprecated; use `onFrameworkError` instead.",
		);
		// The legacy hook accepts a looser `Record<string, unknown>`; wrap it
		// rather than casting so the canonical-handler contract stays clean.
		// Migration target is the runtime mirror `runtime.onFrameworkError`
		// or the top-level `onFrameworkError` prop.
		const legacy = args.frameworkErrorHook;
		return (model) => legacy(model as unknown as Record<string, unknown>);
	}
	return undefined;
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
	const effectiveEnabledTools = pick(
		args.runtime?.enabledTools,
		args.enabledTools,
	) ?? "";
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
	frameworkErrorHook?: LegacyFrameworkErrorHook;
	toolRegistry?: ToolRegistry | null;
	policies?: SectionPlayerPolicies;
	hooks?: SectionPlayerHostHooks;
	sectionHostButtons?: ToolbarItem[];
	itemHostButtons?: ToolbarItem[];
	passageHostButtons?: ToolbarItem[];
	iifeBundleHost?: string;
	debug?: string | boolean;
	contentMaxWidthNoPassage?: number;
	contentMaxWidthWithPassage?: number;
	splitPaneMinRegionWidth?: number;
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
		// `onFrameworkError` identically (including the deprecated
		// `frameworkErrorHook` alias).
		onFrameworkError: resolveOnFrameworkError({
			runtime: args.runtime,
			onFrameworkError: args.onFrameworkError,
			frameworkErrorHook: args.frameworkErrorHook,
		}),

		// M5 mirrors of tier-1 props.
		toolRegistry: pick(r.toolRegistry, args.toolRegistry),
		policies: pick(r.policies, args.policies),
		hooks: pick(r.hooks, args.hooks),
		sectionHostButtons: pick(r.sectionHostButtons, args.sectionHostButtons),
		itemHostButtons: pick(r.itemHostButtons, args.itemHostButtons),
		passageHostButtons: pick(r.passageHostButtons, args.passageHostButtons),

		// Demoted-with-alias keys (Decision D1).
		iifeBundleHost: pick(r.iifeBundleHost, args.iifeBundleHost),
		debug: pick(r.debug, args.debug),
		contentMaxWidthNoPassage: pick(
			r.contentMaxWidthNoPassage,
			args.contentMaxWidthNoPassage,
		),
		contentMaxWidthWithPassage: pick(
			r.contentMaxWidthWithPassage,
			args.contentMaxWidthWithPassage,
		),
		splitPaneMinRegionWidth: pick(
			r.splitPaneMinRegionWidth,
			args.splitPaneMinRegionWidth,
		),

		tools: args.effectiveToolsConfig,
	};
}

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

export function mapRenderablesToItems(renderables: unknown[]): ItemEntity[] {
	return renderables.map((entry) => {
		const entity = (entry as { entity?: ItemEntity })?.entity;
		return entity as ItemEntity;
	});
}

export function resolveSectionPlayerRuntimeState(args: RuntimeInputs) {
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
		frameworkErrorHook: args.frameworkErrorHook,
		toolRegistry: args.toolRegistry,
		policies: args.policies,
		hooks: args.hooks,
		sectionHostButtons: args.sectionHostButtons,
		itemHostButtons: args.itemHostButtons,
		passageHostButtons: args.passageHostButtons,
		iifeBundleHost: args.iifeBundleHost,
		debug: args.debug,
		contentMaxWidthNoPassage: args.contentMaxWidthNoPassage,
		contentMaxWidthWithPassage: args.contentMaxWidthWithPassage,
		splitPaneMinRegionWidth: args.splitPaneMinRegionWidth,
	});
	const playerRuntime = resolvePlayerRuntime({
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
