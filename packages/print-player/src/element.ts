/**
 * Native host interface for `<pie-print>`.
 *
 * Declared without the framework the element is built on, so the published types
 * name no package a host has to install and do not pin a Lit major.
 * `index.ts` checks the class against this interface at compile time.
 */

import type { PrintMarkupSanitizer } from "./shared-shapes.js";
import type {
	Config,
	MissingElFn,
	PrintLoaderOptions,
	ResolverFn,
} from "./types.js";

/**
 * `<pie-print>`: properties set before `config` take effect for it. The
 * `trust-markup` attribute sets {@link PiePrintElement.trustMarkup}; setting the
 * property leaves the attribute as it is.
 */
export interface PiePrintElement extends HTMLElement {
	/** Item configuration with elements and models. Assigning it starts a print job. */
	config: Config;
	/**
	 * Where print modules load from, and the optional element package policy.
	 * Read when `config` is set, so set it first.
	 */
	loaderOptions: PrintLoaderOptions | undefined;
	/** Resolves each element tag and package to the URL its print module loads from. */
	set resolve(fn: ResolverFn);
	/** Factory for the placeholder an element without a print build renders as. */
	missingElement: MissingElFn;
	/**
	 * Render authored markup without sanitizing it. Off by default. Only set this
	 * when the host has already validated the markup.
	 */
	trustMarkup: boolean;
	/** Sanitizer used instead of the default one. Ignored when `trustMarkup` is set. */
	sanitizeMarkup: PrintMarkupSanitizer | null;
	/** Settles when the element has rendered its pending updates. */
	readonly updateComplete: Promise<boolean>;
}

/** The constructor `<pie-print>` registers. */
export interface PiePrintConstructor {
	new (): PiePrintElement;
	readonly prototype: PiePrintElement;
}

declare global {
	interface HTMLElementTagNameMap {
		"pie-print": PiePrintElement;
	}
}
