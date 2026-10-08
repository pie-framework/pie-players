import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";
import { HighlightCoordinator } from "../src/services/HighlightCoordinator";

class MockHighlight {
	readonly ranges = new Set<Range>();
	add(range: Range): void {
		this.ranges.add(range);
	}
	clear(): void {
		this.ranges.clear();
	}
	delete(range: Range): boolean {
		return this.ranges.delete(range);
	}
}

const SHEET_SLOT = Symbol.for(
	"@pie-players/pie-assessment-toolkit/highlight-stylesheet",
);

// Restored after the file: test files share one process, and later ones assign
// these globals.
const STUBBED_GLOBALS = ["CSS", "Highlight"] as const;
const originalDescriptors = new Map<string, PropertyDescriptor | undefined>();

beforeAll(() => {
	if (!GlobalRegistrator.isRegistered) {
		GlobalRegistrator.register();
	}
	for (const name of STUBBED_GLOBALS) {
		originalDescriptors.set(
			name,
			Object.getOwnPropertyDescriptor(globalThis, name),
		);
	}
	Object.defineProperty(globalThis, "CSS", {
		value: { highlights: new Map() },
		configurable: true,
		writable: true,
	});
	Object.defineProperty(globalThis, "Highlight", {
		value: MockHighlight,
		configurable: true,
		writable: true,
	});
});

afterAll(() => {
	for (const name of STUBBED_GLOBALS) {
		const descriptor = originalDescriptors.get(name);
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else delete (globalThis as Record<string, unknown>)[name];
	}
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

afterEach(() => {
	document.body.innerHTML = "";
	delete (globalThis as unknown as Record<symbol, unknown>)[SHEET_SLOT];
});

const shadowText = (): { root: ShadowRoot; text: Text } => {
	const host = document.createElement("div");
	document.body.appendChild(host);
	const root = host.attachShadow({ mode: "open" });
	root.innerHTML = "<p>shadow words</p>";
	return { root, text: root.querySelector("p")?.firstChild as Text };
};

describe("highlight styles in shadow roots", () => {
	test("appends the shared sheet to a shadow root once, after the root's own sheets", () => {
		const { root, text } = shadowText();
		const own = new CSSStyleSheet();
		root.adoptedStyleSheets = [own];
		const coordinator = new HighlightCoordinator();

		coordinator.highlightTTSWord(text, 0, 6);
		coordinator.highlightTTSWord(text, 7, 12);

		expect(root.adoptedStyleSheets).toHaveLength(2);
		expect(root.adoptedStyleSheets[0]).toBe(own);
		expect(root.adoptedStyleSheets[1]).toBe(
			(globalThis as unknown as Record<symbol, CSSStyleSheet>)[SHEET_SLOT],
		);
		coordinator.destroy();
	});

	test("shares one sheet across shadow roots and coordinators", () => {
		const first = shadowText();
		const second = shadowText();
		const one = new HighlightCoordinator();
		const two = new HighlightCoordinator();

		one.highlightTTSWord(first.text, 0, 6);
		const range = document.createRange();
		range.selectNodeContents(second.text);
		two.highlightTTSSentence([range]);

		expect(first.root.adoptedStyleSheets).toHaveLength(1);
		expect(second.root.adoptedStyleSheets[0]).toBe(
			first.root.adoptedStyleSheets[0],
		);
		one.destroy();
		two.destroy();
	});

	test("adopts again when the root's owner replaced its sheets", () => {
		const { root, text } = shadowText();
		const coordinator = new HighlightCoordinator();
		coordinator.highlightTTSWord(text, 0, 6);
		const replacement = new CSSStyleSheet();
		root.adoptedStyleSheets = [replacement];

		coordinator.highlightTTSWord(text, 0, 6);

		expect(root.adoptedStyleSheets).toHaveLength(2);
		expect(root.adoptedStyleSheets[0]).toBe(replacement);
		coordinator.destroy();
	});

	test("adopts nothing for light-tree content", () => {
		document.body.innerHTML = "<p>light words</p>";
		const text = document.querySelector("p")?.firstChild as Text;
		const coordinator = new HighlightCoordinator();

		coordinator.highlightTTSWord(text, 0, 5);

		expect(document.adoptedStyleSheets ?? []).toHaveLength(0);
		expect(
			(globalThis as unknown as Record<symbol, unknown>)[SHEET_SLOT],
		).toBeUndefined();
		coordinator.destroy();
	});
});
