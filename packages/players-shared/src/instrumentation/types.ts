/**
 * Instrumentation Types
 *
 * Core interfaces and types for pluggable instrumentation system.
 * Abstracts vendor-specific APIs (New Relic, DataDog, Dynatrace, etc.)
 * to enable clients to use any instrumentation provider.
 */

/**
 * Pluggable instrumentation provider interface
 *
 * All instrumentation providers must implement this interface.
 * Provides methods for tracking errors, events, and metrics.
 *
 * @example
 * ```typescript
 * class CustomProvider implements InstrumentationProvider {
 *   readonly providerId = 'custom';
 *   readonly providerName = 'Custom Analytics';
 *
 *   async initialize(config?: InstrumentationConfig): Promise<void> {
 *     // Initialize your analytics SDK
 *   }
 *
 *   trackError(error: Error, attributes: ErrorAttributes): void {
 *     // Send error to your analytics backend
 *   }
 *
 *   trackEvent(eventName: string, attributes: EventAttributes): void {
 *     // Send event to your analytics backend
 *   }
 *
 *   isReady(): boolean {
 *     return true;
 *   }
 *
 *   destroy(): void {
 *     // Cleanup
 *   }
 * }
 * ```
 */
export interface InstrumentationProvider {
	/**
	 * Unique identifier for the provider (e.g., 'newrelic', 'datadog', 'console')
	 */
	readonly providerId: string;

	/**
	 * Human-readable provider name (e.g., 'New Relic', 'DataDog RUM')
	 */
	readonly providerName: string;

	/**
	 * Initialize the provider (load SDKs, configure clients, etc.)
	 *
	 * @param config Optional configuration for the provider
	 */
	initialize(config?: InstrumentationConfig): Promise<void>;

	/**
	 * Track an error with contextual attributes
	 *
	 * @param error The error to track
	 * @param attributes Contextual attributes about the error
	 */
	trackError(error: Error, attributes: ErrorAttributes): void;

	/**
	 * Track a custom event/page action
	 *
	 * @param eventName Name of the event (e.g., 'pie-resource-load', 'pie-resource-retry')
	 * @param attributes Contextual attributes about the event
	 */
	trackEvent(eventName: string, attributes: EventAttributes): void;

	/**
	 * Track a performance metric
	 *
	 * Optional - not all providers support direct metrics.
	 * For providers without metric support, consider tracking as custom events instead.
	 *
	 * @param metricName Name of the metric
	 * @param value Numeric value of the metric
	 * @param attributes Optional attributes about the metric
	 */
	trackMetric?(
		metricName: string,
		value: number,
		attributes?: MetricAttributes,
	): void;

	/**
	 * Set user context for session tracking
	 *
	 * Optional - associates user information with subsequent events/errors.
	 *
	 * @param userId User identifier
	 * @param attributes Optional user attributes
	 */
	setUserContext?(userId: string, attributes?: Record<string, any>): void;

	/**
	 * Set custom attributes that apply to all subsequent events
	 *
	 * Optional - useful for setting context like environment, version, etc.
	 *
	 * @param attributes Attributes to set globally
	 */
	setGlobalAttributes?(attributes: Record<string, any>): void;

	/**
	 * Cleanup provider resources
	 *
	 * Called when the provider is being destroyed or replaced.
	 */
	destroy(): void;

	/**
	 * Check if provider is ready to track events
	 *
	 * @returns true if provider is initialized and ready, false otherwise
	 */
	isReady(): boolean;
}

/**
 * Configuration for instrumentation providers
 */
export interface InstrumentationConfig {
	/**
	 * Enable/disable instrumentation
	 *
	 * @default true
	 */
	enabled?: boolean;

	/**
	 * Enable debug logging
	 *
	 * @default false
	 */
	debug?: boolean;

	/**
	 * Sample rate for events (0.0 to 1.0)
	 *
	 * 1.0 = 100% of events tracked
	 * 0.5 = 50% of events tracked
	 * 0.1 = 10% of events tracked
	 *
	 * @default 1.0
	 */
	sampleRate?: number;

	/**
	 * Provider-specific settings
	 *
	 * Each provider can define its own configuration structure.
	 *
	 * @example New Relic
	 * ```typescript
	 * providerSettings: {
	 *   // New Relic doesn't need additional config (uses global newrelic object)
	 * }
	 * ```
	 *
	 * @example DataDog
	 * ```typescript
	 * providerSettings: {
	 *   applicationId: 'abc123',
	 *   clientToken: 'pub_xyz',
	 *   site: 'datadoghq.com',
	 *   service: 'pie-players'
	 * }
	 * ```
	 */
	providerSettings?: Record<string, any>;

	/**
	 * Filter function for errors
	 *
	 * Return false to skip tracking the error.
	 *
	 * @param error The error being tracked
	 * @param attributes The error attributes
	 * @returns true to track, false to skip
	 */
	errorFilter?: (error: Error, attributes: ErrorAttributes) => boolean;

	/**
	 * Filter function for events
	 *
	 * Return false to skip tracking the event.
	 *
	 * @param eventName The event name
	 * @param attributes The event attributes
	 * @returns true to track, false to skip
	 */
	eventFilter?: (eventName: string, attributes: EventAttributes) => boolean;

	/**
	 * Transform function for attributes
	 *
	 * Allows modifying or enriching attributes before they're sent to the provider.
	 *
	 * @param attributes The original attributes
	 * @returns The transformed attributes
	 */
	attributeTransformer?: (
		attributes: Record<string, any>,
	) => Record<string, any>;
}

/**
 * Common error attributes
 *
 * These attributes are sent with error tracking calls.
 * All providers should support these base attributes.
 */
export interface ErrorAttributes {
	/**
	 * Component that generated the error
	 *
	 * Examples: 'pie-fixed-player', 'pie-resource-monitor', 'pie-esm-player'
	 */
	component: string;

	/**
	 * Type/category of error
	 *
	 * Examples: 'InvalidConfig', 'ConfigParseError', 'EsmLoadingError',
	 * 'IifeLoadingError', 'ResourceLoadError'
	 */
	errorType: string;

	// Contextual data (all optional, depends on error type)

	/**
	 * Single item ID (if error relates to a specific item)
	 */
	itemId?: string;

	/**
	 * Multiple item IDs (if error relates to multiple items)
	 */
	itemIds?: string[];

	/**
	 * PIE element type (if error relates to a specific element)
	 *
	 * Examples: '@pie-element/inline-choice', '@pie-element/match'
	 */
	elementType?: string;

	/**
	 * CDN base URL (for ESM loading errors)
	 */
	cdnBaseUrl?: string;

	/**
	 * Bundle host URL (for IIFE loading errors)
	 */
	bundleHost?: string;

	/**
	 * Resource URL (for resource loading errors)
	 */
	resourceUrl?: string;

	/**
	 * Resource type (for resource loading errors)
	 *
	 * Examples: 'img', 'audio', 'video', 'link', 'source'
	 */
	resourceType?: string;

	/**
	 * Duration in milliseconds (for timing-related errors)
	 */
	duration?: number;

	/**
	 * Retry count (for retry-related errors)
	 */
	retryCount?: number;

	/**
	 * Whether retry was attempted (for resource errors)
	 */
	wasRetried?: boolean;

	/**
	 * Extensible for additional context-specific attributes
	 */
	[key: string]: any;
}

/**
 * Common event attributes
 *
 * These attributes are sent with event tracking calls.
 */
export interface EventAttributes {
	/**
	 * Component that generated the event
	 *
	 * Optional - some events may be component-agnostic
	 */
	component?: string;

	/**
	 * Timestamp of the event
	 *
	 * ISO 8601 format string
	 */
	timestamp?: string;

	// Resource loading events

	/**
	 * Resource URL
	 */
	url?: string;

	/**
	 * Load duration in milliseconds
	 */
	duration?: number;

	/**
	 * Transfer size in bytes
	 */
	size?: number;

	/**
	 * Resource type
	 *
	 * Examples: 'img', 'audio', 'video', 'link', 'script', 'stylesheet'
	 */
	type?: string;

	/**
	 * Resource type (alternative name for compatibility)
	 */
	resourceType?: string;

	/**
	 * Whether the resource load failed
	 */
	failed?: boolean;

	/**
	 * Whether retry was attempted
	 */
	wasRetried?: boolean;

	/**
	 * Retry count
	 */
	retryCount?: number;

	/**
	 * Retry attempt number
	 */
	attempt?: number;

	/**
	 * Delay before retry in milliseconds
	 */
	delay?: number;

	/**
	 * Extensible for additional event-specific attributes
	 */
	[key: string]: any;
}

/**
 * Metric attributes
 *
 * These attributes are sent with metric tracking calls.
 */
export interface MetricAttributes {
	/**
	 * Unit of measurement
	 *
	 * Examples: 'ms', 'bytes', 'count', 'percent'
	 */
	unit?: string;

	/**
	 * Category of metric
	 *
	 * Examples: 'performance', 'resource', 'error', 'user-action'
	 */
	category?: string;

	/**
	 * Extensible for additional metric-specific attributes
	 */
	[key: string]: any;
}
