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
} from "./IToolProvider";

// Registry
export { ToolProviderRegistry } from "./ToolProviderRegistry";
export type { ToolProviderConfig } from "./ToolProviderRegistry";

// Concrete providers
export { DesmosToolProvider } from "./DesmosToolProvider";
export type { DesmosToolProviderConfig } from "./DesmosToolProvider";

export { TIToolProvider } from "./TIToolProvider";
export type { TIToolProviderConfig } from "./TIToolProvider";

export { TTSToolProvider } from "./TTSToolProvider";
export type {
	TTSToolProviderConfig,
	TTSBackend,
} from "./TTSToolProvider";
