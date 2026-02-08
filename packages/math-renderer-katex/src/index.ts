/**
 * @pie-players/math-renderer-katex
 *
 * KaTeX adapter for PIE math rendering (~100KB)
 * Fast, lightweight LaTeX rendering for browsers.
 *
 * @example
 * ```typescript
 * import { createKatexRenderer } from '@pie-players/math-renderer-katex';
 * import { setMathRenderer } from '@pie-players/pie-players-shared/pie';
 *
 * const renderer = await createKatexRenderer({ throwOnError: false });
 * setMathRenderer(renderer);
 *
 * // Now load PIE elements - they'll use KaTeX
 * await loader.load(config, document, needsControllers);
 * ```
 */

export type { KatexRendererOptions } from "./katex-renderer.js";
export { createKatexRenderer } from "./katex-renderer.js";
