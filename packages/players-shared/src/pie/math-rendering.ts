/**
 * Pluggable math rendering for PIE players
 *
 * PIE elements expect @pie-lib/math-rendering to be available on window.
 * This module provides a pluggable provider pattern that allows switching
 * between MathJax, KaTeX, or custom renderers.
 *
 * IMPORTANT: Uses dynamic import to avoid SSR issues - the module is browser-only.
 */

/// <reference path="../shims.d.ts" />

import {
	type MathRenderingAPI,
	mathRendererProvider,
} from "@pie-players/math-renderer-core";
import { createMathjaxRenderer } from "@pie-players/math-renderer-mathjax";

/**
 * Initialize math rendering with optional custom renderer
 *
 * If no custom renderer is provided, defaults to MathJax for backward compatibility.
 * For custom renderers, use setMathRenderer() before calling this function.
 *
 * Sets TWO window globals that PIE elements expect:
 * - window["@pie-lib/math-rendering"] (standard key)
 * - window["_dll_pie_lib__math_rendering"] (SystemJS/DLL key for IIFE bundles)
 *
 * @param customRenderer - Optional custom renderer to use instead of default MathJax
 *
 * @example
 * ```typescript
 * // Default MathJax (backward compatible)
 * await initializeMathRendering();
 *
 * // Custom renderer
 * import { createKatexRenderer } from '@pie-players/math-renderer-katex';
 * const katexRenderer = await createKatexRenderer();
 * await initializeMathRendering(katexRenderer);
 *
 * // Or use setMathRenderer first
 * setMathRenderer(katexRenderer);
 * await initializeMathRendering();
 * ```
 */
export async function initializeMathRendering(
	customRenderer?: MathRenderingAPI,
): Promise<void> {
	// Only run in browser
	if (typeof window === "undefined") {
		return;
	}

	// Already initialized - skip
	if (mathRendererProvider.isInitialized()) {
		return;
	}

	try {
		// Use custom renderer or default to MathJax for backward compatibility
		const renderer = customRenderer ?? (await createMathjaxRenderer());

		// Set in provider (automatically updates window globals)
		mathRendererProvider.setRenderer(renderer);

		console.log(
			"[MathRendering] ✅ Math rendering module initialized (both globals set)",
		);
	} catch (error) {
		console.error(
			"[MathRendering] ❌ Failed to initialize math rendering:",
			error,
		);
		throw error;
	}
}

/**
 * Set custom math renderer programmatically
 *
 * Call this BEFORE initializeMathRendering() or any loader.load() calls
 * to override the default MathJax renderer.
 *
 * @param renderer - The renderer to use
 *
 * @example
 * ```typescript
 * import { createKatexRenderer } from '@pie-players/math-renderer-katex';
 * import { setMathRenderer } from '@pie-players/pie-players-shared/pie';
 *
 * const katexRenderer = await createKatexRenderer({ throwOnError: false });
 * setMathRenderer(katexRenderer);
 *
 * // Now load PIE elements - they'll use KaTeX
 * await loader.load(config, document, needsControllers);
 * ```
 */
export function setMathRenderer(renderer: MathRenderingAPI): void {
	mathRendererProvider.setRenderer(renderer);
}

/**
 * Render math in the given element
 *
 * Convenience wrapper that calls the active renderer's renderMath() function.
 * Typically called after PIE elements are rendered.
 *
 * @param element - The element to render math within
 */
export function renderMath(element: HTMLElement): void {
	const renderer = mathRendererProvider.getRenderer();

	if (renderer && typeof renderer.renderMath === "function") {
		renderer.renderMath(element);
	}
}
