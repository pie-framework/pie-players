/**
 * Console Instrumentation Provider
 *
 * Development provider that logs instrumentation events to the console.
 * Useful for debugging and testing without requiring external instrumentation services.
 *
 * @example
 * ```typescript
 * const provider = new ConsoleInstrumentationProvider();
 * await provider.initialize({ debug: true });
 *
 * provider.trackError(new Error('Test error'), {
 *   component: 'test-component',
 *   errorType: 'TestError'
 * });
 * // Outputs: [Instrumentation Error] test-component: TestError
 * //          Error: Test error
 * //          { component: 'test-component', errorType: 'TestError' }
 * ```
 */

import type { InstrumentationConfig, MetricAttributes } from "../types";
import { BaseInstrumentationProvider } from "./BaseInstrumentationProvider";

export interface ConsoleProviderConfig {
	/**
	 * Use colored output in console
	 *
	 * @default true
	 */
	useColors?: boolean;

	/**
	 * Include stack traces with errors
	 *
	 * @default true
	 */
	includeStackTrace?: boolean;

	/**
	 * Group related logs together
	 *
	 * @default false
	 */
	useGroups?: boolean;
}

export class ConsoleInstrumentationProvider extends BaseInstrumentationProvider {
	readonly providerId = "console";
	readonly providerName = "Console Logger";

	private providerConfig: ConsoleProviderConfig;

	constructor(providerConfig: ConsoleProviderConfig = {}) {
		super();
		this.providerConfig = {
			useColors: providerConfig.useColors !== false,
			includeStackTrace: providerConfig.includeStackTrace !== false,
			useGroups: providerConfig.useGroups === true,
		};
	}

	/**
	 * Initialize the console provider
	 *
	 * @param config Optional configuration
	 */
	async initialize(config?: InstrumentationConfig): Promise<void> {
		this.config = config;
		this.initialized = true;

		// Merge provider-specific config if provided
		if (config?.providerSettings) {
			this.providerConfig = {
				...this.providerConfig,
				...config.providerSettings,
			};
		}

		console.log(
			"%c[ConsoleProvider] Initialized",
			this.providerConfig.useColors ? "color: green; font-weight: bold" : "",
		);
	}

	/**
	 * Check if provider is ready
	 *
	 * @returns true if initialized
	 */
	isReady(): boolean {
		return this.initialized;
	}

	/**
	 * Cleanup provider resources
	 */
	destroy(): void {
		this.initialized = false;
		console.log(
			"%c[ConsoleProvider] Destroyed",
			this.providerConfig.useColors ? "color: gray" : "",
		);
	}

	/**
	 * Track an error to console
	 *
	 * @param error The error to track
	 * @param attributes Transformed attributes (already filtered and transformed by base class)
	 */
	protected doTrackError(error: Error, attributes: Record<string, any>): void {
		const style = this.providerConfig.useColors
			? "color: red; font-weight: bold"
			: "";
		const timestamp = new Date().toISOString();

		if (this.providerConfig.useGroups) {
			console.groupCollapsed(
				`%c[Instrumentation Error] ${attributes.component}: ${attributes.errorType}`,
				style,
			);
			console.error("Error:", error.message);
			if (this.providerConfig.includeStackTrace && error.stack) {
				console.error("Stack:", error.stack);
			}
			console.log("Attributes:", attributes);
			console.log("Timestamp:", timestamp);
			console.groupEnd();
		} else {
			console.error(
				`%c[Instrumentation Error] ${attributes.component}: ${attributes.errorType}`,
				style,
			);
			console.error("Error:", error.message);
			if (this.providerConfig.includeStackTrace && error.stack) {
				console.error("Stack:", error.stack);
			}
			console.error("Attributes:", attributes);
			console.error("Timestamp:", timestamp);
		}
	}

	/**
	 * Track an event to console
	 *
	 * @param eventName Name of the event
	 * @param attributes Transformed attributes (already filtered and transformed by base class)
	 */
	protected doTrackEvent(
		eventName: string,
		attributes: Record<string, any>,
	): void {
		const style = this.providerConfig.useColors ? "color: blue" : "";
		const timestamp = new Date().toISOString();

		if (this.providerConfig.useGroups) {
			console.groupCollapsed(`%c[Instrumentation Event] ${eventName}`, style);
			console.log("Attributes:", attributes);
			console.log("Timestamp:", timestamp);
			console.groupEnd();
		} else {
			console.log(`%c[Instrumentation Event] ${eventName}`, style);
			console.log("Attributes:", attributes);
			console.log("Timestamp:", timestamp);
		}
	}

	/**
	 * Track a metric to console
	 *
	 * Overrides base class to provide custom formatting.
	 *
	 * @param metricName Name of the metric
	 * @param value Numeric value
	 * @param attributes Optional metric attributes
	 */
	trackMetric(
		metricName: string,
		value: number,
		attributes?: MetricAttributes,
	): void {
		if (!this.isReady()) return;

		const style = this.providerConfig.useColors ? "color: green" : "";
		const timestamp = new Date().toISOString();
		const unit = attributes?.unit || "";
		const displayValue = unit ? `${value} ${unit}` : value;

		if (this.providerConfig.useGroups) {
			console.groupCollapsed(
				`%c[Instrumentation Metric] ${metricName}: ${displayValue}`,
				style,
			);
			if (attributes) {
				console.log("Attributes:", attributes);
			}
			console.log("Timestamp:", timestamp);
			console.groupEnd();
		} else {
			console.log(
				`%c[Instrumentation Metric] ${metricName}:`,
				style,
				displayValue,
			);
			if (attributes) {
				console.log("Attributes:", attributes);
			}
			console.log("Timestamp:", timestamp);
		}
	}

	/**
	 * Set user context
	 *
	 * Logs user context to console.
	 *
	 * @param userId User identifier
	 * @param attributes Optional user attributes
	 */
	protected doSetUserContext(
		userId: string,
		attributes?: Record<string, any>,
	): void {
		const style = this.providerConfig.useColors
			? "color: purple; font-weight: bold"
			: "";
		console.log(`%c[Instrumentation] Set User Context: ${userId}`, style);
		if (attributes) {
			console.log("User Attributes:", attributes);
		}
	}

	/**
	 * Set global attributes
	 *
	 * Logs global attributes to console.
	 *
	 * @param attributes Attributes to set globally
	 */
	protected doSetGlobalAttributes(attributes: Record<string, any>): void {
		const style = this.providerConfig.useColors
			? "color: orange; font-weight: bold"
			: "";
		console.log("%c[Instrumentation] Set Global Attributes", style);
		console.log("Attributes:", attributes);
	}
}
