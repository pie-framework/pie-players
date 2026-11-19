/**
 * Minimal, frontend-safe defaults for bundle host URLs.
 *
 * A SvelteKit host reads these from `$env/dynamic/public`. `pie-players` avoids
 * SvelteKit env dependencies so this can be consumed by any bundler.
 */

import { DEFAULT_BUNDLE_HOST } from "../loaders/defaults.js";

declare global {
	interface Window {
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

export const BUILDER_BUNDLE_URL =
	(typeof window !== "undefined" && window.PIE_BUILDER_BUNDLE_URL) ||
	readPublicEnv("PUBLIC_BUILDER_BUNDLE_URL") ||
	DEFAULT_BUNDLE_HOST;
