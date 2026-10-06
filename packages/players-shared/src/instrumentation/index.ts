/**
 * Instrumentation Module
 *
 * Provides pluggable instrumentation for PIE players.
 * Supports multiple providers (New Relic, console logging, custom, etc.)
 * Players take the provider as `loaderConfig.instrumentationProvider`.
 *
 * @example Using New Relic (default)
 * ```typescript
 * import { NewRelicInstrumentationProvider } from '@pie-players/pie-players-shared';
 *
 * const provider = new NewRelicInstrumentationProvider();
 * await provider.initialize();
 *
 * const loaderConfig = {
 *   trackPageActions: true,
 *   instrumentationProvider: provider
 * };
 * ```
 * @example Using console logger for development
 * ```typescript
 * import { ConsoleInstrumentationProvider } from '@pie-players/pie-players-shared';
 *
 * const provider = new ConsoleInstrumentationProvider();
 * await provider.initialize({ debug: true });
 *
 * const loaderConfig = {
 *   trackPageActions: true,
 *   instrumentationProvider: provider
 * };
 * ```
 */

// Providers
export * from "./providers/index.js";
export { isInstrumentationProvider } from "./provider-guards.js";
export {
	clearBufferedInstrumentationDebugRecords,
	getBufferedInstrumentationDebugRecords,
	INSTRUMENTATION_DEBUG_EVENT_NAME,
	subscribeInstrumentationDebugRecords,
} from "./debug-panel-stream.js";
export type { InstrumentationDebugRecord } from "./debug-panel-stream.js";
// Core types
export type {
	ErrorAttributes,
	EventAttributes,
	InstrumentationConfig,
	InstrumentationProvider,
	MetricAttributes,
} from "./types.js";
