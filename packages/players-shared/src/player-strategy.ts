import { BundleType } from "./pie/types.js";
import type { ConfigEntity, Env } from "./types/index.js";

export type ItemPlayerStrategy = "iife" | "esm" | "preloaded";
export type ItemPlayerView = "delivery" | "author" | "print";

export interface ItemPlayerPrepareInput {
	config: ConfigEntity;
	env: Env;
	skipElementLoading: boolean;
	loaderOptions?: Record<string, unknown>;
}

export interface ItemPlayerPrepareResult {
	config: ConfigEntity;
	mode: "view" | "author";
	bundleType: BundleType;
}

export interface ItemPlayerAdapter {
	strategy: ItemPlayerStrategy;
	prepare(input: ItemPlayerPrepareInput): Promise<ItemPlayerPrepareResult>;
}

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
