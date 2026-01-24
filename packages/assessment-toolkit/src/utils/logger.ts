export type Logger = (...args: unknown[]) => void;

/**
 * Minimal logger helper (replacement for PIEOneer’s internal debug logger).
 * We intentionally keep this lightweight and browser-safe.
 */
export function createLogger(namespace: string): Logger {
	return (...args) => {
		// eslint-disable-next-line no-console
		console.debug(`[${namespace}]`, ...args);
	};
}
