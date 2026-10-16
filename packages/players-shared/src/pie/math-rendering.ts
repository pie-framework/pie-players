/**
 * Math rendering bootstrap for PIE players
 *
 * PIE elements expect @pie-lib/math-rendering to be available on window.
 * This module ensures required globals are populated from the upstream
 * @pie-lib/math-rendering-module package, and also supports overriding with
 * a custom renderer object through setMathRenderer().
 */

/// <reference path="../shims.d.ts" />
import { createPieLogger, isGlobalDebugEnabled } from "./logger.js";
import { pageMathAssetRoot } from "./math-assets.js";

export type MathRenderer = (element: HTMLElement) => void | Promise<void>;
export interface MathRenderingAPI {
	renderMath: MathRenderer;
	wrapMath?: (latex: string) => string;
	unWrapMath?: (wrapped: string) => string;
	mmlToLatex?: (mathml: string) => string;
}

const GLOBAL_KEY = "@pie-lib/math-rendering";
const GLOBAL_DLL_KEY = "_dll_pie_lib__math_rendering";
// Every copy of @pie-lib/math-rendering on a page typesets through the MathJax
// instance kept here, and the first copy to typeset creates it.
const SHARED_INSTANCE_KEY = "@pie-lib/math-rendering@2";
let initPromise: Promise<void> | null = null;
const logger = createPieLogger("math-rendering", () => isGlobalDebugEnabled());

/**
 * The speech-rule-engine version the default renderer bundles, whose rules it
 * loads from `speech-rule-engine@<version>/lib/mathmaps` under an npm root. A
 * test pins it to the module.
 * @internal
 */
export const DEFAULT_RENDERER_SRE_VERSION = "4.1.2";

/** How the default renderer `initializeMathRendering` installs loads its assets. */
export interface MathRenderingOptions {
	/**
	 * The npm root the renderer's speech rules load from when the page's math
	 * options set no `assetRoot`. With neither, jsDelivr. A page that names the
	 * rules' directory itself, in `SREfeature.json` or a `text/x-sre-config`
	 * block, keeps it.
	 */
	assetRoot?: string;
}

const SRE_FEATURE_KEY = "SREfeature";

const pageNamesSpeechRules = (): boolean => {
	const feature = (window as any)[SRE_FEATURE_KEY];
	if (feature && typeof feature === "object" && feature.json) return true;
	return Array.from(
		document.querySelectorAll('script[type="text/x-sre-config"]'),
	).some((block) => {
		try {
			return !!JSON.parse(block.textContent || "")?.json;
		} catch {
			return false;
		}
	});
};

/**
 * Points the module's speech-rule-engine at the rules under `root` and returns
 * the undo. SRE reads `SREfeature` as it sets up, synchronously while the
 * module evaluates, and its later setups keep the path, so the global is
 * restored afterwards: another copy of SRE on the page, as a legacy bundle
 * carries, keeps the rules of its own version.
 */
const pointSpeechRulesAt = (root: string | undefined): (() => void) => {
	if (!root || typeof document === "undefined" || pageNamesSpeechRules()) {
		return () => {};
	}
	const host = window as unknown as Record<string, unknown>;
	const had = Object.prototype.hasOwnProperty.call(host, SRE_FEATURE_KEY);
	const previous = host[SRE_FEATURE_KEY];
	host[SRE_FEATURE_KEY] = {
		...(previous && typeof previous === "object" ? previous : {}),
		json: `${root.replace(/\/+$/, "")}/speech-rule-engine@${DEFAULT_RENDERER_SRE_VERSION}/lib/mathmaps`,
	};
	return () => {
		if (had) host[SRE_FEATURE_KEY] = previous;
		else delete host[SRE_FEATURE_KEY];
	};
};

/**
 * The page's renderer: the one `initializeMathRendering` installed, or a
 * host's. IIFE elements render with it, and so do ESM elements when the page
 * has one.
 */
export const getMathRenderer = (): MathRenderingAPI | null => {
	if (typeof window === "undefined") {
		return null;
	}
	const renderer = (window as any)[GLOBAL_KEY] as MathRenderingAPI | undefined;
	return renderer || null;
};

const setWindowRenderer = (renderer: MathRenderingAPI): void => {
	if (typeof window === "undefined") return;
	(window as any)[GLOBAL_KEY] = renderer;
	(window as any)[GLOBAL_DLL_KEY] = renderer;
};

/**
 * Creates the shared MathJax instance from `renderer`, unless the page already
 * holds one.
 *
 * Legacy element bundles carry their own copy of math-rendering. A copy that
 * predates the assistive-MathML guard, such as the one in multiple-choice
 * 9.9.1, re-typesets the hidden `<math>` inside `mjx-assistive-mml` on every
 * pass, so if it creates the instance, each re-render nests the expression
 * again for every element on the page. Typesetting a detached element makes the
 * guarded module create it first. Failure leaves the instance to the first
 * element, as before, so it is logged and never fails initialization.
 */
const createSharedInstance = (renderer: MathRenderingAPI): void => {
	if ((window as any)[SHARED_INSTANCE_KEY]?.instance) return;
	if (typeof document === "undefined" || !document.body) return;
	const warn = (error: unknown) =>
		logger.warn("Could not create the shared MathJax instance:", error);
	try {
		Promise.resolve(renderer.renderMath(document.createElement("div"))).catch(
			warn,
		);
	} catch (error) {
		warn(error);
	}
};

/**
 * Initialize math rendering, defaulting to MathJax.
 * For custom renderers, use setMathRenderer() before calling this function.
 *
 * Sets TWO window globals that PIE elements expect:
 * - window["@pie-lib/math-rendering"] (standard key)
 * - window["_dll_pie_lib__math_rendering"] (SystemJS/DLL key for IIFE bundles)
 *
 * The first call installs the renderer for the page, so its `options` apply.
 *
 * @example
 * ```typescript
 * // Default MathJax
 * await initializeMathRendering();
 *
 * // Custom renderer: install it first
 * setMathRenderer(katexRenderer);
 * await initializeMathRendering();
 * ```
 */
export async function initializeMathRendering(
	options: MathRenderingOptions = {},
): Promise<void> {
	// Only run in browser
	if (typeof window === "undefined") {
		return;
	}

	// Already initialized - skip.
	if (getMathRenderer()) {
		return;
	}
	if (initPromise) {
		await initPromise;
		return;
	}

	initPromise = (async () => {
		const restoreSpeechRules = pointSpeechRulesAt(
			pageMathAssetRoot() ?? options.assetRoot,
		);
		try {
			// The package has no exports map, so the file is named in full for
			// resolvers that do not complete a directory, such as webpack's
			// fully-specified ESM resolution.
			const mathRenderingModule = await import(
				"@pie-lib/math-rendering-module/module/index.js"
			);
			// The player builds defer the module's evaluation to this call (see
			// math-rendering-module-deferral.mjs); unbundled, it evaluated on import.
			const renderer = mathRenderingModule.evaluateMathRenderingModule
				? mathRenderingModule.evaluateMathRenderingModule()
				: mathRenderingModule._dll_pie_lib__math_rendering;
			// A host may install its renderer while the default module is in flight.
			// The explicit renderer remains authoritative when that happens.
			if (!getMathRenderer()) {
				setWindowRenderer(renderer as MathRenderingAPI);
				createSharedInstance(renderer as MathRenderingAPI);
				logger.debug("Math rendering module initialized (both globals set)");
			}
		} catch (error) {
			logger.error("Failed to initialize math rendering:", error);
			throw error;
		} finally {
			restoreSpeechRules();
		}
	})();
	try {
		await initPromise;
	} finally {
		initPromise = null;
	}
}

/**
 * Set custom math renderer programmatically
 *
 * Call this BEFORE initializeMathRendering() or any loader.load() calls
 * to override the default MathJax renderer.
 *
 * @param renderer - The renderer to use
 *
 * @example
 * ```typescript
 * import { setMathRenderer } from '@pie-players/pie-players-shared/pie';
 *
 * const renderer = await createCustomRenderer();
 * setMathRenderer(renderer);
 *
 * // Now load PIE elements - they'll use your custom renderer
 * await loader.load(config, document, needsControllers);
 * ```
 */
export function setMathRenderer(renderer: MathRenderingAPI): void {
	setWindowRenderer(renderer);
}
