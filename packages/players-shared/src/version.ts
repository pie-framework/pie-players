/**
 * Exposes the loaded player version on `window.PIE_PLAYERS` so client apps
 * and support tooling can read it from devtools without inspecting source
 * maps or network responses. Matches the existing `window.PIE_REGISTRY` /
 * `window.PIE_DEBUG` naming convention.
 *
 * `@pie-players/*` packages ship under fixed (lockstep) versioning, so any
 * player that has been loaded reports the same version string for the suite.
 */

export type PiePlayersGlobal = {
	version: string;
};

declare global {
	interface Window {
		PIE_PLAYERS?: PiePlayersGlobal;
	}
}

export function setPiePlayersGlobalVersion(version: string): void {
	if (typeof window === "undefined") {
		return;
	}
	const existing = window.PIE_PLAYERS;
	if (existing) {
		existing.version = version;
		return;
	}
	window.PIE_PLAYERS = { version };
}
