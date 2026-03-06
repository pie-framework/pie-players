import PieItemPlayer from "./PieItemPlayer.svelte";
import {
	initializeMathRendering,
	validateCustomElementTag,
} from "@pie-players/pie-players-shared";

export type { PieItemPlayerElement } from "./types.js";

let itemPlayerMathReadyPromise: Promise<void> | null = null;

export function ensureItemPlayerMathRenderingReady(): Promise<void> {
	if (typeof window === "undefined") {
		return Promise.resolve();
	}
	if (!itemPlayerMathReadyPromise) {
		itemPlayerMathReadyPromise = initializeMathRendering();
	}
	return itemPlayerMathReadyPromise;
}

void ensureItemPlayerMathRenderingReady().catch((error) => {
	console.error("[pie-item-player] Failed to initialize math rendering:", error);
	itemPlayerMathReadyPromise = null;
});

export function definePieItemPlayer(tagName = "pie-item-player") {
	const validTagName = validateCustomElementTag(
		tagName,
		"pie-item-player tagName",
	);
	if (!customElements.get(validTagName)) {
		customElements.define(
			validTagName,
			PieItemPlayer as unknown as CustomElementConstructor,
		);
	}
}

definePieItemPlayer();
