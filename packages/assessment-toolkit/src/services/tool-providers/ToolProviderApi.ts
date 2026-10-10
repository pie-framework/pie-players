/**
 * Tool Provider API
 *
 * Unified interface for all assessment tools that require
 * configuration, authentication, or external services.
 */

export type ToolCategory =
	| "calculator"
	| "tts"
	| "translation"
	| "annotation"
	| "accessibility"
	| "other";

/**
 * A tool's provider. It registers under its tool's id, which is how the toolkit
 * and the tool find it; it carries no id of its own.
 *
 * Config takes no type parameter (ADR 0002): an implementation narrows it in its
 * own method signatures.
 */
export interface ToolProviderApi<TInstance = any> {
	readonly providerName: string;
	readonly category: ToolCategory;
	readonly version: string;
	readonly requiresAuth: boolean;
	initialize(config: unknown): Promise<void>;
	createInstance(config?: unknown): Promise<TInstance>;
	isReady(): boolean;
	destroy(): void;
}
