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

export interface ToolProviderCapabilities {
	supportsOffline: boolean;
	requiresAuth: boolean;
	maxInstances?: number | null;
	features: Record<string, boolean>;
}

export interface ToolProviderApi<TConfig = any, TInstance = any> {
	readonly providerId: string;
	readonly providerName: string;
	readonly category: ToolCategory;
	readonly version: string;
	readonly requiresAuth: boolean;
	initialize(config: TConfig): Promise<void>;
	createInstance(config?: Partial<TConfig>): Promise<TInstance>;
	getCapabilities(): ToolProviderCapabilities;
	isReady(): boolean;
	destroy(): void;
}
