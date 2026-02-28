export interface PieItemPlayerElement extends HTMLElement {
	config: unknown;
	session: unknown;
	env: unknown;
	strategy: "iife" | "esm" | "preloaded";
	loaderOptions?: Record<string, unknown>;
}

export declare function definePieItemPlayer(tagName?: string): void;
