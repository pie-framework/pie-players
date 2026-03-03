import { afterEach, describe, expect, test } from "bun:test";
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
});
