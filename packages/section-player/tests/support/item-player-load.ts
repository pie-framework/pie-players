/**
 * Stands in for `@pie-players/pie-item-player` with its own element-load path, from
 * source, and only the math renderer stubbed. Import before the module under test.
 */

import { mock } from "bun:test";

export const ensureItemPlayerMathRenderingReady = mock(async () => undefined);

mock.module("../../../item-player/src/math-rendering-ready.js", () => ({
	ensureItemPlayerMathRenderingReady,
}));
const elementPreload = await import(
	"../../../item-player/src/element-preload.js"
);
mock.module("@pie-players/pie-item-player", () => ({
	...elementPreload,
	ensureItemPlayerMathRenderingReady,
}));
