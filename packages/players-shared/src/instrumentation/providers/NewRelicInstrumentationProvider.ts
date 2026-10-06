/**
 * New Relic Instrumentation Provider
 *
 * Default provider for existing New Relic Browser Agent instrumentation.
 *
 * Sends through the New Relic Browser Agent's API on `window.newrelic` or
 * `window.NREUM`, looked up on every call, so an agent that loads after
 * `initialize()` receives everything tracked from then on.
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

import { probeNewRelicAgent } from "../new-relic-agent.js";
import type { InstrumentationConfig } from "../types.js";
import { BaseInstrumentationProvider } from "./BaseInstrumentationProvider.js";

export class NewRelicInstrumentationProvider extends BaseInstrumentationProvider {
	readonly providerId = "newrelic";
	readonly providerName = "New Relic";

	/**
	 * Initialize the New Relic provider
	 *
	 * Configures the provider. The agent does not have to be on the page yet:
	 * `isReady()` turns true when it arrives.
	 *
	 * @param config Optional configuration
	 */
	async initialize(config?: InstrumentationConfig): Promise<void> {
		this.config = config;
		this.initialized = true;
		if (this.config?.debug) {
			console.log(
				probeNewRelicAgent()
					? "[NewRelicProvider] Initialized successfully"
					: "[NewRelicProvider] Initialized; sends once the New Relic agent is on the page",
			);
		}
	}

	/**
	 * Check if provider is ready
	 *
	 * @returns true once initialized, while the New Relic agent's API is on the page
	 */
	isReady(): boolean {
		return this.initialized && probeNewRelicAgent() !== undefined;
	}

	/**
	 * Cleanup provider resources
	 *
	 * Marks provider as uninitialized. The agent's globals are not modified.
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
		probeNewRelicAgent()?.noticeError(error, attributes);
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
		probeNewRelicAgent()?.addPageAction(eventName, attributes);
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
		const newrelic = probeNewRelicAgent();

		// Set user ID if method exists
		if (typeof newrelic?.setUserId === "function") {
			newrelic.setUserId(userId);
		}

		// Set custom attributes for user
		if (attributes && typeof newrelic?.setCustomAttribute === "function") {
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
		const newrelic = probeNewRelicAgent();

		if (typeof newrelic?.setCustomAttribute === "function") {
			for (const [key, value] of Object.entries(attributes)) {
				newrelic.setCustomAttribute(key, value);
			}
		}
	}
}
