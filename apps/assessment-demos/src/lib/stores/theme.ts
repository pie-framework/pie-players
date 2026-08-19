import { DAISYUI_THEME_CATALOG } from "@pie-players/pie-theme";
import { writable } from "svelte/store";

// Keep this storage key in sync with the pre-paint inline script in app.html.
export const THEME_STORAGE_KEY = "pie:assessment-demos:theme";
export const DEFAULT_THEME = "light";

// The <pie-theme> wrapper maps any of these ids onto the --pie-* token
// contract that PIE content reads.
export const DAISY_THEMES = DAISYUI_THEME_CATALOG;

export type DaisyTheme = (typeof DAISY_THEMES)[number];

// The selected theme drives the <pie-theme scope="document"> host, which owns
// the `data-theme` attribute on <html> plus the --pie-* variables.
export const selectedTheme = writable<string>(DEFAULT_THEME);

function normalizeTheme(theme: string | null | undefined): string {
	return (theme || DEFAULT_THEME).trim() || DEFAULT_THEME;
}

/** Restore the persisted theme into the store (call once on mount). */
export function initTheme(): void {
	if (typeof window === "undefined") return;
	selectedTheme.set(
		normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY)),
	);
}

/** Select a theme: update the store and persist it. */
export function setTheme(theme: string): void {
	const next = normalizeTheme(theme);
	selectedTheme.set(next);
	if (typeof window !== "undefined") {
		window.localStorage.setItem(THEME_STORAGE_KEY, next);
	}
}
