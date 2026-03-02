import { afterEach, describe, expect, test } from "bun:test";
import {
	collectVisibleTextAndMap,
	isElementHiddenForTTS,
	normalizeTextForSpeech,
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
	} as unknown as Element);

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
