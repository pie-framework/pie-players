/**
 * The renderer markup math falls back on when the page installed none, as under
 * the ESM and preloaded strategies: the MathJax adapter's browser build, which
 * typesets on a MathJax 4 of its own. It neither reads nor writes
 * `window.MathJax` or the page renderer, so a host's MathJax and every element's
 * copy run beside it.
 *
 * The adapter is imported on the first root to typeset, so an item without
 * markup math loads none of it. Its fonts and speech load from the page options'
 * asset root, which a preloaded registration sets, then from the root the player
 * passes, the ESM CDN under `esm`, then from the npm root of the player's own
 * module URL.
 *
 * Under `src/components/`, which `tsc` leaves out of `dist`: only the item
 * player's build compiles this module, resolving the adapter's browser build
 * through the `pie-browser-esm` condition, so the adapter is a build-time
 * dependency of this package.
 */

import { pageMathAssetRoot } from "../pie/math-assets.js";

type Renderer = (root: HTMLElement) => Promise<void>;

let renderer: Promise<Renderer> | null = null;

/** The legacy opt-in for `$…$` inline math, which the adapter's `renderMath` reads too. */
function pageUsesSingleDollar(): boolean {
	const legacy = (globalThis as Record<string, any>)["@pie-lib/math-rendering@2"];
	return Boolean(legacy?.opts?.useSingleDollar);
}

/**
 * Typesets the math in `root`. The first call creates the renderer, so its
 * `assetRoot` is the one MathJax starts with.
 */
export async function renderPrivateMath(
	root: HTMLElement,
	assetRoot?: string,
): Promise<void> {
	renderer ??= import("@pie-element/shared-math-rendering-mathjax").then(
		({ createMathjaxRenderer }) =>
			createMathjaxRenderer({
				useSingleDollar: pageUsesSingleDollar(),
				assetRoot: pageMathAssetRoot() ? undefined : assetRoot,
			}),
	);
	let render: Renderer;
	try {
		render = await renderer;
	} catch (error) {
		// The next pass imports it again.
		renderer = null;
		throw error;
	}
	await render(root);
}
