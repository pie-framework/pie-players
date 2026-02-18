/**
 * DataDog RUM Instrumentation Provider
 *
 * Example alternative provider for DataDog Real User Monitoring.
 * Demonstrates how to integrate with a third-party instrumentation service.
 *
 * NOTE: This provider requires `@datadog/browser-rum` to be installed:
 * ```bash
 * npm install @datadog/browser-rum
 * ```
 *
 * @example
 * ```typescript
 * const provider = new DataDogInstrumentationProvider();
 * await provider.initialize({
 *   enabled: true,
 *   sampleRate: 1.0,
 *   providerSettings: {
 *     applicationId: 'abc123',
 *     clientToken: 'pub_xyz',
 *     site: 'datadoghq.com',
 *     service: 'pie-players',
 *     env: 'production'
 *   }
 * });
 *
 * provider.trackError(new Error('Something went wrong'), {
 *   component: 'my-component',
 *   errorType: 'ValidationError'
 * });
 * ```
 */

import type { InstrumentationConfig } from "../types.js";
import { BaseInstrumentationProvider } from "./BaseInstrumentationProvider.js";

/**
 * DataDog-specific configuration
 */
export interface DataDogConfig {
	/**
	 * DataDog application ID
	 *
	 * Required. Get this from DataDog RUM application settings.
	 */
	applicationId: string;

	/**
	 * DataDog client token
	 *
	 * Required. Get this from DataDog RUM application settings.
	 */
	clientToken: string;

	/**
	 * DataDog site
	 *
	 * @default 'datadoghq.com'
	 * @example 'datadoghq.eu' for EU
	 */
	site?: string;

	/**
	 * Service name
	 *
	 * @default 'pie-players'
	 */
	service?: string;

	/**
	 * Environment name
	 *
	 * @default 'production'
	 * @example 'development', 'staging', 'production'
	 */
	env?: string;

	/**
	 * Application version
	 *
	 * @default '1.0.0'
	 */
	version?: string;

	/**
	 * Session replay sample rate (0-100)
	 *
	 * @default 0 (disabled)
	 * @example 20 to record 20% of sessions
	 */
	sessionReplaySampleRate?: number;

	/**
	 * Track user interactions
	 *
	 * @default true
	 */
	trackUserInteractions?: boolean;

	/**
	 * Track long tasks
	 *
	 * @default true
	 */
	trackLongTasks?: boolean;

	/**
	 * Default privacy level for session replay
	 *
	 * @default 'mask-user-input'
	 */
	defaultPrivacyLevel?: "allow" | "mask" | "mask-user-input";
}

/**
 * DataDog RUM Instrumentation Provider
 *
 * Integrates PIE players instrumentation with DataDog Real User Monitoring.
 */
export class DataDogInstrumentationProvider extends BaseInstrumentationProvider {
	readonly providerId = "datadog";
	readonly providerName = "DataDog RUM";

	private datadogConfig?: DataDogConfig;

	/**
	 * Initialize the DataDog provider
	 *
	 * Loads the DataDog RUM SDK and initializes it with the provided configuration.
	 *
	 * @param config Instrumentation configuration with DataDog-specific settings
	 * @throws {Error} If DataDog configuration is invalid or SDK fails to load
	 */
	async initialize(config?: InstrumentationConfig): Promise<void> {
		if (typeof window === "undefined") {
			throw new Error(
				"[DataDogProvider] DataDog RUM requires browser environment",
			);
		}

		this.config = config;
		this.datadogConfig = config?.providerSettings as DataDogConfig;

		if (
			!this.datadogConfig?.applicationId ||
			!this.datadogConfig?.clientToken
		) {
			throw new Error(
				"[DataDogProvider] applicationId and clientToken are required in providerSettings",
			);
		}

		try {
			// Dynamically import DataDog RUM SDK
			// @ts-expect-error - Optional peer dependency
			const { datadogRum } = await import("@datadog/browser-rum");

			// Initialize DataDog RUM
			datadogRum.init({
				applicationId: this.datadogConfig.applicationId,
				clientToken: this.datadogConfig.clientToken,
				site: this.datadogConfig.site || "datadoghq.com",
				service: this.datadogConfig.service || "pie-players",
				env: this.datadogConfig.env || "production",
				version: this.datadogConfig.version || "1.0.0",
				sessionSampleRate:
					config?.sampleRate !== undefined ? config.sampleRate * 100 : 100,
				sessionReplaySampleRate:
					this.datadogConfig.sessionReplaySampleRate || 0,
				trackUserInteractions:
					this.datadogConfig.trackUserInteractions !== false,
				trackResources: true,
				trackLongTasks: this.datadogConfig.trackLongTasks !== false,
				defaultPrivacyLevel:
					this.datadogConfig.defaultPrivacyLevel || "mask-user-input",
			});

			// Start session replay if configured
			if (
				this.datadogConfig.sessionReplaySampleRate &&
				this.datadogConfig.sessionReplaySampleRate > 0
			) {
				datadogRum.startSessionReplayRecording();
			}

			this.initialized = true;

			if (this.config?.debug) {
				console.log(
					"[DataDogProvider] Initialized successfully",
					this.datadogConfig,
				);
			}
		} catch (error) {
			console.error("[DataDogProvider] Failed to initialize:", error);
			throw error;
		}
	}

	/**
	 * Check if provider is ready
	 *
	 * @returns true if DataDog is initialized
	 */
	isReady(): boolean {
		return this.initialized;
	}

	/**
	 * Cleanup provider resources
	 *
	 * Marks provider as uninitialized. DataDog RUM SDK is not explicitly
	 * destroyed (no cleanup API available).
	 */
	destroy(): void {
		this.initialized = false;
		if (this.config?.debug) {
			console.log("[DataDogProvider] Destroyed");
		}
	}

	/**
	 * Track an error with DataDog
	 *
	 * Calls `datadogRum.addError()`
	 *
	 * @param error The error to track
	 * @param attributes Transformed attributes (already filtered and transformed by base class)
	 */
	protected doTrackError(error: Error, attributes: Record<string, any>): void {
		// DataDog requires dynamic import
		// @ts-expect-error - Optional peer dependency
		import("@datadog/browser-rum").then(({ datadogRum }) => {
			datadogRum.addError(error, {
				...attributes,
				source: "custom",
			});
		});
	}

	/**
	 * Track a custom event/action with DataDog
	 *
	 * Calls `datadogRum.addAction()`
	 *
	 * @param eventName Name of the event
	 * @param attributes Transformed attributes (already filtered and transformed by base class)
	 */
	protected doTrackEvent(
		eventName: string,
		attributes: Record<string, any>,
	): void {
		// DataDog requires dynamic import
		// @ts-expect-error - Optional peer dependency
		import("@datadog/browser-rum").then(({ datadogRum }) => {
			datadogRum.addAction(eventName, attributes);
		});
	}

	/**
	 * Set user context for session tracking
	 *
	 * Calls `datadogRum.setUser()`
	 *
	 * @param userId User identifier
	 * @param attributes Optional user attributes
	 */
	protected doSetUserContext(
		userId: string,
		attributes?: Record<string, any>,
	): void {
		// DataDog requires dynamic import
		// @ts-expect-error - Optional peer dependency
		import("@datadog/browser-rum").then(({ datadogRum }) => {
			datadogRum.setUser({
				id: userId,
				...attributes,
			});
		});
	}

	/**
	 * Set global custom attributes
	 *
	 * Calls `datadogRum.setGlobalContextProperty()` for each attribute.
	 *
	 * @param attributes Attributes to set globally
	 */
	protected doSetGlobalAttributes(attributes: Record<string, any>): void {
		// DataDog requires dynamic import
		// @ts-expect-error - Optional peer dependency
		import("@datadog/browser-rum").then(({ datadogRum }) => {
			for (const [key, value] of Object.entries(attributes)) {
				datadogRum.setGlobalContextProperty(key, value);
			}
		});
	}
}
