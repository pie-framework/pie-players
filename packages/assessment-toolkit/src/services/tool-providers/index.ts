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
	IToolProvider,
	ToolCategory,
	ToolProviderCapabilities,
} from "./IToolProvider.js";

// Registry
export { ToolProviderRegistry } from "./ToolProviderRegistry.js";
export type { ToolProviderConfig } from "./ToolProviderRegistry.js";

// Concrete providers
export { DesmosToolProvider } from "./DesmosToolProvider.js";
export type { DesmosToolProviderConfig } from "./DesmosToolProvider.js";

export { TIToolProvider } from "./TIToolProvider.js";
export type { TIToolProviderConfig } from "./TIToolProvider.js";

export { TTSToolProvider } from "./TTSToolProvider.js";
export type {
	TTSToolProviderConfig,
	TTSBackend,
} from "./TTSToolProvider.js";
