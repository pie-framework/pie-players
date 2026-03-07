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

export interface ToolRuntimeBackendRequest {
	path: string;
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	headers?: Record<string, string>;
	query?: Record<string, string | number | boolean>;
	body?: unknown;
}

export interface ToolRuntimeProviderBridge {
	/**
	 * Optional auth fetch hook for provider initialization.
	 * Useful for retrieving temporary credentials from a host backend.
	 */
	authFetcher?: () => Promise<Record<string, unknown>>;
	/**
	 * Optional backend request bridge for rich tool interactions
	 * beyond one-time auth fetching.
	 */
	request?: (request: ToolRuntimeBackendRequest) => Promise<unknown>;
	/**
	 * Optional host event emitter.
	 */
	emit?: (eventName: string, payload?: Record<string, unknown>) => void | Promise<void>;
	/**
	 * Optional host event subscription bridge.
	 */
	subscribe?: (
		eventName: string,
		handler: (payload: unknown) => void,
	) => (() => void) | void;
	[key: string]: unknown;
}

export interface ToolRuntimeProviderConfig {
	id?: string;
	init?: Record<string, unknown>;
	runtime?: ToolRuntimeProviderBridge;
}

export interface ToolProviderConfig {
	enabled?: boolean;
	provider?: ToolRuntimeProviderConfig;
	settings?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface ToolProvidersConfig {
	[key: string]: ToolProviderConfig | undefined;
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
