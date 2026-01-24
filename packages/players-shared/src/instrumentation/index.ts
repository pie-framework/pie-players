/**
 * Instrumentation Module
 *
 * Provides pluggable instrumentation for PIE players.
 * Supports multiple providers (New Relic, DataDog, console logging, custom, etc.)
 *
 * @example Using New Relic (default)
 * ```typescript
 * import { NewRelicInstrumentationProvider } from '@pie-framework/pie-players-shared';
 *
 * const provider = new NewRelicInstrumentationProvider();
 * await provider.initialize();
 *
 * const monitor = new ResourceMonitor({
 *   trackPageActions: true,
 *   instrumentationProvider: provider
 * });
 * ```
 *
 * @example Using DataDog
 * ```typescript
 * import { DataDogInstrumentationProvider } from '@pie-framework/pie-players-shared';
 *
 * const provider = new DataDogInstrumentationProvider();
 * await provider.initialize({
 *   providerSettings: {
 *     applicationId: 'abc123',
 *     clientToken: 'pub_xyz'
 *   }
 * });
 *
 * const monitor = new ResourceMonitor({
 *   trackPageActions: true,
 *   instrumentationProvider: provider
 * });
 * ```
 *
 * @example Using console logger for development
 * ```typescript
 * import { ConsoleInstrumentationProvider } from '@pie-framework/pie-players-shared';
 *
 * const provider = new ConsoleInstrumentationProvider();
 * await provider.initialize({ debug: true });
 *
 * const monitor = new ResourceMonitor({
 *   trackPageActions: true,
 *   instrumentationProvider: provider
 * });
 * ```
 */

// Providers
export * from "./providers";
// Core types
export type {
	ErrorAttributes,
	EventAttributes,
	InstrumentationConfig,
	InstrumentationProvider,
	MetricAttributes,
} from "./types";
