import { initializeMathRendering } from "@pie-players/pie-players-shared/pie";

let itemPlayerMathReadyPromise: Promise<void> | null = null;

/**
 * Installs the math renderer that IIFE element bundles read on window, unless
 * the page already holds one. The players call it only before loading IIFE
 * bundles, so a page of ESM elements, preloaded or loaded by the player, never
 * fetches it. A host that loads IIFE element bundles itself must call it first,
 * because those bundles read the renderer as they evaluate.
 */
export function ensureItemPlayerMathRenderingReady(): Promise<void> {
	if (typeof window === "undefined") {
		return Promise.resolve();
	}
	if (!itemPlayerMathReadyPromise) {
		itemPlayerMathReadyPromise = initializeMathRendering().catch((error) => {
			// Cleared so the next call retries instead of replaying the failure.
			itemPlayerMathReadyPromise = null;
			throw error;
		});
	}
	return itemPlayerMathReadyPromise;
}
