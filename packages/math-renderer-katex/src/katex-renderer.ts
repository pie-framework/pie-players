/**
 * KaTeX renderer adapter
 *
 * Provides a lightweight, fast alternative to MathJax using KaTeX (~100KB vs ~2.7MB)
 */

import type {
	MathRendererOptions,
	MathRenderingAPI,
} from "@pie-players/math-renderer-core";

/**
 * KaTeX-specific rendering options
 */
export interface KatexRendererOptions extends MathRendererOptions {
	/**
	 * If true, render errors will be thrown as exceptions
	 * If false, errors will be rendered in the output
	 * @default false
	 */
	throwOnError?: boolean;

	/**
	 * Color to use for rendering errors (when throwOnError is false)
	 * @default "#cc0000"
	 */
	errorColor?: string;

	/**
	 * If true, allow commands like \includegraphics
	 * @default false
	 */
	trust?: boolean;

	/**
	 * Automatically load KaTeX CSS
	 * @default true
	 */
	loadCss?: boolean;

	/**
	 * Custom KaTeX CSS URL
	 * @default "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"
	 */
	cssUrl?: string;
}

/**
 * Load KaTeX CSS stylesheet
 */
async function loadKatexStyles(cssUrl?: string): Promise<void> {
	if (typeof document === "undefined") {
		return;
	}

	const url =
		cssUrl || "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";

	// Check if already loaded
	if (document.querySelector(`link[href="${url}"]`)) {
		return;
	}

	return new Promise((resolve, reject) => {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = url;

		link.onload = () => resolve();
		link.onerror = () => reject(new Error(`Failed to load KaTeX CSS: ${url}`));

		document.head.appendChild(link);
	});
}

/**
 * Create KaTeX renderer adapter
 *
 * Dynamically loads KaTeX and provides a MathJax-compatible API for rendering math.
 *
 * @param options - Configuration options for KaTeX
 * @returns Promise resolving to MathRenderingAPI implementation
 *
 * @example
 * ```typescript
 * import { createKatexRenderer } from '@pie-players/math-renderer-katex';
 * import { setMathRenderer } from '@pie-players/pie-players-shared/pie';
 *
 * const renderer = await createKatexRenderer({
 *   throwOnError: false,
 *   trust: true
 * });
 *
 * setMathRenderer(renderer);
 * ```
 */
export async function createKatexRenderer(
	options: KatexRendererOptions = {},
): Promise<MathRenderingAPI> {
	const {
		throwOnError = false,
		errorColor = "#cc0000",
		trust = false,
		loadCss = true,
		cssUrl,
	} = options;

	// Dynamically import KaTeX (avoids SSR issues)
	const katex = await import("katex");

	// Load KaTeX CSS if requested
	if (loadCss) {
		await loadKatexStyles(cssUrl);
	}

	/**
	 * Render math in element (MathJax-compatible API)
	 */
	const renderMath = (element: HTMLElement): void => {
		// Find all elements with data-latex attribute or .math class
		const mathElements = element.querySelectorAll("[data-latex], .math");

		mathElements.forEach((el) => {
			const latex = el.getAttribute("data-latex") || el.textContent || "";
			const displayMode = el.classList.contains("display");

			try {
				katex.default.render(latex, el as HTMLElement, {
					displayMode,
					throwOnError,
					errorColor,
					trust,
				});
			} catch (err) {
				console.error("[KaTeX] Render error:", err);
				// Fallback to raw LaTeX on error
				if (!throwOnError) {
					el.textContent = latex;
				}
			}
		});
	};

	/**
	 * Wrap LaTeX with delimiters (MathJax-compatible API)
	 */
	const wrapMath = (latex: string): string => {
		return `\\(${latex}\\)`;
	};

	/**
	 * Remove delimiter wrapping from LaTeX (MathJax-compatible API)
	 */
	const unWrapMath = (wrapped: string): string => {
		return wrapped.replace(/^\\\(|\\\)$/g, "").replace(/^\\\[|\\\]$/g, "");
	};

	// Return MathJax-compatible API
	return {
		renderMath,
		wrapMath,
		unWrapMath,
	};
}
