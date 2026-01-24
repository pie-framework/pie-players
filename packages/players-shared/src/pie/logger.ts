/**
 * PIE Logger Utility
 *
 * Simple, efficient logging for PIE players with debug mode support.
 * Uses browser console methods (debug, info, warn, error) which can be
 * filtered natively in browser dev tools.
 *
 * Usage:
 * ```typescript
 * const logger = createPieLogger('pie-fixed-player', debug);
 * logger.debug('Detailed debug info', data);  // Only shown if debug=true
 * logger.info('Important production info');   // Always shown
 * logger.warn('Warning message');             // Always shown
 * logger.error('Error occurred', error);      // Always shown
 * ```
 */

export interface PieLogger {
	/**
	 * Debug-level logging - only shown when debug mode is enabled
	 * Use for: detailed initialization steps, data transformations, internal state
	 */
	debug: (message: string, ...args: any[]) => void;

	/**
	 * Info-level logging - always shown
	 * Use for: successful operations, lifecycle events, important milestones
	 */
	info: (message: string, ...args: any[]) => void;

	/**
	 * Warning-level logging - always shown
	 * Use for: recoverable errors, deprecated features, potential issues
	 */
	warn: (message: string, ...args: any[]) => void;

	/**
	 * Error-level logging - always shown
	 * Use for: errors, exceptions, failures
	 */
	error: (message: string, ...args: any[]) => void;
}

/**
 * Create a PIE logger instance
 *
 * @param namespace - Component name for log prefixing (e.g., 'pie-fixed-player')
 * @param debugEnabledFn - Function that returns whether debug logs should be shown (checked dynamically on each call)
 * @returns Logger instance with debug, info, warn, error methods
 */
export function createPieLogger(
	namespace: string,
	debugEnabledFn: () => boolean,
): PieLogger {
	const prefix = `[${namespace}]`;

	return {
		// Only debug method checks debugEnabledFn - it's checked dynamically on every call
		debug: (message: string, ...args: any[]) => {
			if (debugEnabledFn()) {
				console.debug(prefix, message, ...args);
			}
		},

		// info, warn, error always log (not gated by debug flag)
		info: (message: string, ...args: any[]) =>
			console.info(prefix, message, ...args),

		warn: (message: string, ...args: any[]) =>
			console.warn(prefix, message, ...args),

		error: (message: string, ...args: any[]) =>
			console.error(prefix, message, ...args),
	};
}

/**
 * Global debug flag - can be set via window for runtime debugging
 *
 * Usage in browser console:
 * ```javascript
 * window.PIE_DEBUG = true;  // Enable debug logging
 * ```
 */
declare global {
	interface Window {
		PIE_DEBUG?: boolean;
	}
}

/**
 * Check if debug mode is enabled globally
 */
export function isGlobalDebugEnabled(): boolean {
	return typeof window !== "undefined" && window.PIE_DEBUG === true;
}
