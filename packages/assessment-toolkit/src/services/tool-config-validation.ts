import {
	normalizeToolsConfig,
	type CanonicalToolsConfig,
	type ToolPlacementLevel,
	type ToolProviderConfig,
} from "./tools-config-normalizer.js";
import type { ToolRegistration, ToolRegistry } from "./ToolRegistry.js";
import { createPackagedToolRegistry } from "./createDefaultToolRegistry.js";

export type ToolConfigStrictness = "off" | "warn" | "error";

export type ToolConfigDiagnosticSeverity = "warning" | "error";

export interface ToolConfigDiagnostic {
	code:
		| "tools.unknownToolId"
		| "tools.unsupportedLevel"
		| "tools.unknownProviderKey"
		| "tools.deprecatedProviderKey"
		| "tools.providerSanitizeFailed"
		| "tools.providerValidateFailed"
		| "tools.invalidProviderValidation";
	severity: ToolConfigDiagnosticSeverity;
	path: string;
	message: string;
	toolId?: string;
	providerId?: string;
}

export interface ToolConfigValidationOptions {
	strictness?: ToolConfigStrictness;
	source?: string;
	toolRegistry?: ToolRegistry | null;
}

export interface ToolConfigValidationResult {
	config: CanonicalToolsConfig;
	diagnostics: ToolConfigDiagnostic[];
}

const DEFAULT_STRICTNESS: ToolConfigStrictness = "error";

export function normalizeToolConfigStrictness(
	value: unknown,
): ToolConfigStrictness {
	if (value === "off" || value === "warn" || value === "error") {
		return value;
	}
	return DEFAULT_STRICTNESS;
}

function createDiagnostic(
	diagnostic: ToolConfigDiagnostic,
): ToolConfigDiagnostic {
	return diagnostic;
}

function getRegistryToolMap(
	toolRegistry: ToolRegistry | null | undefined,
): Map<string, ToolRegistration> {
	if (!toolRegistry) return new Map();
	return new Map(
		toolRegistry
			.getAllTools()
			.slice()
			.sort((left, right) => left.toolId.localeCompare(right.toolId))
			.map((tool) => [tool.toolId, tool]),
	);
}

function sanitizeProviderConfig(
	providerId: string,
	providerConfig: ToolProviderConfig | undefined,
	tool: ToolRegistration | undefined,
	diagnostics: ToolConfigDiagnostic[],
): ToolProviderConfig | undefined {
	if (!providerConfig || !tool?.provider?.sanitizeConfig) return providerConfig;
	try {
		const sanitized = tool.provider.sanitizeConfig(providerConfig);
		if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
			diagnostics.push(
				createDiagnostic({
					code: "tools.providerSanitizeFailed",
					severity: "error",
					path: `providers.${providerId}`,
					message: `Provider sanitizer for "${providerId}" must return an object.`,
					providerId,
					toolId: providerId,
				}),
			);
			return providerConfig;
		}
		return sanitized as ToolProviderConfig;
	} catch (error) {
		diagnostics.push(
			createDiagnostic({
				code: "tools.providerSanitizeFailed",
				severity: "error",
				path: `providers.${providerId}`,
				message: `Provider sanitizer failed for "${providerId}": ${
					error instanceof Error ? error.message : String(error)
				}`,
				providerId,
				toolId: providerId,
			}),
		);
		return providerConfig;
	}
}

function validateProviderConfig(
	providerId: string,
	providerConfig: ToolProviderConfig | undefined,
	tool: ToolRegistration | undefined,
	diagnostics: ToolConfigDiagnostic[],
): void {
	if (!providerConfig || !tool?.provider?.validateConfig) return;
	try {
		const providerDiagnostics = tool.provider.validateConfig(providerConfig);
		if (!Array.isArray(providerDiagnostics)) {
			diagnostics.push(
				createDiagnostic({
					code: "tools.invalidProviderValidation",
					severity: "error",
					path: `providers.${providerId}`,
					message: `Provider validator for "${providerId}" must return an array.`,
					providerId,
					toolId: providerId,
				}),
			);
			return;
		}
		for (const diagnostic of providerDiagnostics) {
			diagnostics.push({
				...diagnostic,
				path: diagnostic.path || `providers.${providerId}`,
				providerId: diagnostic.providerId || providerId,
				toolId: diagnostic.toolId || providerId,
			});
		}
	} catch (error) {
		diagnostics.push(
			createDiagnostic({
				code: "tools.providerValidateFailed",
				severity: "error",
				path: `providers.${providerId}`,
				message: `Provider validator failed for "${providerId}": ${
					error instanceof Error ? error.message : String(error)
				}`,
				providerId,
				toolId: providerId,
			}),
		);
	}
}

function collectPlacementDiagnostics(
	config: CanonicalToolsConfig,
	toolMap: Map<string, ToolRegistration>,
	diagnostics: ToolConfigDiagnostic[],
): void {
	if (toolMap.size === 0) return;
	const levelOrder: ToolPlacementLevel[] = ["section", "item", "passage"];
	for (const level of levelOrder) {
		for (const toolId of config.placement[level]) {
			const tool = toolMap.get(toolId);
			if (!tool) {
				diagnostics.push(
					createDiagnostic({
						code: "tools.unknownToolId",
						severity: "error",
						path: `placement.${level}`,
						message: `Unknown tool id "${toolId}" in placement.${level}.`,
						toolId,
					}),
				);
				continue;
			}
			if (!tool.supportedLevels.includes(level)) {
				diagnostics.push(
					createDiagnostic({
						code: "tools.unsupportedLevel",
						severity: "error",
						path: `placement.${level}`,
						message: `Tool "${toolId}" does not support level "${level}".`,
						toolId,
					}),
				);
			}
		}
	}
}

function collectPolicyDiagnostics(
	config: CanonicalToolsConfig,
	toolMap: Map<string, ToolRegistration>,
	diagnostics: ToolConfigDiagnostic[],
): void {
	if (toolMap.size === 0) return;
	for (const toolId of config.policy.allowed || []) {
		if (toolMap.has(toolId)) continue;
		diagnostics.push(
			createDiagnostic({
				code: "tools.unknownToolId",
				severity: "error",
				path: "policy.allowed",
				message: `Unknown tool id "${toolId}" in policy.allowed.`,
				toolId,
			}),
		);
	}
	for (const toolId of config.policy.blocked || []) {
		if (toolMap.has(toolId)) continue;
		diagnostics.push(
			createDiagnostic({
				code: "tools.unknownToolId",
				severity: "error",
				path: "policy.blocked",
				message: `Unknown tool id "${toolId}" in policy.blocked.`,
				toolId,
			}),
		);
	}
}

function collectProviderKeyDiagnostics(
	config: CanonicalToolsConfig,
	toolMap: Map<string, ToolRegistration>,
	hasDeprecatedTtsKey: boolean,
	diagnostics: ToolConfigDiagnostic[],
): void {
	if (hasDeprecatedTtsKey) {
		diagnostics.push(
			createDiagnostic({
				code: "tools.deprecatedProviderKey",
				severity: "error",
				path: "providers.tts",
				message:
					`Provider key "tts" is no longer supported. Use "providers.textToSpeech".`,
				providerId: "tts",
				toolId: "textToSpeech",
			}),
		);
	}
	for (const providerId of Object.keys(config.providers).sort()) {
		if (toolMap.size === 0 || toolMap.has(providerId)) continue;
		diagnostics.push(
			createDiagnostic({
				code: "tools.unknownProviderKey",
				severity: "error",
				path: `providers.${providerId}`,
				message: `Unknown provider key "${providerId}".`,
				providerId,
				toolId: providerId,
			}),
		);
	}
}

function emitWarnings(
	diagnostics: ToolConfigDiagnostic[],
	source: string,
): void {
	if (diagnostics.length === 0) return;
	for (const diagnostic of diagnostics) {
		const prefix = `[tool-config-validation:${source}]`;
		console.warn(`${prefix} ${diagnostic.path} - ${diagnostic.message}`);
	}
}

function throwValidationError(
	diagnostics: ToolConfigDiagnostic[],
	source: string,
): never {
	const formatted = diagnostics
		.map((diagnostic) => `- ${diagnostic.path}: ${diagnostic.message}`)
		.join("\n");
	throw new Error(`[tool-config-validation:${source}] Invalid tools config:\n${formatted}`);
}

export function normalizeAndValidateToolsConfig(
	input?: Partial<CanonicalToolsConfig> | null,
	options: ToolConfigValidationOptions = {},
): ToolConfigValidationResult {
	const strictness = normalizeToolConfigStrictness(options.strictness);
	const source = options.source ?? "tools";
	const registryTools = getRegistryToolMap(
		options.toolRegistry ?? createPackagedToolRegistry(),
	);
	const normalized = normalizeToolsConfig(input);
	const diagnostics: ToolConfigDiagnostic[] = [];
	const hasDeprecatedTtsKey = Object.prototype.hasOwnProperty.call(
		normalized.providers,
		"tts",
	);

	const nextProviders: CanonicalToolsConfig["providers"] = {
		...(normalized.providers || {}),
	};
	for (const providerId of Object.keys(nextProviders).sort()) {
		if (providerId === "tts") {
			delete nextProviders.tts;
			continue;
		}
		const tool = registryTools.get(providerId);
		nextProviders[providerId] = sanitizeProviderConfig(
			providerId,
			nextProviders[providerId],
			tool,
			diagnostics,
		);
		validateProviderConfig(providerId, nextProviders[providerId], tool, diagnostics);
	}
	const nextConfig: CanonicalToolsConfig = {
		...normalized,
		providers: nextProviders,
	};

	collectPlacementDiagnostics(nextConfig, registryTools, diagnostics);
	collectPolicyDiagnostics(nextConfig, registryTools, diagnostics);
	collectProviderKeyDiagnostics(
		nextConfig,
		registryTools,
		hasDeprecatedTtsKey,
		diagnostics,
	);
	if (hasDeprecatedTtsKey) {
		throwValidationError(
			diagnostics.filter(
				(entry) => entry.code === "tools.deprecatedProviderKey",
			),
			source,
		);
	}

	if (strictness === "warn") {
		emitWarnings(diagnostics, source);
	}
	if (strictness === "error" && diagnostics.length > 0) {
		throwValidationError(diagnostics, source);
	}

	return {
		config: nextConfig,
		diagnostics,
	};
}
