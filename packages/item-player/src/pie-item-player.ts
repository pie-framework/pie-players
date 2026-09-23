import PieItemPlayer from "./PieItemPlayer.svelte";
import {
	attemptCustomElementDefine,
	initializeMathRendering,
	installContentStyles,
	auditContentStyles,
} from "@pie-players/pie-players-shared";
// Inlined as text at build time, so the stylesheet travels with the bundle and
// hosts do not have to import it. See installContentStyles for why the player
// owns this.
//
// `?raw`, not `?inline`: both yield a string, but `?inline` also routes the file
// through Vite's CSS pipeline, which emits an unreferenced sibling .css asset in
// library mode — dead weight in the package that a host could mistake for
// something it needs to link. `?raw` reads the authored stylesheet verbatim.
import contentStyles from "@pie-players/pie-theme/components.css?raw";

export type * from "./types.js";

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
	console.error(
		"[pie-item-player] Failed to initialize math rendering:",
		error,
	);
	itemPlayerMathReadyPromise = null;
});

// Installed at import time, alongside element registration, so the stylesheet is
// in the document before any instance renders — no unstyled first paint. A host
// that sets <html data-pie-content-styles="host"> owns the stylesheet instead,
// and gets warned if it then ships nothing.
installContentStyles(contentStyles, "pie-item-player");
auditContentStyles("pie-item-player");

// Named so `scripts/check-custom-elements.mjs` can read the tag from here.
const PIE_ITEM_PLAYER_TAG = "pie-item-player";

/**
 * Registers the item player, under `pie-item-player` unless a host names
 * another tag.
 *
 * This is the only registration path: `PieItemPlayer.svelte` declares no
 * `customElement` tag, so the compiled component only exposes its
 * custom-element class on `.element` and nothing reaches the registry until
 * this runs. An already-registered tag is left alone, which is what lets a
 * second copy of this package load into a document holding the first — a
 * generated `@pie-players/pie-preloaded-player` build carries one — and leaves
 * whichever copy registered first rendering every item.
 *
 * A custom tag falls back to a subclass once this copy's class holds the
 * default one, because the browser refuses one constructor a second tag.
 */
export function definePieItemPlayer(tagName = PIE_ITEM_PLAYER_TAG): void {
	const attempt = attemptCustomElementDefine(
		tagName,
		(PieItemPlayer as unknown as { element: CustomElementConstructor }).element,
		"pie-item-player tagName",
		{ allowWrappedFallback: true },
	);
	if (attempt.outcome === "error" || attempt.outcome === "wrapped-error") {
		throw attempt.error;
	}
}

definePieItemPlayer();
