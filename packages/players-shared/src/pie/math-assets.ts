/**
 * Where the MathJax adapter's copies load MathJax's fonts, speech worker and,
 * on its npm build, MathJax itself from, and whether math is in the tab order.
 * Every copy of `@pie-element/shared-math-rendering-mathjax` reads these from
 * the legacy renderer's page options as it starts MathJax, on its first render,
 * so they are set before any element renders. See
 * https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/MATH-RENDERING.md#assets
 */

/** The legacy renderer's page options, which the adapter reads as well. */
const PAGE_OPTIONS_KEY = "@pie-lib/math-rendering@2";

export interface MathAssetOptions {
	/**
	 * An npm root: a URL under which `<package>@<version>/<path>` serves that
	 * file of the package, such as `https://cdn.jsdelivr.net/npm`. A relative URL
	 * resolves against the page.
	 */
	assetRoot?: string | URL;
	/**
	 * The directory of `speech-worker.js` and its `mathmaps/`, by default
	 * `mathjax@<version>/sre` under the asset root.
	 */
	speechPath?: string | URL;
	/**
	 * The URL of individual files by npm path, `<package>@<version>/<path>`: a
	 * listed file loads from its URL, the rest from the asset root. A bundle lists
	 * each file it ships as `new URL("./…", import.meta.url)`, which its host's
	 * bundler emits, and needs no root. Read by the adapter's browser build, for
	 * its fonts, speech worker and speech rules.
	 */
	assetUrls?: Readonly<Record<string, string | URL>>;
	/**
	 * The speech locales the MathJax menu lists, by id (`["en", "es"]`), or by id
	 * with the label it shows. Unset, it lists every locale SRE ships.
	 */
	speechLocales?: readonly string[] | Readonly<Record<string, string>>;
	/**
	 * Puts typeset math in the keyboard tab order, for the MathJax menu and its
	 * explorer. Off by default.
	 */
	inTabOrder?: boolean;
}

const isUrl = (value: unknown): value is string | URL =>
	(typeof value === "string" && value !== "") || value instanceof URL;

/** Why `options` is not a `MathAssetOptions`, or `undefined` when it is. */
export function mathAssetOptionsError(options: unknown): string | undefined {
	if (!options || typeof options !== "object" || Array.isArray(options)) {
		return "must be an object";
	}
	const { assetRoot, speechPath, assetUrls, speechLocales, inTabOrder } =
		options as MathAssetOptions;
	if (assetRoot !== undefined && !isUrl(assetRoot)) {
		return `assetRoot must be a URL, got ${JSON.stringify(assetRoot)}`;
	}
	if (speechPath !== undefined && !isUrl(speechPath)) {
		return `speechPath must be a URL, got ${JSON.stringify(speechPath)}`;
	}
	if (
		assetUrls !== undefined &&
		(!assetUrls ||
			typeof assetUrls !== "object" ||
			Array.isArray(assetUrls) ||
			!Object.values(assetUrls).every(isUrl))
	) {
		return "assetUrls must map npm paths to URLs";
	}
	if (speechLocales !== undefined) {
		const listed = Array.isArray(speechLocales)
			? speechLocales
			: speechLocales && typeof speechLocales === "object"
				? Object.values(speechLocales)
				: null;
		if (!listed || listed.some((entry) => typeof entry !== "string" || !entry)) {
			return "speechLocales must be locale ids, or locale ids mapped to their labels";
		}
	}
	if (inTabOrder !== undefined && typeof inTabOrder !== "boolean") {
		return `inTabOrder must be a boolean, got ${JSON.stringify(inTabOrder)}`;
	}
	return undefined;
}

/**
 * Writes `options` to the page options, keeping the ones it leaves unset and
 * the files of `assetUrls` it does not list.
 */
export function setMathAssetOptions(options: MathAssetOptions): void {
	if (typeof window === "undefined") return;
	const host = window as unknown as Record<
		string,
		{ opts?: Record<string, unknown> } | undefined
	>;
	const page = (host[PAGE_OPTIONS_KEY] ??= {});
	const opts = (page.opts ??= {});
	if (options.assetRoot !== undefined) opts.assetRoot = String(options.assetRoot);
	if (options.speechPath !== undefined) opts.speechPath = String(options.speechPath);
	if (options.assetUrls !== undefined) {
		const listed = opts.assetUrls && typeof opts.assetUrls === "object" ? opts.assetUrls : {};
		opts.assetUrls = {
			...listed,
			...Object.fromEntries(
				Object.entries(options.assetUrls).map(([path, url]) => [path, String(url)]),
			),
		};
	}
	if (options.speechLocales !== undefined) {
		opts.speechLocales = Array.isArray(options.speechLocales)
			? [...options.speechLocales]
			: { ...options.speechLocales };
	}
	if (options.inTabOrder !== undefined) opts.inTabOrder = options.inTabOrder;
}

/** The asset root the page options set, if any. */
export function pageMathAssetRoot(): string | undefined {
	if (typeof window === "undefined") return undefined;
	const root = (window as unknown as Record<string, { opts?: { assetRoot?: unknown } }>)[
		PAGE_OPTIONS_KEY
	]?.opts?.assetRoot;
	return typeof root === "string" && root ? root : undefined;
}
