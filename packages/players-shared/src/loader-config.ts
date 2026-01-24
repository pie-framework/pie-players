/**
 * Shared loader configuration for PIE custom elements.
 *
 * Mirrors the `LoaderConfig` used by PIEOneer's custom element tags.
 */

import type { InstrumentationProvider } from "./instrumentation/types";

export type LoaderConfig = {
	/**
	 * Enable tracking page actions/events.
	 *
	 * When true, instrumentation events will be sent to the instrumentation provider.
	 */
	trackPageActions?: boolean;

	/**
	 * Instrumentation provider for tracking events and errors.
	 *
	 * Optional. If not provided, defaults to NewRelicInstrumentationProvider.
	 * The provider handles instrumentation gracefully - if New Relic (or the configured
	 * backend) is not available, it will simply not track events (no errors thrown).
	 *
	 * @example Using New Relic (default - no configuration needed)
	 * ```typescript
	 * // Just enable tracking - will use New Relic if window.newrelic is available
	 * const loaderConfig = {
	 *   trackPageActions: true
	 * };
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
	 * const loaderConfig = {
	 *   trackPageActions: true,
	 *   instrumentationProvider: provider
	 * };
	 * ```
	 *
	 * @example Using Console provider (for development/debugging)
	 * ```typescript
	 * import { ConsoleInstrumentationProvider } from '@pie-framework/pie-players-shared';
	 *
	 * const provider = new ConsoleInstrumentationProvider({ useColors: true });
	 * await provider.initialize({ debug: true });
	 *
	 * const loaderConfig = {
	 *   trackPageActions: true,
	 *   instrumentationProvider: provider
	 * };
	 * ```
	 */
	instrumentationProvider?: InstrumentationProvider;

	/**
	 * Maximum number of retry attempts for failed resources (images/audio/video).
	 */
	maxResourceRetries?: number;

	/**
	 * Initial delay in ms before first resource retry attempt (exponential backoff).
	 */
	resourceRetryDelay?: number;
};

export const DEFAULT_LOADER_CONFIG = {
	trackPageActions: false,
	instrumentationProvider: undefined,
	maxResourceRetries: 3,
	resourceRetryDelay: 500,
} as const;
