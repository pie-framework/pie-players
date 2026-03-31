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

import type { HighlightCoordinatorApi } from "./interfaces.js";
import { RangeSerializer, type SerializedRange } from "./RangeSerializer.js";

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

export class HighlightCoordinator implements HighlightCoordinatorApi {
	private config: HighlightCoordinatorConfig;
	private ttsWordHighlight: Highlight | null = null;
	private ttsSentenceHighlight: Highlight | null = null;
	private annotations = new Map<string, Annotation>();
	// Shared highlights per color (one Highlight object per color, contains all ranges)
	private colorHighlights = new Map<HighlightColor, Highlight>();
	private nextAnnotationId = 1;
	private supported = false;
	private rangeSerializer: RangeSerializer;
	private themeObserver: MutationObserver | null = null;
	private explicitTTSColorOverride: { color: string; opacity: number } | null = null;

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
		this.applyAdaptiveTTSStyle();
		this.setupThemeObservation();
	}

	private setupThemeObservation(): void {
		if (typeof document === "undefined") return;
		if (typeof MutationObserver === "undefined") return;

		const refresh = () => this.applyAdaptiveTTSStyle();
		this.themeObserver = new MutationObserver(refresh);

		this.themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["style", "data-theme", "data-color-scheme", "class"],
		});

		for (const host of document.querySelectorAll("pie-theme")) {
			this.themeObserver.observe(host, {
				attributes: true,
				attributeFilter: [
					"theme",
					"scheme",
					"provider",
					"variables",
					"style",
					"data-theme",
					"data-color-scheme",
				],
			});
		}
	}

	private parseColor(input: string | null | undefined): [number, number, number] | null {
		if (!input) return null;
		const value = input.trim();
		if (!value) return null;

		const hexMatch = /^#([a-f\d]{3}|[a-f\d]{6})$/i.exec(value);
		if (hexMatch) {
			const hex = hexMatch[1];
			if (hex.length === 3) {
				return [
					parseInt(hex[0] + hex[0], 16),
					parseInt(hex[1] + hex[1], 16),
					parseInt(hex[2] + hex[2], 16),
				];
			}
			return [
				parseInt(hex.slice(0, 2), 16),
				parseInt(hex.slice(2, 4), 16),
				parseInt(hex.slice(4, 6), 16),
			];
		}

		const rgbMatch = /^rgba?\((.+)\)$/i.exec(value);
		if (rgbMatch) {
			const normalized = rgbMatch[1].replace(/\//g, ",");
			const parts = normalized
				.split(/[,\s]+/)
				.map((part) => part.trim())
				.filter(Boolean);
			const r = Number(parts[0]);
			const g = Number(parts[1]);
			const b = Number(parts[2]);
			if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
				return [r, g, b];
			}
		}

		// Browser parser fallback (covers formats like oklch()).
		if (typeof document !== "undefined") {
			const parserEl = document.createElement("span");
			parserEl.style.color = value;
			if (typeof parserEl.style.color === "string" && parserEl.style.color) {
				document.body?.appendChild(parserEl);
				const resolved =
					typeof getComputedStyle === "function"
						? getComputedStyle(parserEl).color
						: "";
				parserEl.remove();
				const normalizedResolved = resolved.trim();
				// Guard against recursive loops when computed style returns the same
				// unresolved function syntax (observed with certain color formats).
				if (normalizedResolved && normalizedResolved !== value) {
					return this.parseColor(resolved);
				}
			}
		}

		return null;
	}

	private relativeLuminance([r, g, b]: [number, number, number]): number {
		const toLinear = (channel: number) => {
			const n = channel / 255;
			return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
		};
		const lr = toLinear(r);
		const lg = toLinear(g);
		const lb = toLinear(b);
		return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
	}

	private contrastRatio(
		a: [number, number, number],
		b: [number, number, number],
	): number {
		const la = this.relativeLuminance(a);
		const lb = this.relativeLuminance(b);
		const lighter = Math.max(la, lb);
		const darker = Math.min(la, lb);
		return (lighter + 0.05) / (darker + 0.05);
	}

	private blend(
		fg: [number, number, number],
		bg: [number, number, number],
		alpha: number,
	): [number, number, number] {
		return [
			Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
			Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
			Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
		];
	}

	private resolveAdaptiveTTSStyle(sourceEl?: Element | null): {
		wordHighlight: string;
		sentenceHighlight: string;
		wordUnderline: string;
		wordShadow: string;
	} {
		const fallbackMissing: [number, number, number] = [255, 235, 59];
		const fallbackText: [number, number, number] = [17, 24, 39];
		const fallbackBackground: [number, number, number] = [255, 255, 255];

		const target =
			sourceEl ||
			(typeof document !== "undefined" ? document.documentElement : null);
		const computed =
			target && typeof getComputedStyle === "function"
				? getComputedStyle(target)
				: null;

		const background =
			this.parseColor(
				computed?.getPropertyValue("--pie-background") || computed?.backgroundColor,
			) || fallbackBackground;
		const text =
			this.parseColor(computed?.getPropertyValue("--pie-text")) || fallbackText;
		const accent = this.explicitTTSColorOverride
			? this.parseColor(this.explicitTTSColorOverride.color) || fallbackMissing
			: this.parseColor(computed?.getPropertyValue("--pie-missing")) ||
				fallbackMissing;

		const opacityCandidates = this.explicitTTSColorOverride
			? [Math.max(0.3, Math.min(0.95, this.explicitTTSColorOverride.opacity))]
			: [0.8, 0.72, 0.68, 0.62, 0.56, 0.5];

		let selectedOpacity = opacityCandidates[opacityCandidates.length - 1];
		let bestScore = -Infinity;

		for (const opacity of opacityCandidates) {
			const blended = this.blend(accent, background, opacity);
			const backgroundDelta = this.contrastRatio(blended, background);
			const textContrast = this.contrastRatio(blended, text);
			const score = backgroundDelta * 1.2 + textContrast * 0.8;
			if (backgroundDelta >= 1.25 && textContrast >= 2.4) {
				selectedOpacity = opacity;
				break;
			}
			if (score > bestScore) {
				bestScore = score;
				selectedOpacity = opacity;
			}
		}

		const sentenceOpacity = Math.max(0.24, Math.min(0.85, selectedOpacity * 0.55));
		const underlineOpacity = Math.max(0.55, Math.min(0.95, selectedOpacity + 0.2));
		const shadowOpacity = Math.max(0.22, Math.min(0.6, selectedOpacity * 0.45));

		const underlineColor = text;
		const underlineBlend = this.blend(underlineColor, background, underlineOpacity);
		const underlineDelta = this.contrastRatio(underlineBlend, background);
		const fallbackUnderline: [number, number, number] =
			this.relativeLuminance(background) > 0.45 ? [0, 0, 0] : [255, 255, 255];
		const finalUnderline = underlineDelta >= 1.35 ? underlineColor : fallbackUnderline;

		const wordHighlight = `rgba(${accent[0]}, ${accent[1]}, ${accent[2]}, ${selectedOpacity})`;
		const sentenceHighlight = `rgba(${accent[0]}, ${accent[1]}, ${accent[2]}, ${sentenceOpacity})`;
		const wordUnderline = `rgba(${finalUnderline[0]}, ${finalUnderline[1]}, ${finalUnderline[2]}, ${underlineOpacity})`;
		const wordShadow = `rgba(${finalUnderline[0]}, ${finalUnderline[1]}, ${finalUnderline[2]}, ${shadowOpacity})`;

		return {
			wordHighlight,
			sentenceHighlight,
			wordUnderline,
			wordShadow,
		};
	}

	private applyAdaptiveTTSStyle(sourceEl?: Element | null): void {
		if (typeof document === "undefined") return;
		const vars = this.resolveAdaptiveTTSStyle(sourceEl);
		document.documentElement.style.setProperty(
			"--pie-tts-word-highlight",
			vars.wordHighlight,
		);
		document.documentElement.style.setProperty(
			"--pie-tts-sentence-highlight",
			vars.sentenceHighlight,
		);
		document.documentElement.style.setProperty(
			"--pie-tts-line-highlight",
			vars.sentenceHighlight,
		);
		document.documentElement.style.setProperty(
			"--pie-tts-word-underline",
			vars.wordUnderline,
		);
		document.documentElement.style.setProperty(
			"--pie-tts-word-shadow",
			vars.wordShadow,
		);
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
        background-color: var(--pie-tts-word-highlight, color-mix(in srgb, var(--pie-missing, #ffeb3b) 68%, transparent));
        text-decoration: underline 2px solid var(--pie-tts-word-underline, color-mix(in srgb, var(--pie-text, #111827) 70%, transparent));
        text-underline-offset: 2px;
        text-shadow: 0 0 1px var(--pie-tts-word-shadow, color-mix(in srgb, var(--pie-text, #111827) 35%, transparent));
        color: inherit;
      }

      /* tts-sentence registry id: coarse read-along band (visual line boxes in layout) */
      ::highlight(tts-sentence) {
        background-color: var(--pie-tts-line-highlight, var(--pie-tts-sentence-highlight, color-mix(in srgb, var(--pie-missing, #ffeb3b) 38%, transparent)));
        color: inherit;
      }

      /* Annotation highlights - persistent */
      ::highlight(annotation-yellow) {
        background-color: color-mix(in srgb, var(--pie-missing, #ffff00) 35%, transparent);
        color: inherit;
      }

      ::highlight(annotation-green) {
        background-color: color-mix(in srgb, var(--pie-correct, #90ee90) 35%, transparent);
        color: inherit;
      }

      ::highlight(annotation-blue) {
        background-color: color-mix(in srgb, var(--pie-tertiary, #add8e6) 35%, transparent);
        color: inherit;
      }

      ::highlight(annotation-pink) {
        background-color: color-mix(in srgb, var(--pie-secondary-light, #ffb6c1) 35%, transparent);
        color: inherit;
      }

      ::highlight(annotation-orange) {
        background-color: color-mix(in srgb, var(--pie-incorrect, #ffa500) 35%, transparent);
        color: inherit;
      }

      ::highlight(annotation-underline) {
        background-color: transparent;
        text-decoration: underline 2px solid var(--pie-primary, #0066cc);
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
		this.applyAdaptiveTTSStyle(textNode.parentElement);

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
	 * Highlight the coarse TTS read-along band (temporary).
	 * Usually one Range per visual line; CSS layer `tts-sentence` for compatibility.
	 *
	 * @param ranges Line (or sentence) ranges to paint with `--pie-tts-line-highlight`
	 */
	highlightTTSSentence(ranges: Range[]): void {
		if (!this.ttsSentenceHighlight) return;
		const source = ranges[0]?.startContainer;
		const sourceElement =
			source?.nodeType === Node.ELEMENT_NODE
				? (source as Element)
				: source?.parentElement;
		this.applyAdaptiveTTSStyle(sourceElement);

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

		console.log(
			`[HighlightCoordinator] Removing annotation ${id} (color: ${annotation.color})`,
		);

		// Remove range from the shared color highlight
		const colorHighlight = this.colorHighlights.get(annotation.color);
		if (colorHighlight) {
			const deleted = colorHighlight.delete(annotation.range);
			console.log(
				`[HighlightCoordinator] Highlight.delete() returned:`,
				deleted,
			);
		}

		// Clean up
		this.annotations.delete(id);
		console.log(
			`[HighlightCoordinator] Annotation ${id} removed from map. Remaining:`,
			this.annotations.size,
		);
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
	): Array<
		SerializedRange & { id: string; color: HighlightColor; timestamp: number }
	> {
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
		data: Array<
			SerializedRange & {
				id?: string;
				color: HighlightColor;
				timestamp?: number;
			}
		>,
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
	// HighlightCoordinatorApi interface implementation
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

		this.explicitTTSColorOverride = {
			color: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
			opacity: Math.max(0.2, Math.min(0.95, opacity)),
		};
		this.applyAdaptiveTTSStyle();
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
		this.themeObserver?.disconnect();
		this.themeObserver = null;
	}
}
