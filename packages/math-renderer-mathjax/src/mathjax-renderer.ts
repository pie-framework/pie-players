/**
 * MathJax renderer adapter
 *
 * Wraps the existing @pie-lib/math-rendering-module to provide
 * a pluggable MathRenderingAPI implementation.
 */

import type {
	MathRendererOptions,
	MathRenderingAPI,
} from "@pie-players/math-renderer-core";

/**
 * MathJax-specific rendering options
 */
export interface MathjaxRendererOptions extends MathRendererOptions {
	/**
	 * Enable accessibility features (speech output, etc.)
	 * @default true
	 */
	accessibility?: boolean;

	/**
	 * Auto-load MathJax fonts
	 * @default true
	 */
	loadFonts?: boolean;
}

/**
 * Create MathJax renderer adapter
 *
 * Loads and configures the @pie-lib/math-rendering-module (MathJax-based)
 * and wraps it in the MathRenderingAPI interface.
 *
 * @param options - Configuration options for MathJax
 * @returns Promise resolving to MathRenderingAPI implementation
 *
 * @example
 * ```typescript
 * import { createMathjaxRenderer } from '@pie-players/math-renderer-mathjax';
 *
 * const renderer = await createMathjaxRenderer({
 *   accessibility: true
 * });
 *
 * await renderer.renderMath(document.body);
 * ```
 */
export async function createMathjaxRenderer(
	_options: MathjaxRendererOptions = {},
): Promise<MathRenderingAPI> {
	// Lazy load @pie-lib/math-rendering-module
	// This avoids SSR issues and keeps the module browser-only
	const { _dll_pie_lib__math_rendering } = await import(
		"@pie-lib/math-rendering-module/module"
	);

	// The module already has the correct API shape
	// Future: Apply _options/configuration here if needed

	return _dll_pie_lib__math_rendering;
}
