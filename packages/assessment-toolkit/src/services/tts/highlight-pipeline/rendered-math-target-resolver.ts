import { isNodeHiddenForTTS } from "../text-processing.js";
import type {
	SemanticHighlightTarget,
	RenderableHighlightTarget,
} from "./types.js";

const MATHML_LEAF_TO_MATHJAX = new Map([
	["mi", "mjx-mi"],
	["mn", "mjx-mn"],
	["mo", "mjx-mo"],
	["mtext", "mjx-mtext"],
]);

const MATHML_LEAF_SELECTOR = "mi,mn,mo,mtext";
const MATHJAX_LEAF_SELECTOR = "mjx-mi,mjx-mn,mjx-mo,mjx-mtext";

// 2D layouts MathJax renders with extra, glyph-only nodes (radical surds,
// fraction bars drawn as borders, table scaffolding) that have no source-MathML
// leaf counterpart. They break the 1:1 token correspondence we rely on below,
// so we refuse positional mapping inside them and fall back to the whole
// expression instead of guessing.
const UNSUPPORTED_MATHJAX_LAYOUT_SELECTOR = [
	"mjx-mfrac",
	"mjx-msqrt",
	"mjx-mroot",
	"mjx-mtable",
	"mjx-munder",
	"mjx-mover",
	"mjx-munderover",
].join(",");

const nearestElement = (target: SemanticHighlightTarget): Element | null => {
	if (target.type === "text-range") return target.node.parentElement;
	return target.element;
};

const owningMathJaxContainer = (element: Element | null): Element | null => {
	let current: Element | null = element;
	while (current) {
		if (current.localName?.toLowerCase() === "mjx-container") return current;
		current = current.parentElement;
	}
	return null;
};

const isVisibleNativeTarget = (element: Element | null): boolean => {
	if (!element) return false;
	if (owningMathJaxContainer(element)) return false;
	return !isNodeHiddenForTTS(element);
};

const hasVisibleGeometry = (element: Element): boolean => {
	const rect = (element as HTMLElement).getBoundingClientRect?.();
	return Boolean(rect && rect.width > 0 && rect.height > 0);
};

const closestMathElement = (element: Element | null): Element | null => {
	let current: Element | null = element;
	while (current) {
		if (current.localName?.toLowerCase() === "math") return current;
		current = current.parentElement;
	}
	return null;
};

// MathJax CHTML renders each source-MathML token (mi/mn/mo/mtext) as exactly
// one mjx-* token in the same document order — including invisible operators,
// which it keeps as zero-size nodes. The original <math> survives, clipped, in
// mjx-assistive-mml, so its glyph text nodes are not visible and the visible
// CHTML tokens carry no readable textContent (glyphs come from web fonts).
// We therefore map a source token to its rendered glyph by *structural
// position* rather than text, but only after proving the two leaf lists are
// isomorphic (equal length, matching token type at every index). When the
// structure diverges we refuse to guess and let the caller fall back to the
// whole expression. "False positives are worse than coarse highlighting."
const tokensAreIsomorphic = (
	mathLeaves: Element[],
	chtmlLeaves: Element[],
): boolean => {
	if (mathLeaves.length === 0) return false;
	if (mathLeaves.length !== chtmlLeaves.length) return false;
	for (let index = 0; index < mathLeaves.length; index += 1) {
		const expected = MATHML_LEAF_TO_MATHJAX.get(
			mathLeaves[index].localName.toLowerCase(),
		);
		if (!expected) return false;
		if (chtmlLeaves[index].localName.toLowerCase() !== expected) return false;
	}
	return true;
};

const resolveMathJaxTokenByPosition = (
	semanticElement: Element | null,
	container: Element,
): Element | null => {
	if (!semanticElement) return null;
	if (!MATHML_LEAF_TO_MATHJAX.has(semanticElement.localName.toLowerCase()))
		return null;
	if (container.querySelector(UNSUPPORTED_MATHJAX_LAYOUT_SELECTOR)) return null;
	const sourceMath = closestMathElement(semanticElement);
	const renderedMath = container.querySelector("mjx-math");
	if (!sourceMath || !renderedMath) return null;
	const mathLeaves = Array.from(
		sourceMath.querySelectorAll(MATHML_LEAF_SELECTOR),
	);
	const index = mathLeaves.indexOf(semanticElement);
	if (index < 0) return null;
	const chtmlLeaves = Array.from(
		renderedMath.querySelectorAll(MATHJAX_LEAF_SELECTOR),
	);
	if (!tokensAreIsomorphic(mathLeaves, chtmlLeaves)) return null;
	const token = chtmlLeaves[index];
	// The matched token must be a real, visible glyph. We deliberately do NOT
	// run isNodeHiddenForTTS here: MathJax marks its visual CHTML
	// (mjx-math) with aria-hidden="true" because the accessible tree lives in
	// the clipped mjx-assistive-mml. aria-hidden is correct for screen readers
	// but irrelevant for a visual highlight — the glyph is painted on screen.
	// Visible geometry is the right test: it rejects display:none nodes and
	// zero-size invisible operators (e.g. U+2062 invisible-times, which is
	// never spoken anyway) without discarding the real, on-screen tokens.
	if (!token || !hasVisibleGeometry(token)) return null;
	return token;
};

// Per-equation highlight capability, decided once before playback. "token"
// means we are confident every spoken token can be mapped to a visible glyph,
// so the equation tracks word-by-word and the whole expression is never
// painted. "expression" means we cannot reliably map tokens (a 2D MathJax
// layout, a non-isomorphic render, or nothing visible), so the equation is
// highlighted as one stable block for its entire spoken duration. Deciding
// once and committing is what stops the highlight from flickering between a
// token and the whole expression during breaks/pauses.
export type MathHighlightCapability = "token" | "expression";

export const classifyMathHighlightCapability = (
	mathElement: Element,
): MathHighlightCapability => {
	const container = owningMathJaxContainer(mathElement);
	if (container) {
		// 2D MathJax layouts add glyph-only nodes with no source-MathML
		// counterpart, so positional mapping is unsafe — commit to expression.
		if (container.querySelector(UNSUPPORTED_MATHJAX_LAYOUT_SELECTOR)) {
			return "expression";
		}
		const sourceMath = closestMathElement(mathElement) ?? mathElement;
		const renderedMath = container.querySelector("mjx-math");
		if (!renderedMath) return "expression";
		const mathLeaves = Array.from(
			sourceMath.querySelectorAll(MATHML_LEAF_SELECTOR),
		);
		const chtmlLeaves = Array.from(
			renderedMath.querySelectorAll(MATHJAX_LEAF_SELECTOR),
		);
		if (!tokensAreIsomorphic(mathLeaves, chtmlLeaves)) return "expression";
		// At least one rendered token must paint a real glyph; otherwise a
		// per-token highlight would have nothing visible to land on.
		return chtmlLeaves.some((leaf) => hasVisibleGeometry(leaf))
			? "token"
			: "expression";
	}
	// Native MathML: every leaf is a real, browser-positioned element, so
	// per-token highlighting is reliable even inside 2D layouts (fractions,
	// radicals). It is token-capable as long as a visible leaf exists.
	const sourceMath = closestMathElement(mathElement) ?? mathElement;
	const leaves = Array.from(sourceMath.querySelectorAll(MATHML_LEAF_SELECTOR));
	return leaves.some((leaf) => !isNodeHiddenForTTS(leaf))
		? "token"
		: "expression";
};

export type RenderedMathTargetResolver = (
	target: SemanticHighlightTarget,
) => RenderableHighlightTarget | null;

const resolveRenderedMathTargetUncached = (
	target: SemanticHighlightTarget,
): RenderableHighlightTarget | null => {
	const element = nearestElement(target);
	const mathJaxContainer = owningMathJaxContainer(element);
	if (mathJaxContainer) {
		const visibleToken = resolveMathJaxTokenByPosition(
			element,
			mathJaxContainer,
		);
		if (visibleToken) {
			return {
				type: "element",
				quality: "semantic-token",
				element: visibleToken,
			};
		}
		return {
			type: "element",
			quality: "expression",
			element: mathJaxContainer,
		};
	}
	if (target.type === "text-range") {
		if (!isVisibleNativeTarget(target.node.parentElement)) return null;
		return {
			type: "text-range",
			quality: "semantic-token",
			node: target.node,
			startOffset: target.startOffset,
			endOffset: target.endOffset,
		};
	}
	if (!isVisibleNativeTarget(target.element)) return null;
	return {
		type: "element",
		quality:
			target.quality === "region-fallback" ? "expression" : "semantic-token",
		element: target.element,
	};
};

export const resolveRenderedMathTarget: RenderedMathTargetResolver =
	resolveRenderedMathTargetUncached;

export const createRenderedMathTargetResolver =
	(): RenderedMathTargetResolver => {
		const mathJaxTargetCache = new WeakMap<
			Element,
			RenderableHighlightTarget | null
		>();
		return (target) => {
			const element = nearestElement(target);
			const mathJaxContainer = owningMathJaxContainer(element);
			if (!element || !mathJaxContainer) {
				return resolveRenderedMathTargetUncached(target);
			}
			if (mathJaxTargetCache.has(element)) {
				return mathJaxTargetCache.get(element) ?? null;
			}
			const rendered = resolveRenderedMathTargetUncached(target);
			mathJaxTargetCache.set(element, rendered);
			return rendered;
		};
	};
