import { DEFAULT_TOOL_PLACEMENT } from "./tool-config-defaults.js";
import type { SREMathSpeechOptions } from "./tts/math-speech.js";

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
	) => (() => void) | undefined;
	[key: string]: unknown;
}

export interface ToolRuntimeProviderConfig {
	id?: string;
	init?: Record<string, unknown>;
	runtime?: ToolRuntimeProviderBridge;
}

export type TextToSpeechRuntimeProviderId = "polly" | "google" | "custom";

export interface ToolProviderConfig {
	enabled?: boolean;
	provider?: ToolRuntimeProviderConfig;
	settings?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface TextToSpeechToolProviderSettings
	extends Record<string, unknown> {
	mathSpeech?: SREMathSpeechOptions;
}

export interface TextToSpeechToolProviderConfig
	extends Omit<ToolProviderConfig, "provider" | "settings"> {
	provider?: ToolRuntimeProviderConfig | TextToSpeechRuntimeProviderId;
	serverProvider?: TextToSpeechRuntimeProviderId;
	mathSpeech?: SREMathSpeechOptions;
	settings?: TextToSpeechToolProviderSettings;
}

export interface ToolProvidersConfig {
	textToSpeech?: TextToSpeechToolProviderConfig;
	[key: string]: ToolProviderConfig | TextToSpeechToolProviderConfig | undefined;
}

/**
 * PNP/profile enforcement mode mirrored on `runtime.tools.pnpEnforcement`
 * (M5 mirror rule). Carried alongside `policy` / `placement` /
 * `providers` so hosts can pin or opt out of PNP/profile precedence via
 * the runtime config without reaching for the toolkit prop directly.
 *
 * - `"on"` — force enforcement (engine applies PNP/profile gates).
 * - `"off"` — opt out (engine ignores PNP/profile inputs).
 * - omitted / `undefined` — auto-mode (the default). The toolkit
 *   coordinator computes the effective mode from PNP/profile policy material on the
 *   bound `AssessmentEntity` / `AssessmentItemRef`. See
 *   `resolveDefaultPnpEnforcement` in `policy/core/pnp-policy-inputs.ts`.
 */
export type ToolsPnpEnforcement = "on" | "off";

export interface CanonicalToolsConfig {
	policy: ToolPolicyConfig;
	placement: Required<ToolPlacementConfig>;
	providers: ToolProvidersConfig;
	/**
	 * Optional PNP/profile enforcement override. Mirrored on
	 * `runtime.tools.pnpEnforcement`; consumed by
	 * `<pie-assessment-toolkit>` and `ToolkitCoordinator` as the
	 * embedded path's equivalent of the standalone `pnp-enforcement`
	 * attribute. See {@link ToolsPnpEnforcement} for semantics.
	 */
	pnpEnforcement?: ToolsPnpEnforcement;
}

const DEFAULT_PLACEMENT: Required<ToolPlacementConfig> = {
	section: [...DEFAULT_TOOL_PLACEMENT.section],
	item: [...DEFAULT_TOOL_PLACEMENT.item],
	passage: [...DEFAULT_TOOL_PLACEMENT.passage],
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertStringArray(value: unknown, fieldPath: string): string[] {
	if (value == null) return [];
	if (!Array.isArray(value)) {
		throw new Error(
			`Invalid tools config at "${fieldPath}": expected an array of tool ids.`,
		);
	}
	const invalidEntry = value.find((entry) => typeof entry !== "string");
	if (invalidEntry !== undefined) {
		throw new Error(
			`Invalid tools config at "${fieldPath}": all entries must be strings.`,
		);
	}
	return value as string[];
}

function assertPlacementConfig(value: unknown): ToolPlacementConfig | undefined {
	if (value == null) return undefined;
	if (!isPlainObject(value)) {
		throw new Error(
			'Invalid tools config at "placement": expected an object with section/item/passage arrays.',
		);
	}
	return value as ToolPlacementConfig;
}

function assertPolicyConfig(value: unknown): ToolPolicyConfig | undefined {
	if (value == null) return undefined;
	if (!isPlainObject(value)) {
		throw new Error(
			'Invalid tools config at "policy": expected an object with allowed/blocked arrays.',
		);
	}
	return value as ToolPolicyConfig;
}

function assertProviderConfig(
	providerId: string,
	value: unknown,
): ToolProviderConfig | TextToSpeechToolProviderConfig | undefined {
	if (value == null) return undefined;
	if (!isPlainObject(value)) {
		throw new Error(
			`Invalid tools config at "providers.${providerId}": expected an object.`,
		);
	}
	const config = value as ToolProviderConfig;
	const isTTSRuntimeProviderId = (provider: unknown): boolean =>
		provider === "polly" || provider === "google" || provider === "custom";
	if (
		"enabled" in config &&
		config.enabled !== undefined &&
		typeof config.enabled !== "boolean"
	) {
		throw new Error(
			`Invalid tools config at "providers.${providerId}.enabled": expected a boolean.`,
		);
	}
	if (
		"settings" in config &&
		config.settings !== undefined &&
		!isPlainObject(config.settings)
	) {
		throw new Error(
			`Invalid tools config at "providers.${providerId}.settings": expected an object.`,
		);
	}
	if (
		"provider" in config &&
		config.provider !== undefined &&
		!isPlainObject(config.provider) &&
		!(providerId === "textToSpeech" && isTTSRuntimeProviderId(config.provider))
	) {
		throw new Error(
			`Invalid tools config at "providers.${providerId}.provider": expected an object.`,
		);
	}
	return config;
}

function assertProvidersConfig(value: unknown): ToolProvidersConfig {
	if (value == null) return {};
	if (!isPlainObject(value)) {
		throw new Error(
			'Invalid tools config at "providers": expected an object keyed by tool id.',
		);
	}
	const normalized: ToolProvidersConfig = {};
	for (const [providerId, providerConfig] of Object.entries(value)) {
		normalized[providerId] = assertProviderConfig(providerId, providerConfig);
	}
	return normalized;
}

export function normalizeToolAlias(toolId: string): string {
	const trimmed = toolId.trim();
	if (!trimmed) return "";
	return trimmed;
}

export function normalizeToolList(toolIds: string[] | undefined | null): string[] {
	if (!toolIds || toolIds.length === 0) return [];
	const deduped = new Set<string>();
	for (const rawToolId of toolIds) {
		if (typeof rawToolId !== "string") {
			throw new Error(
				"Invalid tools config: tool list entries must be strings.",
			);
		}
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

function assertPnpEnforcement(
	value: unknown,
	fieldPath: "pnpEnforcement",
): ToolsPnpEnforcement | undefined {
	if (value == null) return undefined;
	if (value === "on" || value === "off") return value;
	throw new Error(
		`Invalid tools config at "${fieldPath}": expected "on" or "off", got ${JSON.stringify(value)}.`,
	);
}

export function normalizeToolsConfig(
	input?: Partial<CanonicalToolsConfig> | null,
): CanonicalToolsConfig {
	if (input != null && !isPlainObject(input)) {
		throw new Error(
			'Invalid tools config: expected an object with "policy", "placement", and "providers".',
		);
	}
	const policy = assertPolicyConfig(input?.policy);
	const placement = assertPlacementConfig(input?.placement);
	const providers = assertProvidersConfig(input?.providers);
	const pnpEnforcement = assertPnpEnforcement(
		input?.pnpEnforcement,
		"pnpEnforcement",
	);

	const config: CanonicalToolsConfig = {
		policy: {
			allowed: normalizeToolList(assertStringArray(policy?.allowed, "policy.allowed")),
			blocked: normalizeToolList(assertStringArray(policy?.blocked, "policy.blocked")),
		},
		placement: {
			section: normalizeToolList(
				assertStringArray(placement?.section, "placement.section"),
			).length
				? normalizeToolList(assertStringArray(placement?.section, "placement.section"))
				: [...DEFAULT_PLACEMENT.section],
			item: normalizeToolList(assertStringArray(placement?.item, "placement.item"))
				.length
				? normalizeToolList(assertStringArray(placement?.item, "placement.item"))
				: [...DEFAULT_PLACEMENT.item],
			passage: normalizeToolList(
				assertStringArray(placement?.passage, "placement.passage"),
			).length
				? normalizeToolList(assertStringArray(placement?.passage, "placement.passage"))
				: [...DEFAULT_PLACEMENT.passage],
		},
		providers,
	};
	if (pnpEnforcement) {
		config.pnpEnforcement = pnpEnforcement;
	}
	return config;
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
