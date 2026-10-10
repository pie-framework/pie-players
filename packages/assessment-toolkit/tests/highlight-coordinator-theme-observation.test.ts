import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import { HighlightCoordinator } from "../src/services/HighlightCoordinator";

class MockHighlight {
	add(_range: Range): void {}
	clear(): void {}
	delete(_range: Range): boolean {
		return true;
	}
}

const STUBBED_GLOBALS = ["CSS", "Highlight", "getComputedStyle"] as const;
let originalDescriptors = new Map<string, PropertyDescriptor | undefined>();
const stubGlobal = (name: string, value: unknown) => {
	Object.defineProperty(globalThis, name, {
		value,
		configurable: true,
		writable: true,
	});
};

// The page background the theme resolves to, as computed style reports it.
let pageBackground = "#ffffff";
const coordinators: HighlightCoordinator[] = [];
const coordinator = () => {
	const created = new HighlightCoordinator();
	coordinators.push(created);
	return created;
};
const ownsDom = !GlobalRegistrator.isRegistered;

beforeAll(() => {
	if (ownsDom) GlobalRegistrator.register();
});

afterAll(() => {
	if (ownsDom) GlobalRegistrator.unregister();
});

beforeEach(() => {
	originalDescriptors = new Map(
		STUBBED_GLOBALS.map((name) => [
			name,
			Object.getOwnPropertyDescriptor(globalThis, name),
		]),
	);
	stubGlobal("CSS", { highlights: new Map() });
	stubGlobal("Highlight", MockHighlight);
	stubGlobal("getComputedStyle", () => ({
		backgroundColor: "",
		getPropertyValue: (name: string) =>
			name === "--pie-background" ? pageBackground : "",
	}));
	pageBackground = "#ffffff";
});

afterEach(() => {
	for (const created of coordinators.splice(0)) created.destroy();
	for (const [name, descriptor] of originalDescriptors) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else delete (globalThis as Record<string, unknown>)[name];
	}
	document.body.replaceChildren();
	document.documentElement.style.removeProperty("--pie-tts-word-highlight");
});

const wordHighlight = () =>
	document.documentElement.style.getPropertyValue("--pie-tts-word-highlight");
const mutationsDelivered = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("HighlightCoordinator theme observation", () => {
	test("re-adapts when a pie-theme mounts after it, and when that theme changes", async () => {
		coordinator();
		const light = wordHighlight();

		pageBackground = "#111111";
		const theme = document.createElement("pie-theme");
		document.body.append(theme);
		await mutationsDelivered();
		const dark = wordHighlight();
		expect(dark).not.toBe(light);

		pageBackground = "#ffffff";
		theme.setAttribute("theme", "light");
		await mutationsDelivered();
		expect(wordHighlight()).toBe(light);
	});

	test("finds a pie-theme nested in mounted content", async () => {
		coordinator();
		const wrapper = document.createElement("div");
		const theme = document.createElement("pie-theme");
		wrapper.append(theme);
		document.body.append(wrapper);
		await mutationsDelivered();
		const light = wordHighlight();

		pageBackground = "#111111";
		theme.setAttribute("theme", "dark");
		await mutationsDelivered();
		expect(wordHighlight()).not.toBe(light);
	});

	test("stops observing once destroyed", async () => {
		const highlights = coordinator();
		const theme = document.createElement("pie-theme");
		document.body.append(theme);
		await mutationsDelivered();
		const before = wordHighlight();
		highlights.destroy();

		pageBackground = "#111111";
		theme.setAttribute("theme", "dark");
		document.body.append(document.createElement("pie-theme"));
		document.documentElement.setAttribute("data-theme", "dark");
		await mutationsDelivered();
		expect(wordHighlight()).toBe(before);
		document.documentElement.removeAttribute("data-theme");
	});
});
