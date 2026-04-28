/**
 * Deprecation warning helpers.
 *
 * Used by alias-supporting public surfaces (props, hooks, DOM events) to
 * nudge hosts toward the canonical form during the deprecation window.
 *
 * Design contract:
 *
 * - **Once per label, ever.** A label that has already warned in this
 *   process does not warn again, even from a different call site. This
 *   keeps console output tractable when an alias is invoked in a hot
 *   path (re-render, event-replay, hook re-fire).
 * - **Production-silent.** Warnings only fire when `process.env.NODE_ENV !== "production"`.
 *   `process.env.NODE_ENV` is read defensively because the toolkit code
 *   runs in a browser bundle where `process` may not exist; missing
 *   `process` is treated as "non-production" so dev warnings still
 *   surface in environments that ship an unbundled dev build.
 * - **Module-scope dedupe.** The Set is module-scope and outlives any
 *   single component instance / coordinator instance. This is
 *   intentional: a host that mounts and unmounts the same CE many times
 *   should not see the warning each remount.
 */

const seenLabels = new Set<string>();

function isProduction(): boolean {
	if (typeof process === "undefined") return false;
	if (!process || typeof process !== "object") return false;
	const env = (process as { env?: { NODE_ENV?: string } }).env;
	if (!env || typeof env !== "object") return false;
	return env.NODE_ENV === "production";
}

/**
 * Emit a deprecation warning to the console at most once per `label`,
 * for the lifetime of this module.
 *
 * The `label` is the dedupe key. Use a stable, namespaced string such
 * as `"pie-assessment-toolkit:<feature>-prop"` rather than a full
 * sentence — it must be safe to compare with `===` across call sites
 * and stable across rebuilds.
 *
 * Returns whether a warning was actually emitted (useful for tests).
 */
export function warnDeprecatedOnce(label: string, message: string): boolean {
	if (seenLabels.has(label)) return false;
	seenLabels.add(label);
	if (isProduction()) return false;
	console.warn(`[pie-players:deprecated:${label}] ${message}`);
	return true;
}

/**
 * Test-only reset of the seen-label set. Allows unit tests to assert
 * warn-once behavior without leaking state across cases. Not part of
 * the public contract.
 *
 * @internal
 */
export function __resetDeprecationWarnings(): void {
	seenLabels.clear();
}
