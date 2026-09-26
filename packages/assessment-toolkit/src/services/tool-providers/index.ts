/**
 * Tool Provider System
 *
 * Unified framework for managing assessment tools with authentication,
 * configuration, and lifecycle management.
 *
 * Part of PIE Assessment Toolkit.
 */

// Core interfaces
export type {
	ToolProviderApi,
	ToolCategory,
	ToolProviderCapabilities,
} from "./ToolProviderApi.js";

// Registry
export { ToolProviderRegistry } from "./ToolProviderRegistry.js";
export type { ToolProviderConfig } from "./ToolProviderRegistry.js";

// Concrete providers. The calculator adapters live in the composition layer,
// `@pie-players/pie-default-tool-loaders`, which owns the engine imports.
export { TTSToolProvider } from "./TTSToolProvider.js";
export type {
	TTSToolProviderConfig,
	TTSBackend,
} from "./TTSToolProvider.js";
