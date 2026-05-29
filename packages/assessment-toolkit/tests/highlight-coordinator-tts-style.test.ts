import { afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { HighlightCoordinator } from "../src/services/HighlightCoordinator";

class MockHighlight {
	add(_range: Range): void {}
	clear(): void {}
	delete(_range: Range): boolean {
		return true;
	}
}

const originalCSS = (globalThis as any).CSS;
const originalHighlight = (globalThis as any).Highlight;
const originalDocument = (globalThis as any).document;
const originalGetComputedStyle = (globalThis as any).getComputedStyle;
const originalMutationObserver = (globalThis as any).MutationObserver;

function setupHighlightDom() {
	const styleStore = new Map<string, any>();
	const rootVars = new Map<string, string>();
	const highlights = new Map<string, unknown>();

	(globalThis as any).CSS = { highlights };
	(globalThis as any).Highlight = MockHighlight;
	(globalThis as any).MutationObserver = undefined;
	const mockDocument = {
		createElement: () => {
			const styleEl = {
				id: "",
				textContent: "",
				style: { color: "" },
				remove() {
					if (this.id) {
						styleStore.delete(this.id);
					}
				},
			};
			return styleEl;
		},
		getElementById: (id: string) => styleStore.get(id) ?? null,
		head: {
			appendChild: (el: any) => {
				if (el?.id) {
					styleStore.set(el.id, el);
				}
			},
		},
		querySelectorAll: () => [],
		documentElement: {
			style: {
				setProperty: (key: string, value: string) => {
					rootVars.set(key, value);
				},
			},
		},
	};
	(globalThis as any).document = mockDocument;

	return { styleStore, rootVars, mockDocument };
}

afterEach(() => {
	(globalThis as any).CSS = originalCSS;
	(globalThis as any).Highlight = originalHighlight;
	(globalThis as any).document = originalDocument;
	(globalThis as any).getComputedStyle = originalGetComputedStyle;
	(globalThis as any).MutationObserver = originalMutationObserver;
});

describe("HighlightCoordinator TTS style contrast", () => {
	test("registers strong adaptive TTS highlight rules", () => {
		const { styleStore } = setupHighlightDom();
		new HighlightCoordinator();

		const styleEl = styleStore.get("pie-highlight-styles");
		expect(styleEl).toBeTruthy();
		expect(styleEl.textContent).toContain("--pie-tts-word-highlight");
		expect(styleEl.textContent).toContain("--pie-tts-word-underline");
		expect(styleEl.textContent).toContain("--pie-tts-word-shadow");
		expect(styleEl.textContent).toContain("--pie-tts-sentence-highlight");
		expect(styleEl.textContent).toContain("--pie-tts-line-highlight");
		expect(styleEl.textContent).toContain("data-pie-tts-sentence-element");
		expect(styleEl.textContent).toContain("data-pie-tts-word-element");
		expect(styleEl.textContent).toContain("border-bottom: 2px solid var(--pie-tts-word-underline");
	});

	test("updates all tts contrast variables from custom color", () => {
		const { rootVars } = setupHighlightDom();
		const coordinator = new HighlightCoordinator();

		coordinator.updateTTSHighlightStyle("#ffcc00", 0.3);

		expect(rootVars.get("--pie-tts-word-highlight")).toBe(
			"rgba(255, 204, 0, 0.3)",
		);
		expect(rootVars.get("--pie-tts-sentence-highlight")).toBe(
			"rgba(255, 204, 0, 0.24)",
		);
		expect(rootVars.get("--pie-tts-line-highlight")).toBe(
			rootVars.get("--pie-tts-sentence-highlight"),
		);
		expect(rootVars.get("--pie-tts-word-underline")).toBe(
			"rgba(17, 24, 39, 0.55)",
		);
		expect(rootVars.get("--pie-tts-word-shadow")).toBe(
			"rgba(17, 24, 39, 0.22)",
		);
	});

	test("falls back to high-contrast underline in low-contrast theme colors", () => {
		const { rootVars } = setupHighlightDom();
		(globalThis as any).getComputedStyle = () =>
			({
				getPropertyValue: (name: string) => {
					if (name === "--pie-background") return "#fffaf0";
					if (name === "--pie-text") return "#f5f5f5";
					if (name === "--pie-missing") return "#fff7b3";
					return "";
				},
			}) as CSSStyleDeclaration;

		new HighlightCoordinator();

		expect(rootVars.get("--pie-tts-word-highlight")).toContain("rgba(255, 247, 179,");
		expect(rootVars.get("--pie-tts-word-underline")).toContain("rgba(0, 0, 0,");
	});

	test("does not recurse infinitely on unresolved computed color syntax", () => {
		const { mockDocument } = setupHighlightDom();
		(globalThis as any).getComputedStyle = (el: unknown) => {
			if (el !== mockDocument.documentElement) {
				return { color: "oklch(0.72 0.13 95)" } as CSSStyleDeclaration;
			}
			return {
				getPropertyValue: (name: string) => {
					if (name === "--pie-background") return "#ffffff";
					if (name === "--pie-text") return "#111827";
					if (name === "--pie-missing") return "oklch(0.72 0.13 95)";
					return "";
				},
			} as CSSStyleDeclaration;
		};

		expect(() => new HighlightCoordinator()).not.toThrow();
	});

	test("marks MathML islands for coarse TTS region highlighting", () => {
		if (!GlobalRegistrator.isRegistered) {
			GlobalRegistrator.register();
		}
		try {
			Object.defineProperty(globalThis, "CSS", {
				value: { highlights: new Map() },
				configurable: true,
			});
			Object.defineProperty(globalThis, "Highlight", {
				value: MockHighlight,
				configurable: true,
			});
			Object.defineProperty(globalThis, "MutationObserver", {
				value: undefined,
				configurable: true,
			});
			const coordinator = new HighlightCoordinator();
			const root = document.createElement("div");
			root.innerHTML = `
				<span>solve</span>
				<math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mi>x</mi><mn>2</mn></msup></math>
			`;
			document.body.appendChild(root);
			const math = root.querySelector("math");
			const range = document.createRange();
			range.selectNodeContents(root);

			coordinator.highlightTTSSentence([range]);

			expect(math?.getAttribute("data-pie-tts-sentence-element")).toBe("true");
			coordinator.clearTTSSentence();
			expect(math?.hasAttribute("data-pie-tts-sentence-element")).toBe(false);
			root.remove();
		} finally {
			if (GlobalRegistrator.isRegistered) {
				GlobalRegistrator.unregister();
			}
		}
	});

	test("does NOT escalate a TTS word range to the enclosing MathJax container", () => {
		if (!GlobalRegistrator.isRegistered) {
			GlobalRegistrator.register();
		}
		try {
			Object.defineProperty(globalThis, "CSS", {
				value: { highlights: new Map() },
				configurable: true,
			});
			Object.defineProperty(globalThis, "Highlight", {
				value: MockHighlight,
				configurable: true,
			});
			Object.defineProperty(globalThis, "MutationObserver", {
				value: undefined,
				configurable: true,
			});
			const coordinator = new HighlightCoordinator();
			const root = document.createElement("div");
			root.innerHTML = `
				<mjx-container>
					<mjx-assistive-mml>
						<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>
					</mjx-assistive-mml>
				</mjx-container>
			`;
			document.body.appendChild(root);
			const math = root.querySelector("math");
			const container = root.querySelector("mjx-container");
			const range = document.createRange();
			range.selectNodeContents(math!);

			coordinator.highlightRange(range, "tts-word" as any);

			// The word layer must never paint the whole equation: escalating a
			// multi-node word range to the <mjx-container> is the whole-expression
			// flash we removed. Math is tracked per token by the pipeline; the word
			// fallback selector only covers replaced elements (svg/img/canvas).
			expect(container?.hasAttribute("data-pie-tts-word-element")).toBe(false);
			root.remove();
		} finally {
			if (GlobalRegistrator.isRegistered) {
				GlobalRegistrator.unregister();
			}
		}
	});

	test("highlightTTSWordElement marks exactly the token, never the enclosing expression", () => {
		if (!GlobalRegistrator.isRegistered) {
			GlobalRegistrator.register();
		}
		try {
			Object.defineProperty(globalThis, "CSS", {
				value: { highlights: new Map() },
				configurable: true,
			});
			Object.defineProperty(globalThis, "Highlight", {
				value: MockHighlight,
				configurable: true,
			});
			Object.defineProperty(globalThis, "MutationObserver", {
				value: undefined,
				configurable: true,
			});
			const coordinator = new HighlightCoordinator();
			const root = document.createElement("div");
			// MathJax CHTML: tokens wrap a font-driven <mjx-c>, never a text node.
			root.innerHTML = `
				<mjx-container>
					<mjx-math aria-hidden="true"><mjx-mi><mjx-c></mjx-c></mjx-mi><mjx-mo><mjx-c></mjx-c></mjx-mo><mjx-mn><mjx-c></mjx-c></mjx-mn></mjx-math>
				</mjx-container>
			`;
			document.body.appendChild(root);
			const container = root.querySelector("mjx-container")!;
			const firstToken = root.querySelector("mjx-mi")!;
			const operator = root.querySelector("mjx-mo")!;

			coordinator.highlightTTSWordElement(operator);

			// The resolved token is painted...
			expect(operator.getAttribute("data-pie-tts-word-element")).toBe("true");
			// ...and crucially the whole expression is NOT escalated. This is the
			// regression: MathJax math used to highlight as a full block because the
			// active token escalated up to its <mjx-container>.
			expect(container.hasAttribute("data-pie-tts-word-element")).toBe(false);

			// Advancing to the next token clears the previous token mark.
			coordinator.highlightTTSWordElement(firstToken);
			expect(operator.hasAttribute("data-pie-tts-word-element")).toBe(false);
			expect(firstToken.getAttribute("data-pie-tts-word-element")).toBe("true");
			expect(container.hasAttribute("data-pie-tts-word-element")).toBe(false);

			coordinator.clearTTSWord();
			expect(firstToken.hasAttribute("data-pie-tts-word-element")).toBe(false);
			root.remove();
		} finally {
			if (GlobalRegistrator.isRegistered) {
				GlobalRegistrator.unregister();
			}
		}
	});
});
