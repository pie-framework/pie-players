/**
 * @pie-players/math-renderer-mathjax
 *
 * MathJax adapter for PIE math rendering (~2.7MB)
 * Full-featured LaTeX and MathML rendering with accessibility support.
 *
 * This adapter wraps the upstream @pie-lib/math-rendering-module package.
 *
 * @example
 * ```typescript
 * import { createMathjaxRenderer } from '@pie-players/math-renderer-mathjax';
 * import { mathRendererProvider } from '@pie-players/math-renderer-core';
 *
 * const renderer = await createMathjaxRenderer();
 * mathRendererProvider.setRenderer(renderer);
 * ```
 */

export type { MathjaxRendererOptions } from "./mathjax-renderer.js";
export { createMathjaxRenderer } from "./mathjax-renderer.js";
