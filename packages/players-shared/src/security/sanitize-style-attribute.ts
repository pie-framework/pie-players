/**
 * Declaration-level filter for the `style` attribute on authored markup and
 * tool icons.
 *
 * DOMPurify lists `style` among its URI-safe attributes, so it permits the
 * attribute and inspects nothing inside it. Two things in an inline style
 * therefore reach the page unchecked: a URL-fetching function, which makes the
 * browser request an arbitrary origin every time the item renders and reports
 * back which learner saw which item, and `position: fixed`, which leaves the
 * item's box and covers the host page — the item player renders in light DOM
 * (`shadow: "none"`), so nothing else confines it.
 *
 * What stays permitted is the point of filtering declarations rather than
 * dropping the attribute: authored items use inline styles for ordinary
 * per-element presentation, and `position: absolute` in particular is
 * load-bearing for accessibility — MathJax's `mjx-assistive-mml` carries
 * `position: absolute; width: 1px; height: 1px; overflow: hidden` to expose
 * MathML to a screen reader while hiding it visually.
 *
 * `position: absolute` and `position: sticky` are deliberately left alone.
 * Sticky cannot leave its containing block, so it is not an escape. Absolute
 * can, when no ancestor between the node and the viewport is positioned, and
 * closing that means making the player's own container a containing block
 * rather than filtering the declaration — a change that re-anchors every
 * absolutely positioned node a PIE element renders, so it is a separate
 * decision with its own visual review.
 */

/**
 * CSS functions that make the browser fetch a URL. Serialized CSSOM values are
 * matched against this, so an escaped spelling (`\75 rl(`) is normalized to
 * `url(` before it gets here.
 */
const URL_FUNCTION_REGEX =
	/(?:^|[^\w-])(?:url|image-set|-webkit-image-set|src)\s*\(/i;

/**
 * Cheap gate on the raw attribute so the common case costs one regex and no
 * CSSOM parse. `position` is included because that check needs the parser, and
 * a backslash because it introduces a CSS escape, which is exactly how a
 * forbidden token hides from a raw-string match.
 */
const NEEDS_INSPECTION_REGEX = /url\s*\(|image-set\s*\(|src\s*\(|position|\\/i;

function isForbiddenDeclaration(property: string, value: string): boolean {
	if (URL_FUNCTION_REGEX.test(value)) return true;
	// `position` is a shorthand for nothing, so the CSSOM reports it verbatim.
	return property.toLowerCase() === "position" && /\bfixed\b/i.test(value);
}

/**
 * Rebuild the attribute from the parsed declarations, dropping the forbidden
 * ones. Anything the engine failed to parse is dropped with them: an unparsed
 * declaration cannot be inspected, and this path only runs on input that
 * already tripped the gate.
 */
function rebuildFromCssom(value: string, doc: Document): string {
	const probe = doc.createElement("span");
	probe.setAttribute("style", value);
	const declarations = probe.style;
	const kept: string[] = [];
	for (let index = 0; index < declarations.length; index += 1) {
		const property = declarations.item(index);
		if (!property) continue;
		const propertyValue = declarations.getPropertyValue(property);
		if (isForbiddenDeclaration(property, propertyValue)) continue;
		const priority = declarations.getPropertyPriority(property);
		kept.push(
			`${property}: ${propertyValue}${priority ? ` !${priority}` : ""}`,
		);
	}
	return kept.join("; ");
}

/**
 * Filter one `style` attribute value.
 *
 * Returns the input unchanged when nothing needs removing, so authored markup
 * keeps its own spelling — shorthands stay shorthands — in every case but the
 * one that carries something forbidden.
 */
export function sanitizeStyleAttribute(
	value: unknown,
	doc: Document | null | undefined,
): string {
	if (typeof value !== "string" || value.length === 0) return "";
	if (!doc) return value;
	if (!NEEDS_INSPECTION_REGEX.test(value)) return value;

	const probe = doc.createElement("span");
	probe.setAttribute("style", value);
	const declarations = probe.style;
	let hasForbidden = false;
	for (let index = 0; index < declarations.length; index += 1) {
		const property = declarations.item(index);
		if (!property) continue;
		if (
			isForbiddenDeclaration(property, declarations.getPropertyValue(property))
		) {
			hasForbidden = true;
			break;
		}
	}
	// A raw value carrying a URL function the engine did not parse into a
	// declaration still goes through the rebuild, which drops it.
	if (!hasForbidden && !URL_FUNCTION_REGEX.test(value)) return value;

	return rebuildFromCssom(value, doc);
}

/** The subset of a DOMPurify instance this hook needs. */
export interface StyleAttributeHookTarget {
	addHook?: (
		entryPoint: string,
		hook: (node: unknown, data?: unknown) => void,
	) => void;
}

/**
 * Install the filter on a DOMPurify instance.
 *
 * `afterSanitizeAttributes` rather than a post-pass over the output string:
 * DOMPurify has already parsed the markup at that point, so the declarations
 * are filtered on the node it is about to serialize instead of costing another
 * DOM round-trip.
 */
export function installStyleAttributeHook(
	purifier: StyleAttributeHookTarget,
): void {
	if (typeof purifier.addHook !== "function") return;
	purifier.addHook("afterSanitizeAttributes", (node: unknown) => {
		const element = node as Element | null;
		if (!element || typeof element.getAttribute !== "function") return;
		const raw = element.getAttribute("style");
		if (!raw) return;
		const filtered = sanitizeStyleAttribute(raw, element.ownerDocument);
		if (filtered === raw) return;
		if (filtered) element.setAttribute("style", filtered);
		else element.removeAttribute("style");
	});
}
