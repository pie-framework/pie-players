/**
 * SSMLExtractor
 *
 * Service for extracting embedded SSML from PIE item content and converting
 * it into QTI 3.0 accessibility catalogs.
 *
 * Authors can embed <speak> SSML tags directly in content for convenience.
 * The extractor automatically:
 * 1. Parses markup and finds all <speak> elements
 * 2. Extracts SSML content with language metadata
 * 3. Generates accessibility catalogs with unique IDs
 * 4. Cleans visual markup (removes SSML, adds data-catalog-idref)
 *
 * This enables proper pronunciation, emphasis, and pacing for TTS without
 * requiring authors to maintain separate catalog files.
 *
 * Part of PIE Assessment Toolkit.
 */

import type {
	AccessibilityCatalog,
	ConfigEntity,
	PieModel,
} from "@pie-players/pie-players-shared/types";

/**
 * Result from extracting SSML from markup
 */
interface MarkupExtractionResult {
	catalogs: AccessibilityCatalog[];
	cleanedMarkup: string;
}

/**
 * Result from extracting SSML from entire item config
 */
export interface ExtractionResult {
	catalogs: AccessibilityCatalog[];
	cleanedConfig: ConfigEntity;
}

/**
 * Allow-listed SSML elements (from the SSML 1.1 spec subset we forward to
 * TTS providers). Anything outside this list is unwrapped during
 * sanitization so we never leak author-supplied scripts, iframes, or
 * arbitrary HTML into the TTS pipeline.
 */
const SSML_ALLOWED_TAGS = new Set([
	"speak",
	"break",
	"prosody",
	"emphasis",
	"say-as",
	"sub",
	"mark",
	"phoneme",
	"lang",
	"p",
	"s",
	"voice",
	"audio",
	"lexicon",
]);

/**
 * Allow-listed attributes across SSML elements. Attribute allow-listing is
 * global (not per-tag) because the union is small and consistent across
 * providers.
 */
/**
 * Tags whose content must be dropped entirely (rather than unwrapped to
 * preserve phrasing text). These are dangerous containers whose text
 * payload could be re-interpreted downstream.
 */
const SSML_DROP_FULLY_TAGS = new Set([
	"script",
	"style",
	"iframe",
	"object",
	"embed",
	"foreignobject",
	"noscript",
	"template",
]);

const SSML_ALLOWED_ATTRS = new Set([
	"alphabet",
	"ph",
	"time",
	"strength",
	"rate",
	"pitch",
	"volume",
	"name",
	"interpret-as",
	"format",
	"detail",
	"language",
	"xml:lang",
	"lang",
	"gender",
	"src",
]);

/**
 * SSML elements that are empty in practice (no child content). Authors
 * typically write them as self-closing (`<break time="200ms"/>`). HTML's
 * parser does NOT recognize them as void elements and silently drops the
 * `/`, then nests every subsequent sibling as a child — producing
 * malformed SSML like `<break>…rest of paragraph…</break>` when
 * round-tripped. Pre-processing self-closing forms to explicit
 * open+close pairs before HTML parsing avoids the reflow, and the
 * serializer re-emits them as self-closing so providers see valid SSML.
 *
 * `audio` is intentionally excluded — SSML <audio> may carry fallback
 * children (the spec's "alternate content"), so treating it as void
 * would lose author intent.
 */
const SSML_VOID_TAGS = new Set(["break", "mark", "lexicon"]);

/**
 * Normalize self-closing forms of SSML void elements to explicit
 * open+close pairs BEFORE handing the string to an HTML parser. The
 * HTML5 parser ignores the `/` on non-void tags, so `<break/>` becomes
 * a plain `<break>` open tag that swallows every following sibling.
 * Rewriting to `<break></break>` preserves the empty-element shape
 * across the HTML round-trip.
 */
function expandSelfClosingVoidTags(input: string): string {
	let next = input;
	for (const tag of SSML_VOID_TAGS) {
		const selfClosing = new RegExp(`<${tag}\\b([^>/]*?)\\s*/>`, "gi");
		next = next.replace(selfClosing, (_match, attrs: string) => {
			const attrText = attrs ? attrs.replace(/\s+$/, "") : "";
			return `<${tag}${attrText}></${tag}>`;
		});
	}
	return next;
}

/**
 * Hosts that must never appear inside an SSML `<audio src>` because they
 * would cause the server-side TTS provider to fetch a private / metadata
 * endpoint on behalf of the request. Mirrors the SchoolCity provider's
 * defense-in-depth check; the SSML-side block is cheap and belt-and-braces.
 */
const SSML_PRIVATE_AUDIO_HOSTS: RegExp[] = [
	/^localhost$/i,
	/^127(?:\.\d{1,3}){3}$/,
	/^0(?:\.\d{1,3}){3}$/,
	/^10(?:\.\d{1,3}){3}$/,
	/^192\.168(?:\.\d{1,3}){2}$/,
	/^172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}$/,
	/^169\.254(?:\.\d{1,3}){2}$/,
	/^::1$/,
	/^fe80:/i,
	/^fc00:/i,
	/^fd[0-9a-f]{2}:/i,
	/^metadata\.google\.internal$/i,
	/^metadata\.azure\.internal$/i,
	/^metadata\.packet\.net$/i,
];

function isSafeSsmlAudioSrc(raw: string): boolean {
	if (typeof raw !== "string" || raw.length === 0) return false;
	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		return false;
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return false;
	}
	const hostname = parsed.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
	return !SSML_PRIVATE_AUDIO_HOSTS.some((pattern) => pattern.test(hostname));
}

/**
 * Sanitize an SSML subtree in place: remove disallowed attributes and
 * replace disallowed elements with their text content (so phrasing order
 * is preserved but no scripts / iframes / unknown tags survive).
 */
export function sanitizeSsmlElement(element: Element): void {
	// Walk children snapshot first because we may replace nodes as we go.
	const children = Array.from(element.children);
	for (const child of children) {
		const tagName = child.tagName.toLowerCase();
		if (SSML_DROP_FULLY_TAGS.has(tagName)) {
			child.remove();
			continue;
		}
		sanitizeSsmlElement(child);
		if (!SSML_ALLOWED_TAGS.has(tagName)) {
			const textNode = element.ownerDocument.createTextNode(
				child.textContent ?? "",
			);
			child.replaceWith(textNode);
		}
	}
	// Strip disallowed attributes on the surviving node.
	const attrNames = Array.from(element.attributes).map((attr) => attr.name);
	for (const attrName of attrNames) {
		if (!SSML_ALLOWED_ATTRS.has(attrName.toLowerCase())) {
			element.removeAttribute(attrName);
		}
	}
	// Belt-and-braces: even though `src` is allow-listed, SSML `<audio>`
	// sends its URL to a server-side TTS provider that will dereference
	// it. Refuse non-http(s) schemes and private / cloud-metadata hosts
	// at the SSML boundary so we never forward an SSRF primitive.
	if (element.tagName.toLowerCase() === "audio") {
		const src = element.getAttribute("src");
		if (src !== null && !isSafeSsmlAudioSrc(src)) {
			element.removeAttribute("src");
		}
	}
}

/**
 * Serialize a sanitized `<speak>` element back to a minimal SSML string.
 * Uses a manual walker instead of `outerHTML` so that any namespace
 * quirks (e.g. `xmlns` attributes added by the HTML parser) are
 * normalised and disallowed descendants cannot reappear through quirks
 * in the serializer.
 */
export function serializeSsmlElement(element: Element): string {
	const tagName = element.tagName.toLowerCase();
	const attrs = Array.from(element.attributes)
		.filter((attr) => SSML_ALLOWED_ATTRS.has(attr.name.toLowerCase()))
		.map((attr) => ` ${attr.name}="${escapeXmlAttr(attr.value)}"`)
		.join("");
	// SSML void elements (e.g. <break>, <mark>) must be emitted as
	// self-closing so providers like AWS Polly accept them. Emitting
	// `<break></break>` parses fine on the SSML side but is wasteful;
	// emitting `<break>` (open without close) is invalid SSML.
	if (SSML_VOID_TAGS.has(tagName)) {
		return `<${tagName}${attrs}/>`;
	}
	const childPieces: string[] = [];
	for (const node of Array.from(element.childNodes)) {
		if (node.nodeType === 3 /* text */) {
			childPieces.push(escapeXmlText(node.nodeValue ?? ""));
		} else if (node.nodeType === 1 /* element */) {
			const childElement = node as Element;
			const childTag = childElement.tagName.toLowerCase();
			if (SSML_DROP_FULLY_TAGS.has(childTag)) {
				continue;
			}
			if (SSML_ALLOWED_TAGS.has(childTag)) {
				childPieces.push(serializeSsmlElement(childElement));
			} else {
				childPieces.push(escapeXmlText(childElement.textContent ?? ""));
			}
		}
	}
	return `<${tagName}${attrs}>${childPieces.join("")}</${tagName}>`;
}

export function sanitizeSsmlString(input: string): string {
	const trimmed = String(input || "").trim();
	if (!trimmed || !trimmed.includes("<")) return input;
	if (typeof DOMParser === "undefined") return input;
	const parser = new DOMParser();
	const doc = parser.parseFromString(expandSelfClosingVoidTags(trimmed), "text/html");
	const speakElement = doc.querySelector("speak");
	if (speakElement) {
		sanitizeSsmlElement(speakElement);
		return serializeSsmlElement(speakElement);
	}
	const wrapper = doc.createElement("speak");
	for (const node of Array.from(doc.body.childNodes)) {
		wrapper.appendChild(node);
	}
	sanitizeSsmlElement(wrapper);
	return Array.from(wrapper.childNodes)
		.map((node) => {
			if (node.nodeType === 3 /* text */) {
				return escapeXmlText(node.nodeValue ?? "");
			}
			if (node.nodeType === 1 /* element */) {
				const child = node as Element;
				if (SSML_ALLOWED_TAGS.has(child.tagName.toLowerCase())) {
					return serializeSsmlElement(child);
				}
				return escapeXmlText(child.textContent ?? "");
			}
			return "";
		})
		.join("");
}

function escapeXmlText(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function escapeXmlAttr(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * SSMLExtractor Service
 *
 * Extracts embedded SSML from PIE content and generates accessibility catalogs.
 */
export class SSMLExtractor {
	private catalogCounter = 0;

	/**
	 * Extract SSML from entire item config (markup + models)
	 *
	 * @param config Item configuration with potential embedded SSML
	 * @returns Extracted catalogs and cleaned config
	 */
	extractFromItemConfig(config: ConfigEntity): ExtractionResult {
		const allCatalogs: AccessibilityCatalog[] = [];

		// Shallow clone of config + a fresh models array. The per-model/choice
		// objects are replaced (not mutated in place) by the `.map` below, so the
		// caller's original config and its models are never mutated.
		const cleanedConfig: ConfigEntity = {
			...config,
			models: config.models ? [...config.models] : [],
		};

		// 1. Extract from top-level markup (passages)
		if (config.markup) {
			const markupResult = this.extractFromMarkup(config.markup, "markup");
			allCatalogs.push(...markupResult.catalogs);
			cleanedConfig.markup = markupResult.cleanedMarkup;
		}

		// 2. Extract from models (prompts, choices, etc.)
		if (config.models && config.models.length > 0) {
			cleanedConfig.models = config.models.map((model) => {
				const cleanedModel = { ...model };
				const modelCatalogs: AccessibilityCatalog[] = [];

				// Extract from prompt
				if (model.prompt && typeof model.prompt === "string") {
					const promptResult = this.extractFromMarkup(
						model.prompt,
						`prompt-${model.id}`,
					);
					modelCatalogs.push(...promptResult.catalogs);
					cleanedModel.prompt = promptResult.cleanedMarkup;
				}

				// Extract from choices
				if (model.choices && Array.isArray(model.choices)) {
					cleanedModel.choices = model.choices.map((choice) => {
						if (choice.label && typeof choice.label === "string") {
							const choiceResult = this.extractFromMarkup(
								choice.label,
								`choice-${model.id}-${choice.value}`,
							);
							modelCatalogs.push(...choiceResult.catalogs);
							return {
								...choice,
								label: choiceResult.cleanedMarkup,
							};
						}
						return choice;
					});
				}

				allCatalogs.push(...modelCatalogs);
				return cleanedModel;
			});
		}

		return {
			catalogs: allCatalogs,
			cleanedConfig,
		};
	}

	/**
	 * Extract SSML from markup string
	 *
	 * @param markup HTML markup potentially containing <speak> elements
	 * @param idPrefix Prefix for generating catalog IDs
	 * @returns Extracted catalogs and cleaned markup
	 */
	private extractFromMarkup(
		markup: string,
		idPrefix: string,
	): MarkupExtractionResult {
		if (!markup || markup.trim() === "") {
			return { catalogs: [], cleanedMarkup: markup };
		}

		// Check if running in browser environment
		if (typeof window === "undefined" || typeof DOMParser === "undefined") {
			console.warn(
				"[SSMLExtractor] DOMParser not available (SSR?), skipping extraction",
			);
			return { catalogs: [], cleanedMarkup: markup };
		}

		const catalogs: AccessibilityCatalog[] = [];

		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(
				expandSelfClosingVoidTags(markup),
				"text/html",
			);

			// Find all <speak> elements
			const speakElements = Array.from(doc.querySelectorAll("speak"));

			if (speakElements.length === 0) {
				// No SSML found, return original markup
				return { catalogs: [], cleanedMarkup: markup };
			}

			// Process each <speak> element
			for (const speakEl of speakElements) {
				try {
					// Generate unique catalog ID
					const catalogId = this.generateCatalogId(idPrefix);

					// Sanitize before serializing so the SSML forwarded to the TTS
					// provider only contains spec-allowed tags/attributes. This
					// closes an author-content -> TTS-server pipeline that would
					// otherwise accept arbitrary HTML.
					sanitizeSsmlElement(speakEl);
					const ssmlContent = serializeSsmlElement(speakEl);

					// Extract language (check both xml:lang and lang attributes)
					const language =
						speakEl.getAttribute("xml:lang") ||
						speakEl.getAttribute("lang") ||
						"en-US";

					// Get plain text for visual display
					const plainText = speakEl.textContent || "";

					// Find parent element or create wrapper
					let wrapper = speakEl.parentElement;

					if (!wrapper || wrapper.tagName === "BODY") {
						// SPEAK is at root level - create span wrapper
						const span = doc.createElement("span");
						speakEl.parentNode?.insertBefore(span, speakEl);
						span.appendChild(doc.createTextNode(plainText));
						wrapper = span;
						speakEl.remove();
					} else {
						// Just remove <speak> - visual content should be in sibling element
						speakEl.remove();
					}

					// Tag the wrapper with the QTI-style catalog reference so the
					// runtime can resolve this region's spoken content. Same attribute
					// authored content uses (`data-catalog-idref`) — one canonical name.
					if (wrapper) {
						wrapper.setAttribute("data-catalog-idref", catalogId);
					}

					// Create catalog entry
					catalogs.push({
						identifier: catalogId,
						cards: [
							{
								catalog: "spoken",
								language,
								content: ssmlContent,
							},
						],
					});
				} catch (error) {
					console.error(
						"[SSMLExtractor] Error processing <speak> element:",
						error,
					);
					// Continue with other elements
				}
			}

			// Return cleaned markup
			const cleanedMarkup = doc.body.innerHTML;

			return { catalogs, cleanedMarkup };
		} catch (error) {
			console.error("[SSMLExtractor] Error parsing markup:", error);
			// Return original markup if parsing fails
			return { catalogs: [], cleanedMarkup: markup };
		}
	}

	/**
	 * Generate unique catalog ID
	 *
	 * @param prefix Context prefix (e.g., 'prompt-q1', 'choice-q1-a')
	 * @returns Unique catalog ID (e.g., 'auto-prompt-q1-0')
	 */
	private generateCatalogId(prefix: string): string {
		const id = `auto-${prefix}-${this.catalogCounter}`;
		this.catalogCounter++;
		return id;
	}

	/**
	 * Reset counter (useful for testing or new extraction contexts)
	 */
	reset(): void {
		this.catalogCounter = 0;
	}
}
