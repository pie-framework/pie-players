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
 * 4. Cleans visual markup (removes SSML, adds data-catalog-id)
 *
 * This enables proper pronunciation, emphasis, and pacing for TTS without
 * requiring authors to maintain separate catalog files.
 *
 * Part of PIE Assessment Toolkit.
 */

import type { AccessibilityCatalog, ConfigEntity, PieModel } from "@pie-players/pie-players-shared/types";

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

		// Deep clone config to avoid mutating original
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
			console.warn("[SSMLExtractor] DOMParser not available (SSR?), skipping extraction");
			return { catalogs: [], cleanedMarkup: markup };
		}

		const catalogs: AccessibilityCatalog[] = [];

		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(markup, "text/html");

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

					// Extract SSML content
					const ssmlContent = speakEl.outerHTML;

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

					// Add catalog ID to wrapper element
					if (wrapper) {
						wrapper.setAttribute("data-catalog-id", catalogId);
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
					console.error("[SSMLExtractor] Error processing <speak> element:", error);
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
