/**
 * Core math renderer types
 *
 * Matches pie-elements-ng pattern for maximum compatibility
 */

/**
 * Math renderer function signature
 *
 * Takes an HTML element and renders math within it.
 * Can be synchronous or asynchronous.
 *
 * @example
 * ```typescript
 * const renderer: MathRenderer = async (element) => {
 *   const mathElements = element.querySelectorAll('[data-latex]');
 *   mathElements.forEach(el => {
 *     // Render math...
 *   });
 * };
 * ```
 */
export type MathRenderer = (element: HTMLElement) => void | Promise<void>;

/**
 * Math rendering implementation - provides full API for window globals
 *
 * This is the complete API that PIE elements expect to find on:
 * - window["@pie-lib/math-rendering"]
 * - window["_dll_pie_lib__math_rendering"]
 */
export interface MathRenderingAPI {
	/**
	 * Render math in the given element
	 */
	renderMath: MathRenderer;

	/**
	 * Wrap LaTeX with delimiters
	 */
	wrapMath?: (latex: string) => string;

	/**
	 * Remove delimiter wrapping from LaTeX
	 */
	unWrapMath?: (wrapped: string) => string;

	/**
	 * Convert MathML to LaTeX
	 */
	mmlToLatex?: (mathml: string) => string;
}

/**
 * Configuration options for math renderers
 */
export interface MathRendererOptions {
	/**
	 * Delimiter configuration
	 */
	delimiters?: {
		inline: [string, string];
		display: [string, string];
	};

	/**
	 * Renderer-specific options (passed through)
	 */
	[key: string]: any;
}
