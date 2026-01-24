/**
 * Minimal, frontend-safe defaults for PIE build service URLs.
 *
 * In PIEOneer, these come from `$env/dynamic/public`. In `pie-players` we avoid
 * SvelteKit env dependencies so this can be consumed by any bundler.
 */

// Default public bundle host. Keep this aligned with the IIFE loader default.
// (We prefer the proxy endpoint, which is stable/cached for browser usage.)
const DEFAULT_BUILDER_ORIGIN_URL = "https://proxy.pie-api.com";
const DEFAULT_BUILDER_BUNDLE_URL = `${DEFAULT_BUILDER_ORIGIN_URL}/bundles/`;

declare global {
	interface Window {
		PIE_BUILDER_ORIGIN_URL?: string;
		PIE_BUILDER_BUNDLE_URL?: string;
	}
}

function readPublicEnv(key: string): string | undefined {
	try {
		// Vite/SvelteKit-like
		const v = (import.meta as any)?.env?.[key];
		if (typeof v === "string" && v.length > 0) return v;
	} catch {}
	return undefined;
}

export const BUILDER_ORIGIN_URL =
	(typeof window !== "undefined" && window.PIE_BUILDER_ORIGIN_URL) ||
	readPublicEnv("PUBLIC_BUILDER_ORIGIN_URL") ||
	DEFAULT_BUILDER_ORIGIN_URL;

export const BUILDER_BUNDLE_URL =
	(typeof window !== "undefined" && window.PIE_BUILDER_BUNDLE_URL) ||
	readPublicEnv("PUBLIC_BUILDER_BUNDLE_URL") ||
	DEFAULT_BUILDER_BUNDLE_URL;
