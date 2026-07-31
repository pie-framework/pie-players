import PieItemPlayer from "./PieItemPlayer.svelte";
import {
	defineCustomElementSafely,
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

export function definePieItemPlayer(tagName = "pie-item-player") {
	defineCustomElementSafely(
		tagName,
		PieItemPlayer as unknown as CustomElementConstructor,
		"pie-item-player tagName",
	);
}

definePieItemPlayer();
