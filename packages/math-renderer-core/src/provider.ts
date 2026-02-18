/**
 * Global math rendering provider
 *
 * Manages the active renderer and window globals for PIE element compatibility
 */

import type { MathRenderingAPI } from "./types.js";

/**
 * Math renderer provider class
 *
 * Manages the active renderer and automatically updates window globals
 * that PIE elements depend on.
 */
class MathRendererProvider {
	private currentRenderer: MathRenderingAPI | null = null;

	/**
	 * Set the active math renderer
	 *
	 * This will update the window globals that PIE elements expect:
	 * - window["@pie-lib/math-rendering"]
	 * - window["_dll_pie_lib__math_rendering"]
	 *
	 * @param renderer - The renderer to use
	 *
	 * @example
	 * ```typescript
	 * import { createKatexRenderer } from '@pie-players/math-renderer-katex';
	 * import { mathRendererProvider } from '@pie-players/math-renderer-core';
	 *
	 * const renderer = await createKatexRenderer();
	 * mathRendererProvider.setRenderer(renderer);
	 * ```
	 */
	setRenderer(renderer: MathRenderingAPI): void {
		this.currentRenderer = renderer;
		this.updateWindowGlobals();
	}

	/**
	 * Get the current renderer
	 *
	 * @returns The active renderer, or null if none set
	 */
	getRenderer(): MathRenderingAPI | null {
		return this.currentRenderer;
	}

	/**
	 * Check if a renderer has been initialized
	 *
	 * @returns true if a renderer is set
	 */
	isInitialized(): boolean {
		return this.currentRenderer !== null;
	}

	/**
	 * Update window globals for PIE element compatibility
	 *
	 * PIE elements expect to find math rendering on these two globals:
	 * - window["@pie-lib/math-rendering"] - Standard key
	 * - window["_dll_pie_lib__math_rendering"] - SystemJS/DLL key for IIFE bundles
	 *
	 * @private
	 */
	private updateWindowGlobals(): void {
		// Only run in browser
		if (typeof window === "undefined") {
			return;
		}

		const KEY = "@pie-lib/math-rendering";
		const DLL_KEY = "_dll_pie_lib__math_rendering";

		if (this.currentRenderer) {
			(window as any)[KEY] = this.currentRenderer;
			(window as any)[DLL_KEY] = this.currentRenderer;
		}
	}
}

/**
 * Global singleton instance
 *
 * Use this to set and get the active math renderer.
 *
 * @example
 * ```typescript
 * import { mathRendererProvider } from '@pie-players/math-renderer-core';
 * import { createMathjaxRenderer } from '@pie-players/math-renderer-mathjax';
 *
 * const renderer = await createMathjaxRenderer();
 * mathRendererProvider.setRenderer(renderer);
 *
 * // Later...
 * const current = mathRendererProvider.getRenderer();
 * if (current) {
 *   current.renderMath(document.body);
 * }
 * ```
 */
export const mathRendererProvider = new MathRendererProvider();
