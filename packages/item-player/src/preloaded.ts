/**
 * Registration for `strategy="preloaded"`, importable without the player:
 * this entry defines no element and installs no stylesheet.
 */
export {
	registerPreloadedElements,
	type PreloadedController,
	type PreloadedElement,
} from "@pie-players/pie-players-shared/loaders";
export { ensureItemPlayerMathRenderingReady } from "./math-rendering-ready.js";
