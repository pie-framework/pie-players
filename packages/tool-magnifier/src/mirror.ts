/**
 * The magnifier's picture of the page: a scriptless, inert copy of the document
 * rendered in a sandboxed same-origin iframe, which the lens scales and offsets
 * so the content under it appears enlarged.
 *
 * A copy, because CSS cannot paint one part of a page inside another, and
 * re-rendering the content itself (cloning the elements under the lens) runs
 * their scripts and duplicates their ids, focus and event handlers. The copy is
 * serialized from the live DOM: open shadow roots become declarative shadow
 * roots, every style sheet is written out from its CSSOM (so rules inserted with
 * `insertRule` survive), and form state, scroll offsets, canvases and video
 * frames are copied across after the copy loads. Highlights painted through the
 * CSS Custom Highlight API are mapped onto the copy's nodes and follow the page's
 * from frame to frame. Two frames alternate, so a re-render paints into the
 * hidden one and swaps when it is ready, and the lens never shows a half-loaded
 * document.
 *
 * What the copy cannot carry: closed shadow roots, cross-origin iframes,
 * WebGL canvases without a preserved drawing buffer and top-layer content.
 */

import {
	type CopyMap,
	createCopyMap,
	highlightSignature,
	type NodePosition,
	paintHighlights,
	sameSignature,
} from "./highlights.js";

const SCROLL_ATTRIBUTE = "data-pie-magnifier-scroll";
const MEDIA_ATTRIBUTE = "data-pie-magnifier-media";

const VOID_ELEMENTS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"source",
	"track",
	"wbr",
]);

/** Elements whose content never reaches the copy. */
const SKIPPED_ELEMENTS = new Set([
	"script",
	"noscript",
	"template",
	"object",
	"embed",
]);

/** Elements whose start tag swallows the newline straight after it. */
const LEADING_NEWLINE_ELEMENTS = new Set(["pre", "listing"]);

/** Attributes that would make the copy act rather than show. */
const DROPPED_ATTRIBUTES = new Set([
	"autofocus",
	"autoplay",
	"loading",
	"preload",
	"src",
	"srcdoc",
]);

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

/**
 * Appended to every copy. The copy's own scrollbars would narrow its layout
 * against the page's, and an animation would play from its start on every
 * re-render.
 */
const MIRROR_STYLE =
	"html{scrollbar-width:none}html::-webkit-scrollbar{display:none}" +
	"html,*{scroll-behavior:auto!important}" +
	"*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

export interface SerializeOptions {
	/** Elements left out of the copy, with everything inside them. */
	exclude?: (element: Element) => boolean;
}

export interface SerializedDocument {
	html: string;
	/** Elements whose scroll offsets the copy takes, by scroll id. */
	scrollers: Element[];
	/** Canvases and videos whose pixels the copy takes, by media id. */
	media: Array<HTMLCanvasElement | HTMLVideoElement>;
	/** The open shadow roots the copy reproduces. */
	shadowRoots: ShadowRoot[];
	/** The sheets each root had adopted. */
	adoptedSheets: Map<Document | ShadowRoot, CSSStyleSheet[]>;
	/** Where each text node and element in the body was written. */
	positions: Map<Node, NodePosition>;
}

const escapeText = (value: string) =>
	value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeAttribute = (value: string) =>
	value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** A sheet's rules as text, or `null` when its rules cannot be read. */
function sheetText(sheet: CSSStyleSheet | null | undefined): string | null {
	if (!sheet) return null;
	try {
		let text = "";
		for (const rule of Array.from(sheet.cssRules)) text += `${rule.cssText}\n`;
		return text;
	} catch {
		// A cross-origin sheet: its rules are not readable, so the caller keeps
		// the element that loads it instead.
		return null;
	}
}

/** Text safe inside a raw-text `<style>` element. */
const rawStyleText = (css: string) => css.replace(/<\/style/gi, "<\\/style");

const isScrolled = (element: Element) =>
	element.scrollTop !== 0 ||
	element.scrollLeft !== 0 ||
	element.scrollHeight > element.clientHeight ||
	element.scrollWidth > element.clientWidth;

export function serializeDocument(
	doc: Document,
	options: SerializeOptions = {},
): SerializedDocument {
	const { exclude } = options;
	const scrollers: Element[] = [];
	const media: Array<HTMLCanvasElement | HTMLVideoElement> = [];
	const shadowRoots: ShadowRoot[] = [];
	const adopted = new Map<Document | ShadowRoot, CSSStyleSheet[]>();
	const positions = new Map<Node, NodePosition>();
	const scrollingElement = doc.scrollingElement;
	let nonce = "";
	const out: string[] = [];

	const nonceAttribute = (element: Element) => {
		const value = (element as HTMLElement).nonce ?? element.getAttribute("nonce") ?? "";
		if (value && !nonce) nonce = value;
		return value ? ` nonce="${escapeAttribute(value)}"` : "";
	};

	const styleElement = (css: string, attributes = "") => {
		out.push(`<style${attributes}>${rawStyleText(css)}</style>`);
	};

	const adoptedSheets = (root: Document | ShadowRoot) => {
		const sheets = Array.from(root.adoptedStyleSheets ?? []);
		adopted.set(root, sheets);
		for (const sheet of sheets) {
			const text = sheetText(sheet);
			if (text) styleElement(text, nonce ? ` nonce="${escapeAttribute(nonce)}"` : "");
		}
	};

	const attributes = (element: Element, skip?: Set<string>) => {
		let text = "";
		for (const attribute of Array.from(element.attributes)) {
			const name = attribute.name;
			if (name.startsWith("on") || DROPPED_ATTRIBUTES.has(name)) continue;
			if (name === "nonce" || name === SCROLL_ATTRIBUTE || name === MEDIA_ATTRIBUTE) continue;
			if (skip?.has(name)) continue;
			text += ` ${name}="${escapeAttribute(attribute.value)}"`;
		}
		return text;
	};

	/** Attributes carrying state the DOM holds as properties. */
	const stateAttributes = (element: Element, tag: string) => {
		if (tag === "input") {
			const input = element as HTMLInputElement;
			if (input.type === "checkbox" || input.type === "radio") {
				return input.checked ? " checked" : "";
			}
			if (input.type === "password" || input.type === "file") return "";
			return ` value="${escapeAttribute(input.value)}"`;
		}
		if (tag === "option") return (element as HTMLOptionElement).selected ? " selected" : "";
		return "";
	};

	const stateSkip: Record<string, Set<string>> = {
		input: new Set(["value", "checked"]),
		option: new Set(["selected"]),
	};

	const sourceAttributes = (element: Element, tag: string) => {
		// `src` is dropped for everything, then restored for the elements whose
		// source is their picture. Video and audio keep it too, without loading
		// more than their first frame.
		const src = element.getAttribute("src");
		const source = src === null || tag === "iframe" ? "" : ` src="${escapeAttribute(src)}"`;
		if (tag === "video") return `${source} preload="metadata"`;
		if (tag === "audio") return `${source} preload="none"`;
		return source;
	};

	/**
	 * Writes a parent's children and records where each one lands. An empty
	 * comment keeps adjacent text nodes apart, which the parser would otherwise
	 * merge into one.
	 */
	const children = (parent: Node) => {
		const swallowsNewline =
			parent.nodeType === Node.ELEMENT_NODE &&
			(parent as Element).namespaceURI === HTML_NAMESPACE &&
			LEADING_NEWLINE_ELEMENTS.has((parent as Element).localName);
		let index = 0;
		let afterText = false;
		for (const child of Array.from(parent.childNodes)) {
			if (child.nodeType === Node.TEXT_NODE) {
				const text = child.nodeValue ?? "";
				if (!text) continue;
				if (afterText) out.push("<!---->");
				else if (index === 0 && swallowsNewline && text.startsWith("\n")) out.push("\n");
				out.push(escapeText(text));
				afterText = true;
			} else if (visit(child)) {
				afterText = false;
			} else {
				continue;
			}
			positions.set(child, { parent, index: index++ });
		}
	};

	const shadow = (element: Element) => {
		const root = element.shadowRoot;
		if (!root || root.mode !== "open") return;
		shadowRoots.push(root);
		out.push('<template shadowrootmode="open">');
		children(root);
		adoptedSheets(root);
		out.push("</template>");
	};

	/** Writes an element, reporting whether it did. */
	function visit(node: Node): boolean {
		if (node.nodeType !== Node.ELEMENT_NODE) return false;
		const element = node as Element;
		if (exclude?.(element)) return false;
		const html = element.namespaceURI === HTML_NAMESPACE;
		// `localName` keeps SVG's and MathML's camel case (`foreignObject`).
		const tag = element.localName;
		if (html && SKIPPED_ELEMENTS.has(tag)) return false;

		if (tag === "style") {
			const css = html ? sheetText((element as HTMLStyleElement).sheet) : null;
			const text = css ?? element.textContent ?? "";
			// In SVG a style element's text is parsed as text, not raw text.
			out.push(`<style${attributes(element)}${nonceAttribute(element)}>`);
			out.push(html ? rawStyleText(text) : escapeText(text));
			out.push("</style>");
			return true;
		}

		let marker = "";
		if (html && element !== scrollingElement && isScrolled(element)) {
			marker += ` ${SCROLL_ATTRIBUTE}="${scrollers.length}"`;
			scrollers.push(element);
		}
		if (html && (tag === "canvas" || tag === "video")) {
			marker += ` ${MEDIA_ATTRIBUTE}="${media.length}"`;
			media.push(element as HTMLCanvasElement | HTMLVideoElement);
		}

		const stateful = html ? stateAttributes(element, tag) : "";
		const skip = html ? stateSkip[tag] : undefined;
		const sources = sourceAttributes(element, tag);
		const nonceText = tag === "link" ? nonceAttribute(element) : "";
		out.push(`<${tag}${attributes(element, skip)}${sources}${stateful}${nonceText}${marker}>`);
		if (html && VOID_ELEMENTS.has(tag)) return true;
		shadow(element);
		if (html && tag === "textarea") {
			out.push(escapeText((element as HTMLTextAreaElement).value));
		} else if (html && tag === "iframe") {
			// An iframe's document is its own, and a cross-origin one is unreadable;
			// the copy keeps its box and leaves it empty.
		} else {
			children(element);
		}
		out.push(`</${tag}>`);
		return true;
	}

	const head = () => {
		out.push(`<head><meta charset="utf-8"><base href="${escapeAttribute(doc.baseURI)}">`);
		for (const sheetOwner of Array.from(
			doc.querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel~="stylesheet"]'),
		)) {
			if (sheetOwner.getRootNode() !== doc) continue;
			if (sheetOwner.closest("body")) continue;
			if (exclude?.(sheetOwner)) continue;
			if ((sheetOwner as HTMLLinkElement).sheet?.disabled) continue;
			if (sheetOwner.localName === "link") {
				const link = sheetOwner as HTMLLinkElement;
				out.push(
					`<link rel="stylesheet" href="${escapeAttribute(link.href)}"${
						link.media ? ` media="${escapeAttribute(link.media)}"` : ""
					}${nonceAttribute(link)}>`,
				);
				continue;
			}
			const text = sheetText(sheetOwner.sheet) ?? sheetOwner.textContent ?? "";
			const media = (sheetOwner as HTMLStyleElement).media;
			out.push(
				`<style${media ? ` media="${escapeAttribute(media)}"` : ""}${nonceAttribute(sheetOwner)}>${rawStyleText(text)}</style>`,
			);
		}
		out.push("</head>");
	};

	if (doc.doctype) out.push(`<!DOCTYPE ${doc.doctype.name}>`);
	const root = doc.documentElement;
	out.push(`<html${attributes(root)}>`);
	head();
	const body = doc.body;
	if (body) {
		out.push(`<body${attributes(body)}>`);
		shadow(body);
		children(body);
		adoptedSheets(doc);
		styleElement(MIRROR_STYLE, nonce ? ` nonce="${escapeAttribute(nonce)}"` : "");
		out.push("</body>");
	}
	out.push("</html>");
	return {
		html: out.join(""),
		scrollers,
		media,
		shadowRoots,
		adoptedSheets: adopted,
		positions,
	};
}

export interface MirrorFrameOptions {
	/** The element the frames are mounted in; the lens's viewport. */
	container: HTMLElement;
	document?: Document;
	/** Elements left out of the copy -- the magnifier itself. */
	exclude: (element: Element) => boolean;
	/** Called after a fresh copy has replaced the one on show. */
	onSwap?: () => void;
	/**
	 * The shortest interval between two re-renders, in milliseconds. A copy that
	 * costs more than a quarter of it waits longer: see `COST_FACTOR`.
	 */
	throttleMs?: number;
}

export interface MirrorFrame {
	/** Marks the copy stale; it is re-rendered within the throttle interval. */
	invalidate(): void;
	/** Copies the page's scroll offsets onto the copy on show. */
	syncScroll(): void;
	/** The CSS transform both frames are drawn with. */
	setTransform(transform: string): void;
	destroy(): void;
}

interface FrameState {
	iframe: HTMLIFrameElement;
	scrollers: Element[];
	mirrorScrollers: Map<number, Element>;
	adoptedSheets: SerializedDocument["adoptedSheets"];
	copy: CopyMap | null;
}

/** Collects `[attribute]` elements from a document and its shadow roots. */
function collectMarked(root: Document | ShadowRoot, attribute: string, into: Map<number, Element>) {
	const walk = (scope: Document | ShadowRoot) => {
		for (const element of Array.from(scope.querySelectorAll("*"))) {
			const id = element.getAttribute(attribute);
			if (id !== null) into.set(Number(id), element);
			if (element.shadowRoot) walk(element.shadowRoot);
		}
	};
	walk(root);
}

const SAFETY_TIMEOUT_MS = 2000;

/**
 * Re-renders start at least this many times their own cost apart, so copying a
 * large page keeps to about a quarter of the main thread. A render's cost is its
 * time less the copy's wait for its style sheets, images and fonts, which is
 * network time: see `renderCost`.
 */
const COST_FACTOR = 4;

export function createMirrorFrame(options: MirrorFrameOptions): MirrorFrame {
	const { container, exclude, onSwap } = options;
	const doc = options.document ?? container.ownerDocument;
	const view = doc.defaultView;
	const throttleMs = options.throttleMs ?? 200;
	const now = () => view?.performance.now() ?? Date.now();

	const makeFrame = (): FrameState => {
		const iframe = doc.createElement("iframe");
		iframe.setAttribute("sandbox", "allow-same-origin");
		iframe.setAttribute("aria-hidden", "true");
		iframe.setAttribute("tabindex", "-1");
		iframe.setAttribute("inert", "");
		Object.assign(iframe.style, {
			position: "absolute",
			left: "0",
			top: "0",
			border: "0",
			margin: "0",
			padding: "0",
			pointerEvents: "none",
			transformOrigin: "0 0",
			visibility: "hidden",
			background: "transparent",
		});
		container.append(iframe);
		return {
			iframe,
			scrollers: [],
			mirrorScrollers: new Map(),
			adoptedSheets: new Map(),
			copy: null,
		};
	};

	const frames: [FrameState, FrameState] = [makeFrame(), makeFrame()];
	let shown = -1;
	let transform = "";
	let loading = false;
	let dirty = false;
	let destroyed = false;
	let lastRender = 0;
	let lastCost = 0;
	let throttleTimer: ReturnType<typeof setTimeout> | null = null;
	let safetyTimer: ReturnType<typeof setTimeout> | null = null;
	let observedRoots: ShadowRoot[] = [];
	const highlights = view?.CSS?.highlights;
	let highlightFrame = 0;
	let paintedHighlights: unknown[] = [];

	const sizeFrames = () => {
		const width = doc.documentElement.clientWidth;
		const height = doc.documentElement.clientHeight;
		for (const { iframe } of frames) {
			iframe.style.width = `${width}px`;
			iframe.style.height = `${height}px`;
		}
	};

	const isExcludedTarget = (node: Node | null): boolean => {
		for (let current = node; current; ) {
			if (current.nodeType === Node.ELEMENT_NODE && exclude(current as Element)) return true;
			const parent: Node | null = current.parentNode;
			current = parent instanceof ShadowRoot ? parent.host : parent;
		}
		return false;
	};

	const observer = new MutationObserver((records) => {
		if (records.some((record) => !isExcludedTarget(record.target))) invalidate();
	});
	const observeOptions: MutationObserverInit = {
		childList: true,
		attributes: true,
		characterData: true,
		subtree: true,
	};

	const onStateChange = (event: Event) => {
		if (!isExcludedTarget(event.target as Node)) invalidate();
	};
	const onScroll = (event: Event) => {
		const target = event.target;
		if (target === doc || target === doc.documentElement) {
			syncScroll();
			return;
		}
		if (target instanceof Element && isExcludedTarget(target)) return;
		const state = shown >= 0 ? frames[shown] : undefined;
		if (state && target instanceof Element && !state.scrollers.includes(target)) {
			// A box that only became scrollable after the copy was taken.
			invalidate();
			return;
		}
		syncScroll();
	};
	const onResize = () => {
		sizeFrames();
		invalidate();
	};

	/** Listeners per root: scroll and change events do not cross shadow boundaries. */
	const listen = (root: Document | ShadowRoot, add: boolean) => {
		if (add) {
			root.addEventListener("scroll", onScroll, { capture: true, passive: true });
			root.addEventListener("input", onStateChange, true);
			root.addEventListener("change", onStateChange, true);
			return;
		}
		root.removeEventListener("scroll", onScroll, true);
		root.removeEventListener("input", onStateChange, true);
		root.removeEventListener("change", onStateChange, true);
	};

	const observe = (shadowRoots: ShadowRoot[]) => {
		observer.disconnect();
		observer.observe(doc.documentElement, observeOptions);
		for (const root of observedRoots) if (!shadowRoots.includes(root)) listen(root, false);
		for (const root of shadowRoots) {
			observer.observe(root, observeOptions);
			if (!observedRoots.includes(root)) listen(root, true);
		}
		observedRoots = shadowRoots;
	};

	const paintMedia = (mirrorDoc: Document, media: SerializedDocument["media"]) => {
		const targets = new Map<number, Element>();
		collectMarked(mirrorDoc, MEDIA_ATTRIBUTE, targets);
		for (const [id, target] of targets) {
			const source = media[id];
			if (!source) continue;
			try {
				if (source.localName === "canvas") {
					const canvas = target as HTMLCanvasElement;
					canvas.width = (source as HTMLCanvasElement).width;
					canvas.height = (source as HTMLCanvasElement).height;
					canvas.getContext("2d")?.drawImage(source as HTMLCanvasElement, 0, 0);
				} else {
					(target as HTMLVideoElement).currentTime = (source as HTMLVideoElement).currentTime;
				}
			} catch {
				// A tainted canvas or a video without metadata stays blank.
			}
		}
	};

	const applyScroll = (state: FrameState) => {
		const mirrorWindow = state.iframe.contentWindow;
		if (!mirrorWindow || !view) return;
		mirrorWindow.scrollTo(view.scrollX, view.scrollY);
		for (const [id, target] of state.mirrorScrollers) {
			const source = state.scrollers[id];
			if (!source) continue;
			target.scrollTop = source.scrollTop;
			target.scrollLeft = source.scrollLeft;
		}
	};

	function syncScroll() {
		if (shown >= 0) applyScroll(frames[shown]);
	}

	const paint = (state: FrameState) => {
		const mirrorWindow = state.iframe.contentWindow;
		if (!highlights || !state.copy || !mirrorWindow) return;
		paintedHighlights = highlightSignature(highlights);
		paintHighlights(highlights, state.copy, mirrorWindow);
	};

	/**
	 * Whether a highlight sits in a root whose adopted sheets changed after the
	 * copy was taken. Adopting a sheet is no DOM mutation, and the sheet styling a
	 * highlight is often adopted into a shadow root as its first range lands there.
	 */
	const sheetsChanged = (state: FrameState, registry: HighlightRegistry) => {
		let changed = false;
		registry.forEach((highlight) => {
			highlight.forEach((range) => {
				if (changed) return;
				const root = range.startContainer.getRootNode() as Document | ShadowRoot;
				const taken = state.adoptedSheets.get(root);
				const current = root.adoptedStyleSheets;
				if (!taken || !current) return;
				changed =
					taken.length !== current.length || taken.some((sheet, i) => sheet !== current[i]);
			});
		});
		return changed;
	};

	/**
	 * Highlights change without touching the DOM, and the registry reports no
	 * change, so it is compared with what was last painted once a frame.
	 */
	const watchHighlights = () => {
		if (destroyed || !highlights || !view) return;
		highlightFrame = view.requestAnimationFrame(watchHighlights);
		if (shown < 0 || sameSignature(highlightSignature(highlights), paintedHighlights)) return;
		const state = frames[shown];
		if (sheetsChanged(state, highlights)) invalidate();
		paint(state);
	};

	/**
	 * The main thread's part of a render from `start` to `end`: serializing, tearing
	 * down the old copy and parsing the new one, up to its `DOMContentLoaded`, then
	 * the copy's style and layout and the swap, from its last resource on. The time
	 * in between is the wait for those resources. Where the copy's timings are not
	 * readable, the whole render counts.
	 */
	const renderCost = (iframe: HTMLIFrameElement, start: number, end: number): number => {
		const copyPerformance = iframe.contentWindow?.performance;
		const timing = copyPerformance?.getEntriesByType?.("navigation")[0] as
			| PerformanceNavigationTiming
			| undefined;
		if (!view || !copyPerformance || !timing?.domContentLoadedEventEnd) return end - start;
		const origin = copyPerformance.timeOrigin - view.performance.timeOrigin;
		const parsed = origin + timing.domContentLoadedEventEnd;
		let fetched = parsed;
		for (const entry of copyPerformance.getEntriesByType("resource") as PerformanceResourceTiming[]) {
			fetched = Math.max(fetched, origin + entry.responseEnd);
		}
		return Math.max(0, Math.min(parsed, end) - start) + Math.max(0, end - fetched);
	};

	const finish = (index: number, snapshot: SerializedDocument) => {
		if (safetyTimer !== null) clearTimeout(safetyTimer);
		safetyTimer = null;
		if (destroyed) return;
		const state = frames[index];
		const mirrorDoc = state.iframe.contentDocument;
		state.scrollers = snapshot.scrollers;
		state.mirrorScrollers = new Map();
		state.adoptedSheets = snapshot.adoptedSheets;
		state.copy = null;
		if (mirrorDoc) {
			collectMarked(mirrorDoc, SCROLL_ATTRIBUTE, state.mirrorScrollers);
			paintMedia(mirrorDoc, snapshot.media);
			state.copy = createCopyMap(snapshot.positions, doc.body, mirrorDoc);
			paint(state);
		}
		applyScroll(state);
		state.iframe.style.visibility = "visible";
		if (shown >= 0 && shown !== index) frames[shown].iframe.style.visibility = "hidden";
		shown = index;
		loading = false;
		lastCost = renderCost(state.iframe, lastRender, now());
		onSwap?.();
		if (dirty) schedule();
	};

	const render = () => {
		if (destroyed) return;
		dirty = false;
		loading = true;
		lastRender = now();
		const index = shown === 0 ? 1 : 0;
		const state = frames[index];
		const snapshot = serializeDocument(doc, { exclude });
		observe(snapshot.shadowRoots);
		sizeFrames();
		state.iframe.style.transform = transform;
		let finished = false;
		const done = () => {
			if (finished) return;
			finished = true;
			const fonts = state.iframe.contentDocument?.fonts;
			if (fonts) {
				fonts.ready.then(
					() => finish(index, snapshot),
					() => finish(index, snapshot),
				);
			} else {
				finish(index, snapshot);
			}
		};
		state.iframe.addEventListener("load", done, { once: true });
		// A resource that never settles would hold `load` back for good.
		safetyTimer = setTimeout(done, SAFETY_TIMEOUT_MS);
		state.iframe.srcdoc = snapshot.html;
	};

	function schedule() {
		if (destroyed || loading || throttleTimer !== null) return;
		const interval = Math.max(throttleMs, lastCost * COST_FACTOR);
		const wait = Math.max(0, lastRender + interval - now());
		throttleTimer = setTimeout(() => {
			throttleTimer = null;
			if (dirty) render();
		}, wait);
	}

	function invalidate() {
		dirty = true;
		schedule();
	}

	listen(doc, true);
	view?.addEventListener("resize", onResize);
	sizeFrames();
	render();
	watchHighlights();

	return {
		invalidate,
		syncScroll,
		setTransform(next: string) {
			transform = next;
			for (const { iframe } of frames) iframe.style.transform = next;
		},
		destroy() {
			destroyed = true;
			observer.disconnect();
			if (throttleTimer !== null) clearTimeout(throttleTimer);
			if (safetyTimer !== null) clearTimeout(safetyTimer);
			if (highlightFrame) view?.cancelAnimationFrame(highlightFrame);
			listen(doc, false);
			for (const root of observedRoots) listen(root, false);
			observedRoots = [];
			view?.removeEventListener("resize", onResize);
			for (const { iframe } of frames) iframe.remove();
		},
	};
}
