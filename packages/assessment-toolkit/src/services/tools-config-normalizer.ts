import { DEFAULT_TOOL_ALIAS_MAP, DEFAULT_TOOL_PLACEMENT } from "./tool-config-defaults.js";

export type ToolPlacementLevel = "section" | "item" | "passage";

export interface ToolPolicyConfig {
	allowed?: string[];
	blocked?: string[];
}

export interface ToolPlacementConfig {
	section?: string[];
	item?: string[];
	passage?: string[];
}

export interface ToolProvidersConfig {
	tts?: Record<string, unknown>;
	calculator?: Record<string, unknown>;
	[key: string]: Record<string, unknown> | undefined;
}

export interface CanonicalToolsConfig {
	policy: ToolPolicyConfig;
	placement: Required<ToolPlacementConfig>;
	providers: ToolProvidersConfig;
}

const DEFAULT_PLACEMENT: Required<ToolPlacementConfig> = {
	section: [...DEFAULT_TOOL_PLACEMENT.section],
	item: [...DEFAULT_TOOL_PLACEMENT.item],
	passage: [...DEFAULT_TOOL_PLACEMENT.passage],
};

export function normalizeToolAlias(toolId: string): string {
	const trimmed = toolId.trim();
	if (!trimmed) return "";
	return DEFAULT_TOOL_ALIAS_MAP[trimmed as keyof typeof DEFAULT_TOOL_ALIAS_MAP] || trimmed;
}

export function normalizeToolList(toolIds: string[] | undefined | null): string[] {
	if (!toolIds || toolIds.length === 0) return [];
	const deduped = new Set<string>();
	for (const rawToolId of toolIds) {
		const normalized = normalizeToolAlias(rawToolId);
		if (!normalized) continue;
		deduped.add(normalized);
	}
	return Array.from(deduped);
}

export function parseToolList(input: string | undefined | null): string[] {
	if (!input) return [];
	return normalizeToolList(
		input
			.split(",")
			.map((entry) => entry.trim())
			.filter(Boolean),
	);
}

export function normalizeToolsConfig(
	input?: Partial<CanonicalToolsConfig> | null,
): CanonicalToolsConfig {
	return {
		policy: {
			allowed: normalizeToolList(input?.policy?.allowed),
			blocked: normalizeToolList(input?.policy?.blocked),
		},
		placement: {
			section: normalizeToolList(input?.placement?.section).length
				? normalizeToolList(input?.placement?.section)
				: [...DEFAULT_PLACEMENT.section],
			item: normalizeToolList(input?.placement?.item).length
				? normalizeToolList(input?.placement?.item)
				: [...DEFAULT_PLACEMENT.item],
			passage: normalizeToolList(input?.placement?.passage).length
				? normalizeToolList(input?.placement?.passage)
				: [...DEFAULT_PLACEMENT.passage],
		},
		providers: {
			...(input?.providers || {}),
		},
	};
}

export function resolveToolsForLevel(
	config: CanonicalToolsConfig,
	level: ToolPlacementLevel,
): string[] {
	const placement = normalizeToolList(config.placement[level]);
	const allowed = normalizeToolList(config.policy.allowed);
	const blocked = new Set(normalizeToolList(config.policy.blocked));
	const passAllowed =
		allowed.length === 0 ? placement : placement.filter((toolId) => allowed.includes(toolId));
	return passAllowed.filter((toolId) => !blocked.has(toolId));
}
