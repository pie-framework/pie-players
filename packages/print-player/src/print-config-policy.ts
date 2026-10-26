import { assertElementPackagesAllowed } from "@pie-players/pie-players-shared/loaders";
import { validateCustomElementTag } from "@pie-players/pie-players-shared/pie/tag-names";

import type { Config, PrintLoaderOptions } from "./types.js";

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

/** Validate the complete config before invoking a resolver or changing jobs. */
export function assertPrintConfigAllowed(
	config: Config,
	policy?: PrintLoaderOptions["elementPackagePolicy"],
): void {
	for (const tagName of Object.keys(config.item.elements)) {
		validateCustomElementTag(tagName, "print element tag");
	}
	assertElementPackagesAllowed(config.item.elements, policy);

	// DOMParser's inert document discovers HTML element names without upgrading
	// already-registered custom elements. Sanitization/trustMarkup still owns
	// non-PIE markup; neither may bypass the declared PIE package map.
	const declaredTags = new Set(Object.keys(config.item.elements));
	const parsedMarkup = new DOMParser().parseFromString(
		config.item.markup,
		"text/html",
	);
	for (const element of parsedMarkup.querySelectorAll("*")) {
		if (
			element.namespaceURI === HTML_NAMESPACE &&
			element.localName.startsWith("pie-") &&
			!declaredTags.has(element.localName)
		) {
			throw new Error(
				"Invalid print config contract: PIE markup tag is not declared in `elements`.",
			);
		}
	}
}
