/**
 * HighlightCoordinator
 *
 * Manages separate highlight layers for TTS (temporary) and annotations (persistent).
 * Uses CSS Custom Highlight API - zero DOM mutation, preserves accessibility.
 *
 * Features:
 * - Separate layers prevent TTS clearing from removing student annotations
 * - CSS Custom Highlight API (no DOM mutation)
 * - Full accessibility support (screen readers see original text)
 * - Configurable colors and styles
 * - Annotation persistence via RangeSerializer
 *
 * Part of PIE Assessment Toolkit.
 *
 * Browser Support:
 * - Chrome/Edge 105+
 * - Safari 17.2+
 * - Firefox: Behind flag (not recommended for production)
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API
 */

import type { IHighlightCoordinator } from "./interfaces";
import { RangeSerializer, type SerializedRange } from "./RangeSerializer";

/**
 * Highlight types
 */
export enum HighlightType {
	TTS_WORD = "tts-word",
	TTS_SENTENCE = "tts-sentence",
	ANNOTATION = "annotation",
}

/**
 * Highlight colors for annotations
 */
export enum HighlightColor {
	YELLOW = "yellow",
	GREEN = "green",
	BLUE = "blue",
	PINK = "pink",
	ORANGE = "orange",
	UNDERLINE = "underline",
}

/**
 * Annotation data
 */
export interface Annotation {
	id: string;
	range: Range;
	type: HighlightType.ANNOTATION;
	color: HighlightColor;
	timestamp: number;
}

/**
 * Configuration for HighlightCoordinator
 * Currently empty but allows future extension without breaking changes
 */
export type HighlightCoordinatorConfig = Record<string, never>;

export class HighlightCoordinator implements IHighlightCoordinator {
	private config: HighlightCoordinatorConfig;
	private ttsWordHighlight: Highlight | null = null;
	private ttsSentenceHighlight: Highlight | null = null;
	private annotations = new Map<string, Annotation>();
	// Shared highlights per color (one Highlight object per color, contains all ranges)
	private colorHighlights = new Map<HighlightColor, Highlight>();
	private nextAnnotationId = 1;
	private supported = false;
	private rangeSerializer: RangeSerializer;

	constructor(config: HighlightCoordinatorConfig = {}) {
		this.config = config;
		this.rangeSerializer = new RangeSerializer();

		// SSR guard
		if (typeof CSS === "undefined" || !("highlights" in CSS)) {
			console.warn(
				"CSS Custom Highlight API not supported (SSR or unsupported browser)",
			);
			return;
		}

		this.supported = true;
		this.initializeHighlights();
		this.registerStyles();
	}

	/**
	 * Initialize CSS Custom Highlights
	 */
	private initializeHighlights(): void {
		if (!this.supported) return;

		// Create highlight registries for TTS
		this.ttsWordHighlight = new Highlight();
		this.ttsSentenceHighlight = new Highlight();

		// Register TTS highlights with CSS
		CSS.highlights.set("tts-word", this.ttsWordHighlight);
		CSS.highlights.set("tts-sentence", this.ttsSentenceHighlight);

		// Create shared highlights for each annotation color
		for (const color of Object.values(HighlightColor)) {
			const highlight = new Highlight();
			this.colorHighlights.set(color, highlight);
			CSS.highlights.set(`annotation-${color}`, highlight);
		}
	}

	/**
	 * Register CSS styles for highlights
	 */
	private registerStyles(): void {
		if (!this.supported) return;
		if (typeof document === "undefined") return; // SSR guard

		// Check if styles already exist
		if (document.getElementById("pie-highlight-styles")) return;

		const style = document.createElement("style");
		style.id = "pie-highlight-styles";
		style.textContent = `
      /* TTS highlights - temporary */
      ::highlight(tts-word) {
        background-color: rgba(255, 235, 59, 0.4);
        color: inherit;
      }

      ::highlight(tts-sentence) {
        background-color: rgba(173, 216, 230, 0.3);
        color: inherit;
      }

      /* Annotation highlights - persistent */
      ::highlight(annotation-yellow) {
        background-color: rgba(255, 255, 0, 0.3);
        color: inherit;
      }

      ::highlight(annotation-green) {
        background-color: rgba(144, 238, 144, 0.3);
        color: inherit;
      }

      ::highlight(annotation-blue) {
        background-color: rgba(173, 216, 230, 0.3);
        color: inherit;
      }

      ::highlight(annotation-pink) {
        background-color: rgba(255, 182, 193, 0.3);
        color: inherit;
      }

      ::highlight(annotation-orange) {
        background-color: rgba(255, 165, 0, 0.3);
        color: inherit;
      }

      ::highlight(annotation-underline) {
        background-color: transparent;
        text-decoration: underline 2px solid #0066cc;
        text-underline-offset: 2px;
        color: inherit;
      }
    `;
		document.head.appendChild(style);
	}

	/**
	 * Highlight a word for TTS (temporary)
	 *
	 * @param textNode Text node containing the word
	 * @param startOffset Start position in text node
	 * @param endOffset End position in text node
	 */
	highlightTTSWord(
		textNode: Text,
		startOffset: number,
		endOffset: number,
	): void {
		if (!this.ttsWordHighlight) return;

		// Clear previous word highlight
		this.clearTTSWord();

		// Create range for word
		const range = document.createRange();
		range.setStart(textNode, startOffset);
		range.setEnd(textNode, endOffset);

		// Add to highlight
		this.ttsWordHighlight.add(range);
	}

	/**
	 * Highlight a sentence for TTS (temporary)
	 *
	 * @param ranges Array of ranges that make up the sentence
	 */
	highlightTTSSentence(ranges: Range[]): void {
		if (!this.ttsSentenceHighlight) return;

		// Clear previous sentence highlight
		this.clearTTSSentence();

		// Add all ranges
		for (const range of ranges) {
			this.ttsSentenceHighlight.add(range);
		}
	}

	/**
	 * Clear TTS word highlight
	 */
	clearTTSWord(): void {
		if (!this.ttsWordHighlight) return;
		this.ttsWordHighlight.clear();
	}

	/**
	 * Clear TTS sentence highlight
	 */
	clearTTSSentence(): void {
		if (!this.ttsSentenceHighlight) return;
		this.ttsSentenceHighlight.clear();
	}

	/**
	 * Clear all TTS highlights
	 */
	clearTTS(): void {
		this.clearTTSWord();
		this.clearTTSSentence();
	}

	/**
	 * Add an annotation highlight (persistent)
	 *
	 * @param range Text range to annotate
	 * @param color Highlight color
	 * @returns Annotation ID for later removal
	 */
	addAnnotation(
		range: Range,
		color: HighlightColor = HighlightColor.YELLOW,
	): string {
		const id = `annotation-${this.nextAnnotationId++}`;

		// Clone the range to store
		const clonedRange = range.cloneRange();

		// Store annotation data
		const annotation: Annotation = {
			id,
			range: clonedRange,
			type: HighlightType.ANNOTATION,
			color,
			timestamp: Date.now(),
		};
		this.annotations.set(id, annotation);

		// Add the SAME range object to the shared color highlight
		// This ensures we can later delete it by reference
		const colorHighlight = this.colorHighlights.get(color);
		if (colorHighlight) {
			colorHighlight.add(clonedRange);
		}

		return id;
	}

	/**
	 * Remove an annotation
	 *
	 * @param id Annotation ID
	 */
	removeAnnotation(id: string): void {
		const annotation = this.annotations.get(id);
		if (!annotation) {
			console.warn(`[HighlightCoordinator] Annotation ${id} not found`);
			return;
		}

		console.log(`[HighlightCoordinator] Removing annotation ${id} (color: ${annotation.color})`);

		// Remove range from the shared color highlight
		const colorHighlight = this.colorHighlights.get(annotation.color);
		if (colorHighlight) {
			const deleted = colorHighlight.delete(annotation.range);
			console.log(`[HighlightCoordinator] Highlight.delete() returned:`, deleted);
		}

		// Clean up
		this.annotations.delete(id);
		console.log(`[HighlightCoordinator] Annotation ${id} removed from map. Remaining:`, this.annotations.size);
	}

	/**
	 * Remove all annotations
	 */
	clearAnnotations(): void {
		// Clear all color highlights
		for (const colorHighlight of this.colorHighlights.values()) {
			colorHighlight.clear();
		}

		// Clear annotation data
		this.annotations.clear();
	}

	/**
	 * Get all annotations
	 */
	getAnnotations(): Annotation[] {
		return Array.from(this.annotations.values());
	}

	/**
	 * Get annotation by ID
	 */
	getAnnotation(id: string): Annotation | null {
		return this.annotations.get(id) ?? null;
	}

	/**
	 * Change annotation color
	 *
	 * @param id Annotation ID
	 * @param newColor New color
	 */
	changeAnnotationColor(id: string, newColor: HighlightColor): void {
		const annotation = this.annotations.get(id);
		if (!annotation) return;

		const oldColor = annotation.color;
		if (oldColor === newColor) return;

		// Remove from old color highlight
		const oldColorHighlight = this.colorHighlights.get(oldColor);
		if (oldColorHighlight) {
			oldColorHighlight.delete(annotation.range);
		}

		// Update color
		annotation.color = newColor;

		// Add to new color highlight
		const newColorHighlight = this.colorHighlights.get(newColor);
		if (newColorHighlight) {
			newColorHighlight.add(annotation.range);
		}
	}

	/**
	 * Export annotations as serializable data for persistence.
	 * Uses RangeSerializer for robust DOM range serialization.
	 *
	 * @param root Root element for serialization (typically document.body or content container)
	 * @returns Array of serialized annotations
	 */
	exportAnnotations(
		root: Element = document.body,
	): Array<SerializedRange & { id: string; color: HighlightColor; timestamp: number }> {
		return this.getAnnotations().map((annotation) => ({
			...this.rangeSerializer.serialize(annotation.range, root),
			id: annotation.id,
			color: annotation.color,
			timestamp: annotation.timestamp,
		}));
	}

	/**
	 * Import annotations from serialized data.
	 * Restores annotations after page navigation or refresh.
	 *
	 * @param data Array of serialized annotations
	 * @param root Root element for deserialization (same as used in export)
	 * @returns Number of successfully restored annotations
	 */
	importAnnotations(
		data: Array<SerializedRange & { id?: string; color: HighlightColor; timestamp?: number }>,
		root: Element = document.body,
	): number {
		let restored = 0;

		for (const item of data) {
			const range = this.rangeSerializer.deserialize(item, root);
			if (range) {
				this.addAnnotation(range, item.color);
				restored++;
			}
		}

		return restored;
	}

	// ============================================================================
	// IHighlightCoordinator Interface Implementation
	// ============================================================================

	/**
	 * Highlight a text range (interface method)
	 *
	 * Generic method that adapts to the specific highlight type.
	 * For more control, use the specific methods like highlightTTSWord().
	 */
	highlightRange(
		range: Range,
		type: HighlightType,
		color: HighlightColor = HighlightColor.YELLOW,
	): void {
		if (!this.supported) return;

		switch (type) {
			case HighlightType.TTS_WORD:
			case HighlightType.TTS_SENTENCE: {
				// For TTS, add to appropriate highlight
				const highlight =
					type === HighlightType.TTS_WORD
						? this.ttsWordHighlight
						: this.ttsSentenceHighlight;
				if (highlight) {
					highlight.clear();
					highlight.add(range);
				}
				break;
			}
			case HighlightType.ANNOTATION:
				// For annotations, use the existing method
				this.addAnnotation(range, color);
				break;
		}
	}

	/**
	 * Clear highlights of a specific type (interface method)
	 */
	clearHighlights(type: HighlightType): void {
		if (!this.supported) return;

		switch (type) {
			case HighlightType.TTS_WORD:
				this.clearTTSWord();
				break;
			case HighlightType.TTS_SENTENCE:
				this.clearTTSSentence();
				break;
			case HighlightType.ANNOTATION:
				this.clearAnnotations();
				break;
		}
	}

	/**
	 * Clear all highlights (interface method)
	 */
	clearAll(): void {
		if (!this.supported) return;
		this.clearTTS();
		this.clearAnnotations();
	}

	/**
	 * Check if CSS Highlight API is supported (interface method)
	 */
	isSupported(): boolean {
		return this.supported;
	}

	/**
	 * Update TTS highlight style dynamically
	 *
	 * @param color CSS color value (e.g., '#ffeb3b')
	 * @param opacity Opacity value (0.0 to 1.0)
	 */
	updateTTSHighlightStyle(color: string, opacity: number): void {
		if (!this.supported) return;
		if (typeof document === "undefined") return;

		const styleEl = document.getElementById("pie-highlight-styles");
		if (!styleEl) return;

		// Convert hex to rgba
		const hexToRgb = (hex: string) => {
			const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
			return result
				? {
						r: parseInt(result[1], 16),
						g: parseInt(result[2], 16),
						b: parseInt(result[3], 16),
					}
				: null;
		};

		const rgb = hexToRgb(color);
		if (!rgb) return;

		const rgbaColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;

		// Update the style element
		styleEl.textContent = `
      /* TTS highlights - temporary */
      ::highlight(tts-word) {
        background-color: ${rgbaColor};
        color: inherit;
      }

      ::highlight(tts-sentence) {
        background-color: rgba(173, 216, 230, 0.3);
        color: inherit;
      }

      /* Annotation highlights - persistent */
      ::highlight(annotation-yellow) {
        background-color: rgba(255, 255, 0, 0.3);
        color: inherit;
      }

      ::highlight(annotation-green) {
        background-color: rgba(144, 238, 144, 0.3);
        color: inherit;
      }

      ::highlight(annotation-blue) {
        background-color: rgba(173, 216, 230, 0.3);
        color: inherit;
      }

      ::highlight(annotation-pink) {
        background-color: rgba(255, 182, 193, 0.3);
        color: inherit;
      }

      ::highlight(annotation-orange) {
        background-color: rgba(255, 165, 0, 0.3);
        color: inherit;
      }

      ::highlight(annotation-underline) {
        background-color: transparent;
        text-decoration: underline 2px solid #0066cc;
        text-underline-offset: 2px;
        color: inherit;
      }
    `;
	}

	/**
	 * Cleanup - remove all highlights
	 */
	destroy(): void {
		if (!this.supported) return;

		this.clearTTS();
		this.clearAnnotations();

		// Remove style element
		if (typeof document !== "undefined") {
			const styleEl = document.getElementById("pie-highlight-styles");
			if (styleEl) {
				styleEl.remove();
			}
		}
	}
}
