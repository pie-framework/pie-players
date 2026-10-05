/**
 * Math rendering bootstrap for PIE players
 *
 * PIE elements expect @pie-lib/math-rendering to be available on window.
 * This module ensures required globals are populated from the upstream
 * @pie-lib/math-rendering-module package, and also supports overriding with
 * a custom renderer object through setMathRenderer().
 */

/// <reference path="../shims.d.ts" />
import { createPieLogger, isGlobalDebugEnabled } from "./logger.js";

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
const logger = createPieLogger("math-rendering", () => isGlobalDebugEnabled());

/**
 * The page's renderer: the one `initializeMathRendering` installed, or a
 * host's. IIFE elements render with it, and so do ESM elements when the page
 * has one.
 */
export const getMathRenderer = (): MathRenderingAPI | null => {
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
 * Initialize math rendering, defaulting to MathJax.
 * For custom renderers, use setMathRenderer() before calling this function.
 *
 * Sets TWO window globals that PIE elements expect:
 * - window["@pie-lib/math-rendering"] (standard key)
 * - window["_dll_pie_lib__math_rendering"] (SystemJS/DLL key for IIFE bundles)
 *
 * @example
 * ```typescript
 * // Default MathJax
 * await initializeMathRendering();
 *
 * // Custom renderer: install it first
 * setMathRenderer(katexRenderer);
 * await initializeMathRendering();
 * ```
 */
export async function initializeMathRendering(): Promise<void> {
	// Only run in browser
	if (typeof window === "undefined") {
		return;
	}

	// Already initialized - skip.
	if (getMathRenderer()) {
		return;
	}
	if (initPromise) {
		await initPromise;
		return;
	}

	initPromise = (async () => {
		try {
			// The package has no exports map, so the file is named in full for
			// resolvers that do not complete a directory, such as webpack's
			// fully-specified ESM resolution.
			const mathRenderingModule = await import(
				"@pie-lib/math-rendering-module/module/index.js"
			);
			// The player builds defer the module's evaluation to this call (see
			// math-rendering-module-deferral.mjs); unbundled, it evaluated on import.
			const renderer = mathRenderingModule.evaluateMathRenderingModule
				? mathRenderingModule.evaluateMathRenderingModule()
				: mathRenderingModule._dll_pie_lib__math_rendering;
			// A host may install its renderer while the default module is in flight.
			// The explicit renderer remains authoritative when that happens.
			if (!getMathRenderer()) {
				setWindowRenderer(renderer as MathRenderingAPI);
				logger.debug("Math rendering module initialized (both globals set)");
			}
		} catch (error) {
			logger.error("Failed to initialize math rendering:", error);
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
