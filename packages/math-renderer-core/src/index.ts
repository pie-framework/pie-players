/**
 * @pie-players/math-renderer-core
 *
 * Core types and provider for pluggable math rendering in PIE players.
 * This package provides the foundation - actual rendering is done by adapter packages:
 *
 * - @pie-players/math-renderer-mathjax - Full-featured MathJax renderer (~2.7MB)
 * - @pie-players/math-renderer-katex - Fast, lightweight KaTeX renderer (~100KB)
 *
 * @example
 * ```typescript
 * import { mathRendererProvider } from '@pie-players/math-renderer-core';
 * import { createKatexRenderer } from '@pie-players/math-renderer-katex';
 *
 * const renderer = await createKatexRenderer();
 * mathRendererProvider.setRenderer(renderer);
 * ```
 */

// Provider
export { mathRendererProvider } from "./provider";
// Core types
export type {
	MathRenderer,
	MathRendererOptions,
	MathRenderingAPI,
} from "./types";
