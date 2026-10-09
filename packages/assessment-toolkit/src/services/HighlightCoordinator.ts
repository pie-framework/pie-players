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
import {
	composedContains,
	composedParentElement,
	isShadowRootNode,
} from "./tts/flat-tree.js";

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
 * The highlight stylesheet: the document's copy in `<style id="pie-highlight-styles">`,
 * and each shadow root's that holds a highlighted range. `::highlight()` rules
 * paint text in the tree whose styles hold them, so text in a shadow root needs
 * its own copy; Firefox paints none of it from the document's.
 */
const HIGHLIGHT_STYLES = `
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

      [data-pie-tts-sentence-element="true"] {
        background-color: var(--pie-tts-line-highlight, var(--pie-tts-sentence-highlight, color-mix(in srgb, var(--pie-missing, #ffeb3b) 38%, transparent)));
        border-radius: 0.12em;
        box-decoration-break: clone;
        -webkit-box-decoration-break: clone;
      }

      [data-pie-tts-word-element="true"] {
        background-color: var(--pie-tts-word-highlight, color-mix(in srgb, var(--pie-missing, #ffeb3b) 68%, transparent));
        text-decoration: underline 2px solid var(--pie-tts-word-underline, color-mix(in srgb, var(--pie-text, #111827) 70%, transparent));
        text-underline-offset: 2px;
        text-shadow: 0 0 1px var(--pie-tts-word-shadow, color-mix(in srgb, var(--pie-text, #111827) 35%, transparent));
        border-bottom: 2px solid var(--pie-tts-word-underline, color-mix(in srgb, var(--pie-text, #111827) 70%, transparent));
        padding-bottom: 1px;
        border-radius: 0.12em;
        box-decoration-break: clone;
        -webkit-box-decoration-break: clone;
      }

      /* Annotation highlights - persistent */
      ::highlight(annotation-yellow) {
        background-color: var(--pie-annotation-yellow-highlight, rgba(253, 233, 149, 0.5));
        color: inherit;
      }

      ::highlight(annotation-green) {
        background-color: var(--pie-annotation-green-highlight, rgba(166, 225, 197, 0.5));
        color: inherit;
      }

      ::highlight(annotation-blue) {
        background-color: var(--pie-annotation-blue-highlight, rgba(167, 224, 246, 0.5));
        color: inherit;
      }

      ::highlight(annotation-pink) {
        background-color: var(--pie-annotation-pink-highlight, rgba(255, 159, 174, 0.5));
        color: inherit;
      }

      ::highlight(annotation-orange) {
        background-color: var(--pie-annotation-orange-highlight, rgba(255, 165, 0, 0.5));
        color: inherit;
      }

      /* The base light/dark pair is fixed: #4221d5 on light, #9c89ec on dark.
         One value cannot serve both -- #4221d5 is 2.41:1 on black and #9c89ec is
         2.85:1 on white -- so neither of those two consults the theme accent,
         which is chosen against one background and illegible on the other.

         Each state has its own token so overriding one never silently moves the
         other, and so either can beat a host-set pie-primary: a var() fallback
         can never override a value the host actually set. */
      ::highlight(annotation-underline) {
        background-color: transparent;
        text-decoration: underline 2px solid var(--pie-annotation-underline, #4221d5);
        text-underline-offset: 2px;
        color: inherit;
      }

      /* The blocks below cover annotation swatches, print, and reduced motion.
         They deliberately do NOT retune the TTS layers: applyAdaptiveTTSStyle()
         writes the pie-tts custom properties inline on documentElement on every
         paint and on theme change, so a media query that only varies a var()
         fallback for those can never take effect. Annotation colours have no such
         adaptive path -- they are fixed swatches a student chose -- so a media
         query is the only way to adjust them, and each keeps its var() so a host
         override still wins.

         The names above are spelled without their leading dashes on purpose.
         check-theme-tokens scans comments, and its token pattern stops at the
         first non-alphanumeric character, so writing the wildcard form reads as
         consumption of a shorter token that is not in the registry and fails the
         check. Spell property names in full, or omit the dashes. */

      @media (prefers-color-scheme: dark) {
        ::highlight(annotation-yellow) {
          background-color: var(--pie-annotation-yellow-highlight, rgba(139, 117, 0, 0.6));
        }
        ::highlight(annotation-green) {
          background-color: var(--pie-annotation-green-highlight, rgba(45, 92, 63, 0.6));
        }
        ::highlight(annotation-blue) {
          background-color: var(--pie-annotation-blue-highlight, rgba(0, 102, 170, 0.6));
        }
        ::highlight(annotation-pink) {
          background-color: var(--pie-annotation-pink-highlight, rgba(139, 51, 74, 0.6));
        }
        ::highlight(annotation-orange) {
          background-color: var(--pie-annotation-orange-highlight, rgba(154, 99, 0, 0.6));
        }
        ::highlight(annotation-underline) {
          text-decoration-color: var(--pie-annotation-underline-dark, #9c89ec);
        }
      }

      /* The media query above reports the OS preference, which is only a guess
         at what the page is actually showing. An app that declares a theme has
         the final say, so the rules below override it. pie-theme always stamps
         data-theme on documentElement (scope="document") or on its own host, and
         resolves to a dark palette only for the literal value "dark" -- every
         other value, including DaisyUI theme ids, maps to a light base.

         The three cases are mutually exclusive, so they never fight each other.
         All carry attribute selectors, which outrank the bare ::highlight() rules
         above -- including the one inside the media query, since a media query
         adds no specificity -- whatever the source order. */
      [data-theme="light"] ::highlight(annotation-underline) {
        text-decoration-color: var(--pie-annotation-underline, #4221d5);
      }

      [data-theme="dark"] ::highlight(annotation-underline) {
        text-decoration-color: var(--pie-annotation-underline-dark, #9c89ec);
      }

      /* A host or DaisyUI palette: follow its accent so the mark belongs to that
         theme, falling back to the light default when it declares none. */
      [data-theme]:not([data-theme="light"]):not([data-theme="dark"]) ::highlight(annotation-underline) {
        text-decoration-color: var(--pie-annotation-underline, var(--pie-primary, #4221d5));
      }

      /* WCAG 2.2 SC 1.4.11 non-text contrast: a highlight is the only indication
         that text is annotated, so the swatches saturate and the underline
         thickens when the user asks for more contrast.

         The value is "more", not "high". The stylesheet this was recovered from
         used prefers-contrast: high, which is not a valid value for the feature
         -- the keywords are no-preference, more, less, custom. An invalid query
         evaluates to "not all", so that block could never have matched in any
         browser even had the file been loaded. Verified with matchMedia under
         emulation: "high" stays false where "more" flips true. */
      @media (prefers-contrast: more) {
        ::highlight(annotation-yellow) {
          background-color: var(--pie-annotation-yellow-highlight, rgba(255, 255, 0, 0.7));
        }
        ::highlight(annotation-green) {
          background-color: var(--pie-annotation-green-highlight, rgba(0, 255, 127, 0.7));
        }
        ::highlight(annotation-blue) {
          background-color: var(--pie-annotation-blue-highlight, rgba(0, 191, 255, 0.7));
        }
        ::highlight(annotation-pink) {
          background-color: var(--pie-annotation-pink-highlight, rgba(255, 105, 180, 0.7));
        }
        ::highlight(annotation-orange) {
          background-color: var(--pie-annotation-orange-highlight, rgba(255, 165, 0, 0.85));
        }
        ::highlight(annotation-underline) {
          text-decoration-thickness: 3px;
        }
      }

      @media print {
        /* TTS highlighting is a transient read-along cue, not content. */
        ::highlight(tts-word),
        ::highlight(tts-sentence),
        [data-pie-tts-word-element="true"],
        [data-pie-tts-sentence-element="true"] {
          background-color: transparent;
          text-decoration: none;
          text-shadow: none;
          border-bottom: none;
        }

        /* Annotations are student work and must survive printing, but a fill
           that reads fine on screen can print as an illegible wash, so each
           becomes an underline that keeps its colour coding. */
        ::highlight(annotation-yellow),
        ::highlight(annotation-green),
        ::highlight(annotation-blue),
        ::highlight(annotation-pink),
        ::highlight(annotation-orange) {
          background-color: transparent;
          border-bottom: 2px solid currentColor;
        }
        ::highlight(annotation-yellow) { border-bottom-color: #ffeb3b; }
        ::highlight(annotation-green) { border-bottom-color: #a6e1c5; }
        ::highlight(annotation-blue) { border-bottom-color: #a7e0f6; }
        ::highlight(annotation-pink) { border-bottom-color: #ff9fae; }
        ::highlight(annotation-orange) { border-bottom-color: #ffa500; }
        ::highlight(annotation-underline) {
          text-decoration-color: #000;
          border-bottom: none;
        }
      }

      /* text-shadow is a direct property rather than a var(), so unlike the
         other TTS rules this one is not overridden by the adaptive path. */
      @media (prefers-reduced-motion: reduce) {
        ::highlight(tts-word),
        [data-pie-tts-word-element="true"] {
          text-shadow: none;
        }
      }
    `;

/**
 * Page-wide, so every copy of the toolkit on a page shares one constructed sheet
 * and adopts it into a shadow root once. The first copy to build it supplies its
 * rules, as the first to append the document's `<style>` does.
 */
const SHARED_SHEET_SLOT = Symbol.for(
	"@pie-players/pie-assessment-toolkit/highlight-stylesheet",
);
const ADOPTED_SHEET_MARKER = Symbol.for(
	"@pie-players/pie-assessment-toolkit/highlight-stylesheet-adopted",
);

type SheetLike = { replaceSync: (text: string) => void };
type AdoptingRoot = { adoptedStyleSheets: unknown[] } & Record<symbol, unknown>;

const isSheetLike = (value: unknown): value is SheetLike =>
	!!value && typeof (value as SheetLike).replaceSync === "function";

const sharedHighlightSheet = (): SheetLike | null => {
	const slot = globalThis as unknown as Record<symbol, unknown>;
	const existing = slot[SHARED_SHEET_SLOT];
	if (isSheetLike(existing)) return existing;
	const Sheet = (globalThis as { CSSStyleSheet?: new () => SheetLike })
		.CSSStyleSheet;
	if (typeof Sheet !== "function") return null;
	try {
		const sheet = new Sheet();
		if (!isSheetLike(sheet)) return null;
		sheet.replaceSync(HIGHLIGHT_STYLES);
		slot[SHARED_SHEET_SLOT] = sheet;
		return sheet;
	} catch {
		return null;
	}
};

/**
 * Adopts the highlight stylesheet into the shadow root holding `node`, once per
 * root. Appended, so the root's own sheets stay in place; re-adopted if the
 * root's owner replaced its sheets since.
 */
const adoptHighlightStylesFor = (node: Node | null | undefined): void => {
	const found = node?.getRootNode?.();
	if (!isShadowRootNode(found)) return;
	const root = found as unknown as Partial<AdoptingRoot>;
	const sheets = root.adoptedStyleSheets;
	if (!sheets || typeof sheets !== "object") return;
	const current = Array.from(sheets);
	const adopted = root[ADOPTED_SHEET_MARKER];
	if (adopted && current.includes(adopted)) return;
	const sheet = sharedHighlightSheet();
	if (!sheet) return;
	try {
		root.adoptedStyleSheets = [...current, sheet];
		root[ADOPTED_SHEET_MARKER] = sheet;
	} catch {
		// A root that refuses the sheet paints from the document's rules where the
		// browser allows it.
	}
};

const TTS_WORD_HIGHLIGHT = "tts-word";
const TTS_SENTENCE_HIGHLIGHT = "tts-sentence";
const annotationHighlightName = (color: HighlightColor): string =>
	`annotation-${color}`;

/**
 * The page's highlight registered under `name`. Every coordinator on a page
 * paints into the same one, because the page-wide `::highlight()` rules select
 * it by that name, and removes only the ranges it added.
 */
const sharedHighlight = (name: string): Highlight => {
	const registered = CSS.highlights.get(name);
	if (registered) return registered;
	const highlight = new Highlight();
	CSS.highlights.set(name, highlight);
	return highlight;
};

const removeRanges = (name: string, ranges: Iterable<Range>): void => {
	const highlight = CSS.highlights.get(name);
	if (!highlight) return;
	for (const range of ranges) highlight.delete(range);
};

/** The element the first range starts in, which the TTS colors adapt to. */
const startElementOf = (ranges: Range[]): Element | null => {
	const source = ranges[0]?.startContainer;
	if (!source) return null;
	return source.nodeType === Node.ELEMENT_NODE
		? (source as Element)
		: composedParentElement(source);
};

/**
 * What the TTS colors derive from. The colors are custom properties on the root
 * element, which every coordinator on the page writes, so the coordinators share
 * these inputs: any one's refresh writes the same values, and two theme
 * observers cannot keep undoing each other's writes.
 */
const ttsStyleInputs: {
	/** The element being read, while highlighted. */
	source: Element | null;
	/** A color set through `updateTTSHighlightStyle`, until its setter is destroyed. */
	override: {
		color: string;
		opacity: number;
		owner: HighlightCoordinator;
	} | null;
} = { source: null, override: null };

export class HighlightCoordinator implements HighlightCoordinatorApi {
	// The ranges this coordinator painted into the shared TTS highlights.
	private ttsWordRanges = new Set<Range>();
	private ttsSentenceRanges = new Set<Range>();
	private ttsWordElementHighlights = new Set<Element>();
	private ttsSentenceElementHighlights = new Set<Element>();
	private annotations = new Map<string, Annotation>();
	// The element this coordinator last adapted the TTS colors to.
	private ttsStyleSource: Element | null = null;
	private nextAnnotationId = 1;
	private supported = false;
	private rangeSerializer: RangeSerializer;
	private themeObserver: MutationObserver | null = null;

	constructor() {
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

	private parseColor(
		input: string | null | undefined,
	): [number, number, number] | null {
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
				computed?.getPropertyValue("--pie-background") ||
					computed?.backgroundColor,
			) || fallbackBackground;
		const text =
			this.parseColor(computed?.getPropertyValue("--pie-text")) || fallbackText;
		const override = ttsStyleInputs.override;
		const accent = override
			? this.parseColor(override.color) || fallbackMissing
			: this.parseColor(computed?.getPropertyValue("--pie-missing")) ||
				fallbackMissing;

		const opacityCandidates = override
			? [Math.max(0.3, Math.min(0.95, override.opacity))]
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

		const sentenceOpacity = Math.max(
			0.24,
			Math.min(0.85, selectedOpacity * 0.55),
		);
		const underlineOpacity = Math.max(
			0.55,
			Math.min(0.95, selectedOpacity + 0.2),
		);
		const shadowOpacity = Math.max(0.22, Math.min(0.6, selectedOpacity * 0.45));

		const underlineColor = text;
		const underlineBlend = this.blend(
			underlineColor,
			background,
			underlineOpacity,
		);
		const underlineDelta = this.contrastRatio(underlineBlend, background);
		const fallbackUnderline: [number, number, number] =
			this.relativeLuminance(background) > 0.45 ? [0, 0, 0] : [255, 255, 255];
		const finalUnderline =
			underlineDelta >= 1.35 ? underlineColor : fallbackUnderline;

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

	/**
	 * Adapt the TTS colors to `sourceEl`, the element being highlighted. Without
	 * one, to the element highlighted last on the page while it stays connected,
	 * else to the document.
	 */
	private applyAdaptiveTTSStyle(sourceEl?: Element | null): void {
		if (typeof document === "undefined") return;
		if (sourceEl) {
			this.ttsStyleSource = sourceEl;
			ttsStyleInputs.source = sourceEl;
		}
		const source =
			sourceEl ??
			(ttsStyleInputs.source?.isConnected ? ttsStyleInputs.source : null);
		const vars = this.resolveAdaptiveTTSStyle(source);
		const style = document.documentElement.style;
		const properties: Array<[string, string]> = [
			["--pie-tts-word-highlight", vars.wordHighlight],
			["--pie-tts-sentence-highlight", vars.sentenceHighlight],
			["--pie-tts-line-highlight", vars.sentenceHighlight],
			["--pie-tts-word-underline", vars.wordUnderline],
			["--pie-tts-word-shadow", vars.wordShadow],
		];
		for (const [name, value] of properties) {
			// An unchanged value is not rewritten: the theme observer watches this
			// element's style, and a write would notify it again.
			if (style.getPropertyValue?.(name) === value) continue;
			style.setProperty(name, value);
		}
	}

	/** Register the shared highlights, unless another coordinator already did. */
	private initializeHighlights(): void {
		if (!this.supported) return;
		sharedHighlight(TTS_WORD_HIGHLIGHT);
		sharedHighlight(TTS_SENTENCE_HIGHLIGHT);
		for (const color of Object.values(HighlightColor)) {
			sharedHighlight(annotationHighlightName(color));
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
		style.textContent = HIGHLIGHT_STYLES;
		document.head.appendChild(style);
	}

	/**
	 * Highlight the word being read (temporary), replacing the previous one.
	 * Every range paints, so a word split across inline elements highlights
	 * whole. A range that covers elements also marks the replaced elements in it
	 * (svg, img, canvas), which a CSS range cannot paint.
	 *
	 * @param ranges The word's ranges: one per tree it spans
	 */
	highlightTTSWord(ranges: Range[]): void {
		if (!this.supported) return;
		this.applyAdaptiveTTSStyle(startElementOf(ranges));

		this.clearTTSWord();

		const highlight = sharedHighlight(TTS_WORD_HIGHLIGHT);
		for (const range of ranges) {
			adoptHighlightStylesFor(range.startContainer);
			highlight.add(range);
			this.ttsWordRanges.add(range);
		}
		this.highlightTTSWordElementFallbacks(
			ranges.filter(
				(range) =>
					range.startContainer !== range.endContainer ||
					range.startContainer.nodeType !== Node.TEXT_NODE,
			),
		);
	}

	/**
	 * Highlight a single element as the active TTS word (temporary).
	 *
	 * Unlike {@link highlightTTSWord} (which paints CSS ranges over text) this
	 * marks the element itself via `data-pie-tts-word-element`. It is used
	 * for atomic targets that have no direct text node to range over — most
	 * notably MathJax CHTML tokens (e.g. `<mjx-mi><mjx-c/></mjx-mi>`, whose glyph
	 * lives in a font-driven pseudo-element a CSS range cannot paint) and
	 * whole-expression fallbacks.
	 *
	 * The supplied element is painted exactly; we deliberately do NOT walk up to
	 * a containing `<math>` / `<mjx-container>`. That escalation is what made
	 * MathJax-rendered math highlight as a full block while native MathML tracked
	 * per-token: a resolved single token must paint as a token, and only a
	 * genuine expression fallback (where the element already is the container)
	 * should paint the whole expression.
	 */
	highlightTTSWordElement(element: Element): void {
		if (!this.supported) return;
		this.applyAdaptiveTTSStyle(element);
		adoptHighlightStylesFor(element);

		// Clear previous word highlight (CSS range and any element attributes)
		this.clearTTSWord();

		element.setAttribute("data-pie-tts-word-element", "true");
		this.ttsWordElementHighlights.add(element);
	}

	/**
	 * Highlight the coarse TTS read-along band (temporary).
	 * Usually one Range per visual line; CSS layer `tts-sentence` for compatibility.
	 *
	 * @param ranges Line (or sentence) ranges to paint with `--pie-tts-line-highlight`
	 */
	highlightTTSSentence(ranges: Range[]): void {
		if (!this.supported) return;
		this.applyAdaptiveTTSStyle(startElementOf(ranges));

		// Clear previous sentence highlight
		this.clearTTSSentence();

		const highlight = sharedHighlight(TTS_SENTENCE_HIGHLIGHT);
		for (const range of ranges) {
			adoptHighlightStylesFor(range.startContainer);
			highlight.add(range);
			this.ttsSentenceRanges.add(range);
		}
		this.highlightTTSElementFallbacks(ranges);
	}

	/**
	 * Highlight sentence/block elements for TTS (background layer).
	 *
	 * @param elements Visible elements to paint with `--pie-tts-line-highlight`
	 */
	highlightTTSSentenceElements(elements: Element[]): void {
		if (!this.supported) return;
		this.applyAdaptiveTTSStyle(elements[0] || null);

		this.clearTTSSentence();

		for (const element of elements) {
			adoptHighlightStylesFor(element);
			element.setAttribute("data-pie-tts-sentence-element", "true");
			this.ttsSentenceElementHighlights.add(element);
		}
	}

	// The read-along (sentence) band legitimately covers whole equations and
	// replaced elements, so it escalates to them.
	private static readonly SENTENCE_FALLBACK_SELECTOR =
		"math, mjx-container, svg, img, canvas, [role='img']";

	// The word layer must NOT escalate a multi-node range to the enclosing
	// `<math>` / `<mjx-container>`: that is what made an equation flash as a
	// whole block whenever a spoken word's visible range crossed several math
	// glyph nodes. Math is tracked per token (or held / region) by the highlight
	// pipeline instead. Replaced elements (svg/img/canvas) still need the element
	// fallback because a CSS range cannot paint them.
	private static readonly WORD_FALLBACK_SELECTOR =
		"svg, img, canvas, [role='img']";

	private highlightTTSElementFallbacks(ranges: Range[]): void {
		if (typeof Element === "undefined") return;
		this.highlightElementFallbacks(
			ranges,
			"data-pie-tts-sentence-element",
			this.ttsSentenceElementHighlights,
			HighlightCoordinator.SENTENCE_FALLBACK_SELECTOR,
		);
	}

	private highlightTTSWordElementFallbacks(ranges: Range[]): void {
		if (typeof Element === "undefined") return;
		this.highlightElementFallbacks(
			ranges,
			"data-pie-tts-word-element",
			this.ttsWordElementHighlights,
			HighlightCoordinator.WORD_FALLBACK_SELECTOR,
		);
	}

	private highlightElementFallbacks(
		ranges: Range[],
		attributeName: string,
		trackedElements: Set<Element>,
		selector: string,
	): void {
		const elementAt = (node: Node): Element | null =>
			node.nodeType === Node.ELEMENT_NODE
				? (node as Element)
				: composedParentElement(node);
		for (const range of ranges) {
			// A range over a shadow root's top-level children has the root as its
			// common ancestor, and the root is what to search.
			const common = range.commonAncestorContainer;
			const root: Element | ShadowRoot | null = isShadowRootNode(common)
				? common
				: elementAt(common);
			if (!root) continue;
			const candidates: Element[] = [];
			const rangeStartElement = elementAt(range.startContainer);
			const rangeEndElement = elementAt(range.endContainer);
			for (const element of [rangeStartElement, rangeEndElement]) {
				let current: Element | null = element;
				while (current) {
					if (current.matches?.(selector)) candidates.push(current);
					current = composedParentElement(current);
				}
			}
			if (!isShadowRootNode(root) && root.matches?.(selector)) {
				candidates.push(root);
			}
			candidates.push(...Array.from(root.querySelectorAll(selector)));
			for (const element of new Set(candidates)) {
				try {
					if (
						!range.intersectsNode(element) &&
						!composedContains(element, rangeStartElement) &&
						!composedContains(element, rangeEndElement)
					) {
						continue;
					}
				} catch {
					continue;
				}
				element.setAttribute(attributeName, "true");
				trackedElements.add(element);
			}
		}
	}

	/**
	 * Clear TTS word highlight
	 */
	clearTTSWord(): void {
		if (!this.supported) return;
		removeRanges(TTS_WORD_HIGHLIGHT, this.ttsWordRanges);
		this.ttsWordRanges.clear();
		for (const element of this.ttsWordElementHighlights) {
			element.removeAttribute("data-pie-tts-word-element");
		}
		this.ttsWordElementHighlights.clear();
	}

	/**
	 * Clear TTS sentence highlight
	 */
	clearTTSSentence(): void {
		if (!this.supported) return;
		removeRanges(TTS_SENTENCE_HIGHLIGHT, this.ttsSentenceRanges);
		this.ttsSentenceRanges.clear();
		for (const element of this.ttsSentenceElementHighlights) {
			element.removeAttribute("data-pie-tts-sentence-element");
		}
		this.ttsSentenceElementHighlights.clear();
	}

	/**
	 * Clear all TTS highlights
	 */
	clearTTS(): void {
		this.clearTTSWord();
		this.clearTTSSentence();
		if (ttsStyleInputs.source === this.ttsStyleSource) {
			ttsStyleInputs.source = null;
		}
		this.ttsStyleSource = null;
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
		adoptHighlightStylesFor(clonedRange.startContainer);

		// Store annotation data
		const annotation: Annotation = {
			id,
			range: clonedRange,
			type: HighlightType.ANNOTATION,
			color,
			timestamp: Date.now(),
		};
		this.annotations.set(id, annotation);

		// The same range object, so it can later be deleted by reference.
		if (this.supported) {
			sharedHighlight(annotationHighlightName(color)).add(clonedRange);
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

		if (this.supported) {
			removeRanges(annotationHighlightName(annotation.color), [
				annotation.range,
			]);
		}

		this.annotations.delete(id);
	}

	/**
	 * Remove all annotations
	 */
	clearAnnotations(): void {
		if (this.supported) {
			for (const annotation of this.annotations.values()) {
				removeRanges(annotationHighlightName(annotation.color), [
					annotation.range,
				]);
			}
		}
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

		annotation.color = newColor;
		if (this.supported) {
			removeRanges(annotationHighlightName(oldColor), [annotation.range]);
			sharedHighlight(annotationHighlightName(newColor)).add(annotation.range);
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
	 * Highlight a range as the given type: the TTS types paint as
	 * {@link highlightTTSWord} and {@link highlightTTSSentence} do.
	 */
	highlightRange(
		range: Range,
		type: HighlightType,
		color: HighlightColor = HighlightColor.YELLOW,
	): void {
		if (!this.supported) return;

		switch (type) {
			case HighlightType.TTS_WORD:
				this.highlightTTSWord([range]);
				break;
			case HighlightType.TTS_SENTENCE:
				this.highlightTTSSentence([range]);
				break;
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

		ttsStyleInputs.override = {
			color: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
			opacity: Math.max(0.2, Math.min(0.95, opacity)),
			owner: this,
		};
		this.applyAdaptiveTTSStyle();
	}

	/**
	 * Remove this coordinator's ranges and stop its observer.
	 *
	 * The stylesheet and the registered highlights are page-wide and shared by
	 * every live coordinator, so they stay installed for the document's lifetime.
	 */
	destroy(): void {
		if (!this.supported) return;

		this.clearTTS();
		this.clearAnnotations();
		if (ttsStyleInputs.override?.owner === this) {
			ttsStyleInputs.override = null;
		}
		this.themeObserver?.disconnect();
		this.themeObserver = null;
	}
}
