/**
 * Base Instrumentation Provider
 *
 * Abstract base class that implements common instrumentation logic for all providers.
 * Provides a template method pattern for tracking errors and events with consistent
 * filtering, transformation, and sampling behavior.
 *
 * Concrete providers only need to implement the actual tracking methods specific
 * to their instrumentation backend (New Relic, DataDog, etc.)
 */

import type {
	ErrorAttributes,
	EventAttributes,
	InstrumentationConfig,
	InstrumentationProvider,
	MetricAttributes,
} from "../types.js";

/**
 * Abstract base class for instrumentation providers
 *
 * Implements the template method pattern:
 * 1. Checks if provider is ready
 * 2. Applies filters (errorFilter, eventFilter)
 * 3. Applies sampling (sampleRate)
 * 4. Transforms attributes (attributeTransformer)
 * 5. Delegates to concrete provider implementation (doTrackError, doTrackEvent, etc.)
 */
export abstract class BaseInstrumentationProvider
	implements InstrumentationProvider
{
	abstract readonly providerId: string;
	abstract readonly providerName: string;

	protected initialized = false;
	protected config?: InstrumentationConfig;

	/**
	 * Initialize the provider with configuration
	 *
	 * Concrete providers should override this method to perform provider-specific
	 * initialization (e.g., loading SDK, checking global objects, etc.)
	 *
	 * @param config Optional configuration
	 */
	abstract initialize(config?: InstrumentationConfig): Promise<void>;

	/**
	 * Check if provider is ready to track events
	 *
	 * Concrete providers should override this method to check provider-specific
	 * readiness (e.g., SDK loaded, global object available, etc.)
	 *
	 * @returns true if provider is ready
	 */
	abstract isReady(): boolean;

	/**
	 * Cleanup provider resources
	 *
	 * Concrete providers should override this method to perform provider-specific
	 * cleanup (e.g., disconnect SDK, clear listeners, etc.)
	 */
	abstract destroy(): void;

	// ============================================================================
	// Abstract methods that concrete providers MUST implement
	// ============================================================================

	/**
	 * Track an error with the instrumentation backend
	 *
	 * Called by trackError() after all filters and transforms have been applied.
	 * Concrete providers should implement the actual error tracking here.
	 *
	 * @param error The error to track
	 * @param attributes Transformed and filtered attributes
	 */
	protected abstract doTrackError(
		error: Error,
		attributes: Record<string, any>,
	): void;

	/**
	 * Track an event with the instrumentation backend
	 *
	 * Called by trackEvent() after all filters and transforms have been applied.
	 * Concrete providers should implement the actual event tracking here.
	 *
	 * @param eventName Name of the event
	 * @param attributes Transformed and filtered attributes
	 */
	protected abstract doTrackEvent(
		eventName: string,
		attributes: Record<string, any>,
	): void;

	/**
	 * Set user context in the instrumentation backend
	 *
	 * Called by setUserContext() after readiness check.
	 * Concrete providers should implement the actual user context setting here.
	 *
	 * @param userId User identifier
	 * @param attributes Optional user attributes
	 */
	protected abstract doSetUserContext(
		userId: string,
		attributes?: Record<string, any>,
	): void;

	/**
	 * Set global attributes in the instrumentation backend
	 *
	 * Called by setGlobalAttributes() after readiness check.
	 * Concrete providers should implement the actual global attribute setting here.
	 *
	 * @param attributes Attributes to set globally
	 */
	protected abstract doSetGlobalAttributes(
		attributes: Record<string, any>,
	): void;

	// ============================================================================
	// Public API methods (template methods)
	// ============================================================================

	/**
	 * Track an error with the instrumentation provider
	 *
	 * Template method that:
	 * 1. Checks if provider is ready
	 * 2. Applies error filter if configured
	 * 3. Transforms attributes if configured
	 * 4. Delegates to concrete provider implementation (doTrackError)
	 *
	 * @param error The error to track
	 * @param attributes Contextual attributes
	 */
	trackError(error: Error, attributes: ErrorAttributes): void {
		// Guard: check if provider is ready
		if (!this.guardedOperation("trackError", error, attributes)) {
			return;
		}

		// Apply error filter
		if (!this.applyErrorFilter(error, attributes)) {
			return;
		}

		// Transform attributes
		const finalAttributes = this.transformAttributes(attributes);

		// Delegate to concrete provider
		try {
			this.doTrackError(error, finalAttributes);

			if (this.config?.debug) {
				console.log(
					`[${this.providerName}] Tracked error:`,
					error,
					finalAttributes,
				);
			}
		} catch (err) {
			console.error(`[${this.providerName}] Error tracking error:`, err);
		}
	}

	/**
	 * Track a custom event with the instrumentation provider
	 *
	 * Template method that:
	 * 1. Checks if provider is ready
	 * 2. Applies event filter if configured
	 * 3. Applies sampling if configured
	 * 4. Transforms attributes if configured
	 * 5. Adds timestamp if not present
	 * 6. Delegates to concrete provider implementation (doTrackEvent)
	 *
	 * @param eventName Name of the event
	 * @param attributes Event attributes
	 */
	trackEvent(eventName: string, attributes: EventAttributes): void {
		// Guard: check if provider is ready
		if (!this.guardedOperation("trackEvent", eventName, attributes)) {
			return;
		}

		// Apply event filter
		if (!this.applyEventFilter(eventName, attributes)) {
			return;
		}

		// Apply sampling
		if (!this.applySampling(eventName)) {
			return;
		}

		// Transform attributes
		let finalAttributes = this.transformAttributes(attributes);

		// Add timestamp if not present
		if (!finalAttributes.timestamp) {
			finalAttributes = {
				...finalAttributes,
				timestamp: new Date().toISOString(),
			};
		}

		// Delegate to concrete provider
		try {
			this.doTrackEvent(eventName, finalAttributes);

			if (this.config?.debug) {
				console.log(
					`[${this.providerName}] Tracked event:`,
					eventName,
					finalAttributes,
				);
			}
		} catch (err) {
			console.error(`[${this.providerName}] Error tracking event:`, err);
		}
	}

	/**
	 * Track a performance metric
	 *
	 * Default implementation tracks metrics as events with a `metric:` prefix.
	 * Concrete providers can override this method if their backend has a
	 * dedicated metric API.
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
		// Default implementation: track as event
		this.trackEvent(`metric:${metricName}`, {
			...attributes,
			metricValue: value,
			metricName,
		});
	}

	/**
	 * Set user context for session tracking
	 *
	 * Template method that checks if provider is ready then delegates
	 * to concrete provider implementation.
	 *
	 * @param userId User identifier
	 * @param attributes Optional user attributes
	 */
	setUserContext(userId: string, attributes?: Record<string, any>): void {
		// Guard: check if provider is ready
		if (!this.guardedOperation("setUserContext", userId, attributes)) {
			return;
		}

		// Delegate to concrete provider
		try {
			this.doSetUserContext(userId, attributes);

			if (this.config?.debug) {
				console.log(
					`[${this.providerName}] Set user context:`,
					userId,
					attributes,
				);
			}
		} catch (err) {
			console.error(`[${this.providerName}] Error setting user context:`, err);
		}
	}

	/**
	 * Set global custom attributes
	 *
	 * Template method that checks if provider is ready then delegates
	 * to concrete provider implementation.
	 *
	 * @param attributes Attributes to set globally
	 */
	setGlobalAttributes(attributes: Record<string, any>): void {
		// Guard: check if provider is ready
		if (!this.guardedOperation("setGlobalAttributes", attributes)) {
			return;
		}

		// Delegate to concrete provider
		try {
			this.doSetGlobalAttributes(attributes);

			if (this.config?.debug) {
				console.log(
					`[${this.providerName}] Set global attributes:`,
					attributes,
				);
			}
		} catch (err) {
			console.error(
				`[${this.providerName}] Error setting global attributes:`,
				err,
			);
		}
	}

	// ============================================================================
	// Protected utility methods (shared logic)
	// ============================================================================

	/**
	 * Guard operation - check if provider is ready
	 *
	 * Returns false if provider is not ready, logging a warning in debug mode.
	 *
	 * @param operation Name of the operation for logging
	 * @param args Arguments for logging
	 * @returns true if provider is ready, false otherwise
	 */
	protected guardedOperation(operation: string, ...args: any[]): boolean {
		if (!this.isReady()) {
			if (this.config?.debug) {
				console.warn(
					`[${this.providerName}] Attempted to ${operation} but provider not ready:`,
					...args,
				);
			}
			return false;
		}
		return true;
	}

	/**
	 * Apply error filter if configured
	 *
	 * Returns false if error should be filtered out, logging in debug mode.
	 *
	 * @param error The error
	 * @param attributes Error attributes
	 * @returns true if error should be tracked, false if filtered out
	 */
	protected applyErrorFilter(
		error: Error,
		attributes: ErrorAttributes,
	): boolean {
		if (
			this.config?.errorFilter &&
			!this.config.errorFilter(error, attributes)
		) {
			if (this.config?.debug) {
				console.log(
					`[${this.providerName}] Error filtered out:`,
					error,
					attributes,
				);
			}
			return false;
		}
		return true;
	}

	/**
	 * Apply event filter if configured
	 *
	 * Returns false if event should be filtered out, logging in debug mode.
	 *
	 * @param eventName Event name
	 * @param attributes Event attributes
	 * @returns true if event should be tracked, false if filtered out
	 */
	protected applyEventFilter(
		eventName: string,
		attributes: EventAttributes,
	): boolean {
		if (
			this.config?.eventFilter &&
			!this.config.eventFilter(eventName, attributes)
		) {
			if (this.config?.debug) {
				console.log(
					`[${this.providerName}] Event filtered out:`,
					eventName,
					attributes,
				);
			}
			return false;
		}
		return true;
	}

	/**
	 * Apply sampling if configured
	 *
	 * Returns false if event should be sampled out, logging in debug mode.
	 *
	 * @param eventName Event name for logging
	 * @returns true if event should be tracked, false if sampled out
	 */
	protected applySampling(eventName: string): boolean {
		if (this.config?.sampleRate !== undefined && this.config.sampleRate < 1.0) {
			if (Math.random() > this.config.sampleRate) {
				if (this.config?.debug) {
					console.log(`[${this.providerName}] Event sampled out:`, eventName);
				}
				return false;
			}
		}
		return true;
	}

	/**
	 * Transform attributes if transformer is configured
	 *
	 * @param attributes Original attributes
	 * @returns Transformed attributes or original if no transformer
	 */
	protected transformAttributes(
		attributes: Record<string, any>,
	): Record<string, any> {
		if (this.config?.attributeTransformer) {
			return this.config.attributeTransformer(attributes);
		}
		return attributes as Record<string, any>;
	}
}
