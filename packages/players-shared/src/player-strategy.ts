import type { Env } from "./types/index.js";

export type ItemPlayerStrategy = "iife" | "esm" | "preloaded";
export type ItemPlayerView = "delivery" | "author" | "print";

export function normalizeItemPlayerStrategy(
	value: string | null | undefined,
	fallback: ItemPlayerStrategy = "iife",
): ItemPlayerStrategy {
	if (value === "iife" || value === "esm" || value === "preloaded") {
		return value;
	}
	return fallback;
}

export function resolveItemPlayerView(
	mode: Env["mode"] | undefined,
	defaultView: ItemPlayerView = "delivery",
): ItemPlayerView {
	if (mode === "author") {
		return "author";
	}
	return defaultView;
}
