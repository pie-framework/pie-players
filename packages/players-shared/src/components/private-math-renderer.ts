/**
 * The renderer markup math falls back on when the page installed none, as under
 * the ESM and preloaded strategies: the MathJax adapter's browser build, which
 * typesets on a MathJax 4 of its own. It neither reads nor writes
 * `window.MathJax` or the page renderer, so a host's MathJax and every element's
 * copy run beside it.
 *
 * The adapter is imported on the first root to typeset, so an item without
 * markup math loads none of it.
 *
 * Under `src/components/`, which `tsc` leaves out of `dist`: only the item
 * player's build compiles this module, resolving the adapter's browser build
 * through the `pie-browser-esm` condition, so the adapter is a build-time
 * dependency of this package.
 */

type Adapter = typeof import("@pie-element/shared-math-rendering-mathjax");

let adapter: Promise<Adapter> | null = null;

export async function renderPrivateMath(root: HTMLElement): Promise<void> {
	adapter ??= import("@pie-element/shared-math-rendering-mathjax");
	let loaded: Adapter;
	try {
		loaded = await adapter;
	} catch (error) {
		// The next pass imports it again.
		adapter = null;
		throw error;
	}
	await loaded.renderMath(root);
}
