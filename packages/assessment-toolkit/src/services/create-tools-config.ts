import type { CanonicalToolsConfig } from "./tools-config-normalizer.js";
import type { ToolRegistry } from "./ToolRegistry.js";
import {
	normalizeAndValidateToolsConfig,
	type ToolConfigStrictness,
	type ToolConfigValidationResult,
} from "./tool-config-validation.js";

export interface CreateToolsConfigArgs {
	tools?: Partial<CanonicalToolsConfig> | null;
	toolRegistry?: ToolRegistry | null;
	strictness?: ToolConfigStrictness;
	source?: string;
}

/**
 * Host-facing helper for creating canonical tools config with validation.
 * Keeps normalization + validation behavior consistent across apps.
 */
export function createToolsConfig(
	args: CreateToolsConfigArgs,
): ToolConfigValidationResult {
	return normalizeAndValidateToolsConfig(args.tools, {
		strictness: args.strictness ?? "error",
		source: args.source ?? "createToolsConfig",
		toolRegistry: args.toolRegistry,
	});
}
