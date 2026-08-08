/**
 * SignLanguageExtractor
 *
 * Service for extracting inline signing video from PIE item content and
 * converting it into QTI 3.0 accessibility catalogs.
 *
 * This is the signing counterpart of `SSMLExtractor`, and exists for the same
 * reason: authored content carries the accessibility material inline, and the
 * runtime needs it as catalog cards. Authors (or an importer) mark a signing
 * video with `data-sign-language`; the extractor
 *
 * 1. parses markup and finds all `[data-sign-language]` regions,
 * 2. extracts the video sources, poster, and optional time range,
 * 3. generates accessibility catalogs with unique IDs,
 * 4. cleans visual markup (removes the video, adds `data-catalog-idref`).
 *
 * Step 4 is the substantive difference from Learnosity, where a signing video
 * is ordinary item content that renders unconditionally with nothing to gate.
 * In PIE the video becomes catalog data, and the toolkit plus policy decide
 * whether a given learner sees it — so removing it from the visible content is
 * the point, not a side effect.
 *
 * Part of PIE Assessment Toolkit.
 */

import type {
	AccessibilityCatalog,
	CatalogCard,
	ConfigEntity,
	MediaSource,
	SignLanguageCardPayload,
} from "@pie-players/pie-players-shared/types";
import {
	AMERICAN_SIGN_LANGUAGE,
	SIGN_LANGUAGE_CATALOG_TYPE,
} from "./sign-language-cards.js";

/**
 * Attribute marking a region as a signed alternate. Its value is the ISO 639-3
 * sign language code (`ase` for ASL); an empty value defaults to ASL.
 *
 * Author-owned content attribute, not a component DOM hook, which is why it is
 * unprefixed and matches the `data-catalog-idref` family it docks alongside.
 */
export const SIGN_LANGUAGE_ATTRIBUTE = "data-sign-language";
const SIGN_LANGUAGE_START_ATTRIBUTE = "data-sign-language-start";
const SIGN_LANGUAGE_END_ATTRIBUTE = "data-sign-language-end";

interface MarkupExtractionResult {
	catalogs: AccessibilityCatalog[];
	cleanedMarkup: string;
}

export interface SignLanguageExtractionResult {
	catalogs: AccessibilityCatalog[];
	cleanedConfig: ConfigEntity;
}

function parseSeconds(raw: string | null): number | undefined {
	if (raw === null) return undefined;
	const value = Number(raw.trim());
	return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function collectSources(video: Element): MediaSource[] {
	const sources: MediaSource[] = [];
	const seen = new Set<string>();
	const push = (src: string | null, type: string | null) => {
		const trimmed = (src || "").trim();
		if (!trimmed || seen.has(trimmed)) return;
		seen.add(trimmed);
		const source: MediaSource = { src: trimmed };
		const trimmedType = (type || "").trim();
		if (trimmedType) source.type = trimmedType;
		sources.push(source);
	};
	// A `src` on the element itself takes precedence in HTML, so list it first.
	push(video.getAttribute("src"), video.getAttribute("type"));
	for (const source of Array.from(video.querySelectorAll("source"))) {
		push(source.getAttribute("src"), source.getAttribute("type"));
	}
	return sources;
}

/**
 * SignLanguageExtractor Service
 *
 * Extracts inline signing video from PIE content and generates accessibility
 * catalogs.
 */
export class SignLanguageExtractor {
	private catalogCounter = 0;

	/**
	 * Extract signing video from an entire item config (markup + models).
	 *
	 * @param config Item configuration with potential inline signing video
	 * @returns Extracted catalogs and cleaned config
	 */
	extractFromItemConfig(config: ConfigEntity): SignLanguageExtractionResult {
		const allCatalogs: AccessibilityCatalog[] = [];

		// Shallow clone of config + a fresh models array. The per-model/choice
		// objects are replaced (not mutated in place) below, so the caller's
		// original config and its models are never mutated.
		const cleanedConfig: ConfigEntity = {
			...config,
			models: config.models ? [...config.models] : [],
		};

		if (config.markup) {
			const markupResult = this.extractFromMarkup(config.markup, "markup");
			allCatalogs.push(...markupResult.catalogs);
			cleanedConfig.markup = markupResult.cleanedMarkup;
		}

		if (config.models && config.models.length > 0) {
			cleanedConfig.models = config.models.map((model) => {
				const cleanedModel = { ...model };

				if (model.prompt && typeof model.prompt === "string") {
					const promptResult = this.extractFromMarkup(
						model.prompt,
						`prompt-${model.id}`,
					);
					allCatalogs.push(...promptResult.catalogs);
					cleanedModel.prompt = promptResult.cleanedMarkup;
				}

				if (model.choices && Array.isArray(model.choices)) {
					cleanedModel.choices = model.choices.map((choice) => {
						if (choice.label && typeof choice.label === "string") {
							const choiceResult = this.extractFromMarkup(
								choice.label,
								`choice-${model.id}-${choice.value}`,
							);
							allCatalogs.push(...choiceResult.catalogs);
							return { ...choice, label: choiceResult.cleanedMarkup };
						}
						return choice;
					});
				}

				return cleanedModel;
			});
		}

		return { catalogs: allCatalogs, cleanedConfig };
	}

	/**
	 * Extract signing video from a markup string.
	 *
	 * @param markup HTML markup potentially containing `[data-sign-language]`
	 * @param idPrefix Prefix for generating catalog IDs
	 */
	private extractFromMarkup(
		markup: string,
		idPrefix: string,
	): MarkupExtractionResult {
		if (!markup || markup.trim() === "") {
			return { catalogs: [], cleanedMarkup: markup };
		}
		// Cheap pre-check so the overwhelming majority of items — which carry no
		// signing video — never pay for a DOM parse.
		if (!markup.includes(SIGN_LANGUAGE_ATTRIBUTE)) {
			return { catalogs: [], cleanedMarkup: markup };
		}

		if (typeof window === "undefined" || typeof DOMParser === "undefined") {
			console.warn(
				"[SignLanguageExtractor] DOMParser not available (SSR?), skipping extraction",
			);
			return { catalogs: [], cleanedMarkup: markup };
		}

		const catalogs: AccessibilityCatalog[] = [];

		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(markup, "text/html");
			const marked = Array.from(
				doc.querySelectorAll(`[${SIGN_LANGUAGE_ATTRIBUTE}]`),
			);
			if (marked.length === 0) {
				return { catalogs: [], cleanedMarkup: markup };
			}

			for (const markedElement of marked) {
				try {
					const catalog = this.extractOne(markedElement, idPrefix);
					if (catalog) catalogs.push(catalog);
				} catch (error) {
					console.error(
						"[SignLanguageExtractor] Error processing signing region:",
						error,
					);
					// Continue with other regions.
				}
			}

			return { catalogs, cleanedMarkup: doc.body.innerHTML };
		} catch (error) {
			console.error("[SignLanguageExtractor] Error parsing markup:", error);
			return { catalogs: [], cleanedMarkup: markup };
		}
	}

	private extractOne(
		markedElement: Element,
		idPrefix: string,
	): AccessibilityCatalog | null {
		const video =
			markedElement.tagName.toLowerCase() === "video"
				? markedElement
				: markedElement.querySelector("video");
		if (!video) {
			// Marked but carries no video: leave the content alone rather than
			// silently deleting authored markup on the strength of one attribute.
			console.warn(
				`[SignLanguageExtractor] "${SIGN_LANGUAGE_ATTRIBUTE}" region has no <video>; skipping`,
			);
			return null;
		}

		const sources = collectSources(video);
		if (sources.length === 0) {
			console.warn(
				`[SignLanguageExtractor] "${SIGN_LANGUAGE_ATTRIBUTE}" video has no usable source; skipping`,
			);
			return null;
		}

		const signLang =
			(markedElement.getAttribute(SIGN_LANGUAGE_ATTRIBUTE) || "").trim() ||
			AMERICAN_SIGN_LANGUAGE;
		const poster = (video.getAttribute("poster") || "").trim();
		const label = (
			markedElement.getAttribute("aria-label") ||
			video.getAttribute("aria-label") ||
			""
		).trim();
		const startSeconds = parseSeconds(
			markedElement.getAttribute(SIGN_LANGUAGE_START_ATTRIBUTE),
		);
		const endSeconds = parseSeconds(
			markedElement.getAttribute(SIGN_LANGUAGE_END_ATTRIBUTE),
		);

		const catalogId = this.generateCatalogId(idPrefix);
		const payload: SignLanguageCardPayload = {
			signLang,
			media: {
				version: 1,
				id: catalogId,
				kind: "video",
				sources,
				...(poster ? { poster } : {}),
				...(label ? { label } : {}),
				lang: signLang,
			},
			...(startSeconds !== undefined
				? { fragment: { startSeconds, ...(endSeconds ? { endSeconds } : {}) } }
				: {}),
		};

		// No `content`: the payload is the content. Mirroring the primary source
		// into a string would put the same URL in two places, with nothing to keep
		// them in step.
		const card: CatalogCard = {
			catalog: SIGN_LANGUAGE_CATALOG_TYPE,
			language: signLang,
			payload,
		};

		this.dockCatalog(markedElement, video, catalogId);

		return { identifier: catalogId, cards: [card] };
	}

	/**
	 * Remove the signing video from visible content and tag the content it
	 * translates with `data-catalog-idref`.
	 *
	 * When the marked element *is* the video, the surviving parent becomes the
	 * docking node — that is the content the signing translates. When the mark
	 * is on a wrapper, the wrapper survives as the docking node and only the
	 * video is removed.
	 *
	 * An existing `data-catalog-idref` is never overwritten: the attribute is one
	 * canonical name with two readers, and clobbering it would break TTS
	 * resolution for that node. The synthesized catalog is still emitted and
	 * still resolves — the region finds signing cards through the item's catalog
	 * set, not by walking the DOM — so only future per-node docking for that one
	 * node is affected, and per-choice docking needs element-repo support anyway.
	 * `SSMLExtractor` follows the same rule; both are named in
	 * `docs/accessibility/accessibility-catalogs-tts-integration.md`.
	 */
	private dockCatalog(
		markedElement: Element,
		video: Element,
		catalogId: string,
	): void {
		const markedIsVideo = markedElement === video;
		let dockingNode: Element | null = markedIsVideo
			? markedElement.parentElement
			: markedElement;

		if (markedIsVideo) {
			// A video at root level has no content node around it to be an
			// alternate for, so nothing is synthesized to stand in for one. The card
			// is still emitted and the region still resolves it through the item's
			// catalog set; only per-node docking is unavailable, and there is no node
			// to dock to.
			if (dockingNode?.tagName === "BODY") dockingNode = null;
			markedElement.remove();
		} else {
			markedElement.removeAttribute(SIGN_LANGUAGE_ATTRIBUTE);
			markedElement.removeAttribute(SIGN_LANGUAGE_START_ATTRIBUTE);
			markedElement.removeAttribute(SIGN_LANGUAGE_END_ATTRIBUTE);
			video.remove();
		}

		if (dockingNode && !dockingNode.hasAttribute("data-catalog-idref")) {
			dockingNode.setAttribute("data-catalog-idref", catalogId);
		}
	}

	/**
	 * Generate a unique catalog ID.
	 *
	 * @param prefix Context prefix (e.g. 'prompt-q1')
	 * @returns Unique catalog ID (e.g. 'auto-sign-prompt-q1-0')
	 */
	private generateCatalogId(prefix: string): string {
		const id = `auto-sign-${prefix}-${this.catalogCounter}`;
		this.catalogCounter++;
		return id;
	}

	/** Reset the counter (useful for testing or new extraction contexts). */
	reset(): void {
		this.catalogCounter = 0;
	}
}
