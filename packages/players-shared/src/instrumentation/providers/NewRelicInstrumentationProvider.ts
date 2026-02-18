/**
 * New Relic Instrumentation Provider
 *
 * Default provider that maintains backwards compatibility with existing
 * New Relic instrumentation.
 *
 * This provider wraps the global `window.newrelic` object provided by
 * the New Relic Browser Agent.
 *
 * @example
 * ```typescript
 * const provider = new NewRelicInstrumentationProvider();
 * await provider.initialize();
 *
 * if (provider.isReady()) {
 *   provider.trackError(new Error('Something went wrong'), {
 *     component: 'my-component',
 *     errorType: 'ValidationError'
 *   });
 * }
 * ```
 */

import type { InstrumentationConfig } from "../types.js";
import { BaseInstrumentationProvider } from "./BaseInstrumentationProvider.js";

export class NewRelicInstrumentationProvider extends BaseInstrumentationProvider {
	readonly providerId = "newrelic";
	readonly providerName = "New Relic";

	/**
	 * Initialize the New Relic provider
	 *
	 * Checks if the New Relic Browser Agent is available via `window.newrelic`.
	 * If not available, initialization succeeds but `isReady()` will return false.
	 *
	 * @param config Optional configuration
	 */
	async initialize(config?: InstrumentationConfig): Promise<void> {
		this.config = config;

		// Check if New Relic is available
		if (typeof window !== "undefined" && (window as any).newrelic) {
			this.initialized = true;
			if (this.config?.debug) {
				console.log("[NewRelicProvider] Initialized successfully");
			}
		} else {
			if (this.config?.debug) {
				console.warn(
					"[NewRelicProvider] New Relic not available (window.newrelic not found)",
				);
			}
			// Don't throw - allow graceful degradation
			this.initialized = false;
		}
	}

	/**
	 * Check if provider is ready
	 *
	 * @returns true if New Relic is available and initialized
	 */
	isReady(): boolean {
		return (
			this.initialized &&
			typeof window !== "undefined" &&
			!!(window as any).newrelic
		);
	}

	/**
	 * Cleanup provider resources
	 *
	 * Marks provider as uninitialized. The global `window.newrelic` object
	 * is not modified.
	 */
	destroy(): void {
		this.initialized = false;
		if (this.config?.debug) {
			console.log("[NewRelicProvider] Destroyed");
		}
	}

	/**
	 * Track an error with New Relic
	 *
	 * Calls `newrelic.noticeError(error, attributes)`
	 *
	 * @param error The error to track
	 * @param attributes Transformed attributes (already filtered and transformed by base class)
	 */
	protected doTrackError(error: Error, attributes: Record<string, any>): void {
		const newrelic = (window as any).newrelic;
		newrelic.noticeError(error, attributes);
	}

	/**
	 * Track a custom event/page action with New Relic
	 *
	 * Calls `newrelic.addPageAction(eventName, attributes)`
	 *
	 * @param eventName Name of the event
	 * @param attributes Transformed attributes (already filtered and transformed by base class)
	 */
	protected doTrackEvent(
		eventName: string,
		attributes: Record<string, any>,
	): void {
		const newrelic = (window as any).newrelic;
		newrelic.addPageAction(eventName, attributes);
	}

	/**
	 * Set user context for session tracking
	 *
	 * Calls `newrelic.setUserId()` and `newrelic.setCustomAttribute()` for user attributes.
	 *
	 * @param userId User identifier
	 * @param attributes Optional user attributes
	 */
	protected doSetUserContext(
		userId: string,
		attributes?: Record<string, any>,
	): void {
		const newrelic = (window as any).newrelic;

		// Set user ID if method exists
		if (newrelic.setUserId) {
			newrelic.setUserId(userId);
		}

		// Set custom attributes for user
		if (attributes && newrelic.setCustomAttribute) {
			for (const [key, value] of Object.entries(attributes)) {
				newrelic.setCustomAttribute(key, value);
			}
		}
	}

	/**
	 * Set global custom attributes
	 *
	 * Calls `newrelic.setCustomAttribute()` for each attribute.
	 *
	 * @param attributes Attributes to set globally
	 */
	protected doSetGlobalAttributes(attributes: Record<string, any>): void {
		const newrelic = (window as any).newrelic;

		if (newrelic.setCustomAttribute) {
			for (const [key, value] of Object.entries(attributes)) {
				newrelic.setCustomAttribute(key, value);
			}
		}
	}
}
