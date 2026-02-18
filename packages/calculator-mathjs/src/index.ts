/**
 * @pie-players/pie-calculator-mathjs
 *
 * Math.js Calculator Provider - Two implementations available:
 *
 * 1. Vanilla TypeScript (default export)
 *    - No framework dependencies
 *    - Good for non-Svelte projects
 *    - Uses template literals for HTML generation
 *
 * 2. Svelte Components (import from '@pie-players/pie-calculator-mathjs/svelte')
 *    - Clean component architecture
 *    - Better maintainability
 *    - Smaller bundle with Svelte
 *    - Requires Svelte 5+
 *
 * Example usage:
 * ```typescript
 * // Vanilla TypeScript
 * import { MathJsCalculatorProvider } from '@pie-players/pie-calculator-mathjs';
 *
 * // Svelte
 * import { MathJsCalculatorProvider } from '@pie-players/pie-calculator-mathjs/svelte';
 * // Or use the component directly:
 * import Calculator from '@pie-players/pie-calculator-mathjs/svelte';
 * ```
 */

export { MathJsCalculatorProvider } from "./mathjs-provider.js";
