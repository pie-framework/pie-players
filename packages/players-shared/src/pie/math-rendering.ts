/**
 * Math rendering bootstrap for PIE players
 *
 * PIE elements expect @pie-lib/math-rendering to be available on window.
 * This module ensures required globals are populated from the upstream
 * @pie-lib/math-rendering-module package, and also supports overriding with
 * a custom renderer object when needed.
 */

/// <reference path="../shims.d.ts" />

export type MathRenderer = (element: HTMLElement) => void | Promise<void>;
export interface MathRenderingAPI {
	renderMath: MathRenderer;
	wrapMath?: (latex: string) => string;
	unWrapMath?: (wrapped: string) => string;
	mmlToLatex?: (mathml: string) => string;
}

const GLOBAL_KEY = "@pie-lib/math-rendering";
const GLOBAL_DLL_KEY = "_dll_pie_lib__math_rendering";
let initPromise: Promise<void> | null = null;

const getWindowRenderer = (): MathRenderingAPI | null => {
	if (typeof window === "undefined") {
		return null;
	}
	const renderer = (window as any)[GLOBAL_KEY] as MathRenderingAPI | undefined;
	return renderer || null;
};

const setWindowRenderer = (renderer: MathRenderingAPI): void => {
	if (typeof window === "undefined") return;
	(window as any)[GLOBAL_KEY] = renderer;
	(window as any)[GLOBAL_DLL_KEY] = renderer;
};

/**
 * Initialize math rendering with optional custom renderer
 *
 * If no custom renderer is provided, defaults to MathJax.
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
 * // Default MathJax
 * await initializeMathRendering();
 *
 * // Custom renderer instance implementing MathRenderingAPI
 * const customRenderer = await createCustomRenderer();
 * await initializeMathRendering(customRenderer);
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

	// Explicit override always wins.
	if (customRenderer) {
		setWindowRenderer(customRenderer);
		return;
	}

	// Already initialized - skip.
	if (getWindowRenderer()) {
		return;
	}
	if (initPromise) {
		await initPromise;
		return;
	}

	initPromise = (async () => {
		try {
			const { _dll_pie_lib__math_rendering } = await import(
				"@pie-lib/math-rendering-module/module"
			);
			setWindowRenderer(_dll_pie_lib__math_rendering as MathRenderingAPI);

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
	})();
	try {
		await initPromise;
	} finally {
		initPromise = null;
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
 * import { setMathRenderer } from '@pie-players/pie-players-shared/pie';
 *
 * const renderer = await createCustomRenderer();
 * setMathRenderer(renderer);
 *
 * // Now load PIE elements - they'll use your custom renderer
 * await loader.load(config, document, needsControllers);
 * ```
 */
export function setMathRenderer(renderer: MathRenderingAPI): void {
	setWindowRenderer(renderer);
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
	const renderer = getWindowRenderer();
	if (renderer && typeof renderer.renderMath === "function") {
		renderer.renderMath(element);
	}
}
