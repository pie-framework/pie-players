import { afterEach, describe, expect, test } from "bun:test";
import {
	collectVisibleTextAndMap,
	isElementHiddenForTTS,
	isElementSuppressedForTTS,
	isNodeExcludedFromSpeech,
	isNodeSuppressedForTTS,
	normalizeTextForSpeech,
	TTS_SUPPRESS_ATTRIBUTE,
} from "../src/services/tts/text-processing";

const originalDocument = (globalThis as any).document;
const originalNodeFilter = (globalThis as any).NodeFilter;
const originalWindow = (globalThis as any).window;

const makeElement = (attrs: {
	hidden?: boolean;
	ariaHidden?: string;
	inert?: boolean;
	classes?: string[];
}) =>
	({
		hidden: attrs.hidden || false,
		getAttribute: (name: string) =>
			name === "aria-hidden" ? attrs.ariaHidden || null : null,
		hasAttribute: (name: string) => (name === "inert" ? !!attrs.inert : false),
		classList: {
			contains: (value: string) => (attrs.classes || []).includes(value),
		},
	}) as unknown as Element;

describe("tts text-processing", () => {
	afterEach(() => {
		(globalThis as any).document = originalDocument;
		(globalThis as any).NodeFilter = originalNodeFilter;
		(globalThis as any).window = originalWindow;
	});

	test("normalizes whitespace consistently", () => {
		expect(normalizeTextForSpeech("  A\n\nB\t C  ")).toBe("A B C");
	});

	test("excludes hidden helper content from visible extraction", () => {
		const visibleParent = makeElement({});
		const hiddenParent = makeElement({ ariaHidden: "true" });
		const nodes = [
			{
				textContent: "Multiple ",
				parentElement: visibleParent,
			},
			{
				textContent: "choice ",
				parentElement: hiddenParent,
			},
			{
				textContent: "question",
				parentElement: visibleParent,
			},
		];
		let idx = 0;
		(globalThis as any).NodeFilter = { SHOW_TEXT: 4 };
		(globalThis as any).document = {
			createTreeWalker: () => ({
				nextNode: () => (idx < nodes.length ? nodes[idx++] : null),
			}),
		};
		(globalThis as any).window = undefined;

		const { text } = collectVisibleTextAndMap({} as Element);
		expect(text).toBe("Multiple question");
	});

	test("inserts boundary spacing for glued alphanumeric node edges", () => {
		const parent = makeElement({});
		const nodes = [
			{ textContent: "dioxid", parentElement: parent },
			{ textContent: "eB", parentElement: parent },
			{ textContent: "oxygen", parentElement: parent },
		];
		let idx = 0;
		(globalThis as any).NodeFilter = { SHOW_TEXT: 4 };
		(globalThis as any).document = {
			createTreeWalker: () => ({
				nextNode: () => (idx < nodes.length ? nodes[idx++] : null),
			}),
		};
		(globalThis as any).window = undefined;

		const { text } = collectVisibleTextAndMap({} as Element, {
			boundarySpacingMode: "alnum",
		});
		expect(text).toBe("dioxid eB oxygen");
	});

	test("marks visually hidden class names as hidden", () => {
		(globalThis as any).window = undefined;
		expect(isElementHiddenForTTS(makeElement({ classes: ["sr-only"] }))).toBe(
			true,
		);
	});
});

const makeSuppressElement = (value: string | null) =>
	({
		hidden: false,
		getAttribute: (name: string) =>
			name === TTS_SUPPRESS_ATTRIBUTE ? value : null,
		hasAttribute: () => false,
		classList: { contains: () => false },
	}) as unknown as Element;

const captureWarnings = async (run: () => void | Promise<void>) => {
	const warnings: string[] = [];
	const original = console.warn;
	console.warn = (...args: unknown[]) => {
		warnings.push(args.map(String).join(" "));
	};
	try {
		await run();
	} finally {
		console.warn = original;
	}
	return warnings;
};

describe("read-aloud suppression", () => {
	afterEach(() => {
		(globalThis as any).document = originalDocument;
		(globalThis as any).NodeFilter = originalNodeFilter;
		(globalThis as any).window = originalWindow;
	});

	test("suppresses machine read-aloud for the values that name it", () => {
		(globalThis as any).window = undefined;
		expect(
			isElementSuppressedForTTS(makeSuppressElement("computer-read-aloud")),
		).toBe(true);
		expect(isElementSuppressedForTTS(makeSuppressElement("all"))).toBe(true);
		expect(isElementSuppressedForTTS(makeSuppressElement("  ALL  "))).toBe(
			true,
		);
	});

	test("leaves content speakable when only assistive technology is suppressed", () => {
		(globalThis as any).window = undefined;
		// `screen-reader` asks the host to hide the node from AT. It says nothing
		// about machine read-aloud, so TTS still speaks it.
		expect(
			isElementSuppressedForTTS(makeSuppressElement("screen-reader")),
		).toBe(false);
	});

	test("ignores the attribute when it is absent", () => {
		(globalThis as any).window = undefined;
		expect(isElementSuppressedForTTS(makeSuppressElement(null))).toBe(false);
	});

	test("fails closed on a value it does not recognize, and says why once", async () => {
		(globalThis as any).window = undefined;
		const warnings = await captureWarnings(() => {
			expect(
				isElementSuppressedForTTS(makeSuppressElement("computer-readaloud")),
			).toBe(true);
			// Second call, same value: already reported.
			expect(
				isElementSuppressedForTTS(makeSuppressElement("computer-readaloud")),
			).toBe(true);
		});
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("computer-readaloud");
	});

	test("treats a valueless attribute as full suppression", async () => {
		(globalThis as any).window = undefined;
		const warnings = await captureWarnings(() => {
			expect(isElementSuppressedForTTS(makeSuppressElement(""))).toBe(true);
		});
		expect(warnings).toHaveLength(1);
	});

	test("suppression is inherited by descendants", () => {
		(globalThis as any).window = undefined;
		const suppressed = makeSuppressElement("all");
		const child = {
			nodeType: 1,
			hidden: false,
			getAttribute: () => null,
			hasAttribute: () => false,
			classList: { contains: () => false },
			parentElement: suppressed,
		} as unknown as Element;
		expect(isNodeSuppressedForTTS(child)).toBe(true);
		expect(isNodeExcludedFromSpeech(child)).toBe(true);
	});

	test("drops suppressed text from collected speech text", () => {
		const visibleParent = makeSuppressElement(null);
		const suppressedParent = makeSuppressElement("all");
		const nodes = [
			{ textContent: "Which word rhymes with ", parentElement: visibleParent },
			{ textContent: "cake", parentElement: suppressedParent },
			{ textContent: " ?", parentElement: visibleParent },
		];
		let idx = 0;
		(globalThis as any).NodeFilter = { SHOW_TEXT: 4 };
		(globalThis as any).document = {
			createTreeWalker: () => ({
				nextNode: () => (idx < nodes.length ? nodes[idx++] : null),
			}),
		};
		(globalThis as any).window = undefined;

		const { text } = collectVisibleTextAndMap({} as Element);
		expect(text).toBe("Which word rhymes with ?");
	});
});
