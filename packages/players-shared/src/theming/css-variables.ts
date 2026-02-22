import { getThemeTokens } from "./presets.js";
import type { PieThemeMode, PieTokenMap } from "./types.js";

export function normalizeTokenMap(input: Record<string, string>): PieTokenMap {
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(input)) {
		if (!key.startsWith("--")) {
			continue;
		}
		out[key] = value;
	}
	return out as PieTokenMap;
}

export function resolveThemeMode(theme: PieThemeMode): "light" | "dark" {
	if (theme !== "auto" || typeof window === "undefined") {
		return theme === "dark" ? "dark" : "light";
	}
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

export function getBaseTokens(theme: PieThemeMode): PieTokenMap {
	return getThemeTokens(resolveThemeMode(theme));
}

export function mergeTokens(
	base: PieTokenMap,
	overrides?: Record<string, string> | null,
): PieTokenMap {
	if (!overrides) {
		return { ...base };
	}
	return {
		...base,
		...normalizeTokenMap(overrides),
	};
}

export function applyTokens(
	target: HTMLElement,
	tokens: PieTokenMap,
	previousKeys?: Set<string>,
): Set<string> {
	if (previousKeys) {
		for (const key of previousKeys) {
			target.style.removeProperty(key);
		}
	}

	for (const [key, value] of Object.entries(tokens)) {
		target.style.setProperty(key, value);
	}
	return new Set(Object.keys(tokens));
}

