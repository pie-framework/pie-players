import {
	normalizeToolsConfig,
	parseToolList,
} from "@pie-players/pie-assessment-toolkit";
import {
	normalizeItemPlayerStrategy,
	type ItemEntity,
} from "@pie-players/pie-players-shared";
import { DEFAULT_PLAYER_DEFINITIONS } from "../../component-definitions.js";

export const DEFAULT_ASSESSMENT_ID = "section-demo-direct";
export const DEFAULT_PLAYER_TYPE = "iife";
export const DEFAULT_LAZY_INIT = true;
export const DEFAULT_ISOLATION = "inherit";
export const DEFAULT_ENV = { mode: "gather", role: "student" } as Record<
	string,
	unknown
>;

export type RuntimeConfig = {
	assessmentId?: string;
	playerType?: string;
	player?: Record<string, unknown> | null;
	lazyInit?: boolean;
	tools?: Record<string, unknown> | null;
	accessibility?: Record<string, unknown> | null;
	coordinator?: unknown;
	createSectionController?: unknown;
	isolation?: string;
	env?: Record<string, unknown>;
};

export type RuntimeInputs = {
	assessmentId?: string;
	playerType?: string;
	player?: Record<string, unknown> | null;
	lazyInit?: boolean;
	tools?: Record<string, unknown> | null;
	accessibility?: Record<string, unknown> | null;
	coordinator?: unknown;
	createSectionController?: unknown;
	isolation?: string;
	env?: Record<string, unknown> | null;
	runtime: RuntimeConfig | null;
	enabledTools: string;
	itemToolbarTools: string;
	passageToolbarTools: string;
};

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
	const normalized = normalizeToolsConfig(runtimeTools);
	const sectionTools = parseToolList(args.enabledTools);
	const itemTools = parseToolList(args.itemToolbarTools);
	const passageTools = parseToolList(args.passageToolbarTools);
	return normalizeToolsConfig({
		...normalized,
		placement: {
			...normalized.placement,
			section:
				sectionTools.length > 0 ? sectionTools : normalized.placement.section,
			item: itemTools.length > 0 ? itemTools : normalized.placement.item,
			passage:
				passageTools.length > 0 ? passageTools : normalized.placement.passage,
		},
	});
}

export function resolveRuntime(args: {
	assessmentId: string;
	playerType: string;
	player: Record<string, unknown> | null;
	lazyInit: boolean;
	accessibility: Record<string, unknown> | null;
	coordinator: unknown;
	createSectionController: unknown;
	isolation: string;
	env: Record<string, unknown> | null;
	runtime: RuntimeConfig | null;
	effectiveToolsConfig: unknown;
}) {
	const runtime = args.runtime || {};
	return {
		...runtime,
		assessmentId: runtime.assessmentId ?? args.assessmentId,
		playerType: runtime.playerType ?? args.playerType,
		player: runtime.player ?? args.player,
		lazyInit: runtime.lazyInit ?? args.lazyInit,
		accessibility: runtime.accessibility ?? args.accessibility,
		coordinator: runtime.coordinator ?? args.coordinator,
		createSectionController:
			runtime.createSectionController ?? args.createSectionController,
		isolation: runtime.isolation ?? args.isolation,
		env: runtime.env ?? args.env ?? DEFAULT_ENV,
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
	const resolvedPlayerProps = resolvedPlayerDefinition?.props || {};
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
