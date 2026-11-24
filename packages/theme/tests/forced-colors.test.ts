import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";

import { resolvePieTheme } from "../src/color-schemes.js";
import {
	getBaseThemeVariables,
	getForcedColorsVariables,
	listBuiltInColorSchemeDefinitions,
} from "../src/theme-definitions.js";
import type { PieThemeElement } from "../src/theme-element.js";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();
const { PieThemeElement: ThemeElement } = await import(
	"../src/theme-element.js"
);

const TEST_TAG = "pie-theme-forced-colors-test";
const FORCED_COLORS_QUERY = "(forced-colors: active)";

/** The map by role, written out so a token moving role or leaving shows up here. */
const EXPECTED_MAP = {
	"--pie-button-focus-outline": "Highlight",
	"--pie-focus-keyboard-outline": "Highlight",
	"--pie-focus-checked-border": "Highlight",
	"--pie-border": "CanvasText",
	"--pie-border-light": "CanvasText",
	"--pie-border-dark": "CanvasText",
	"--pie-border-gray": "CanvasText",
	"--pie-button-border": "CanvasText",
	"--pie-button-hover-border": "CanvasText",
	"--pie-focus-unchecked-border": "CanvasText",
	"--pie-tool-annotation-toolbar-border": "CanvasText",
	"--pie-annotation-underline": "CanvasText",
	"--pie-annotation-underline-dark": "CanvasText",
	"--pie-disabled": "GrayText",
	"--pie-disabled-secondary": "GrayText",
	"--pie-disabled-text": "GrayText",
};
const MAPPED = Object.entries(EXPECTED_MAP);

const SCHEME_IDS = listBuiltInColorSchemeDefinitions().map(
	(scheme) => scheme.id,
);

const GENERATED_CSS = [
	await Bun.file(new URL("../src/tokens.css", import.meta.url)).text(),
	await Bun.file(new URL("../src/color-schemes.css", import.meta.url)).text(),
].join("\n");

/** A forced-colors query the test switches, with the listeners it was given. */
function installForcedColors(initial: boolean) {
	const original = Object.getOwnPropertyDescriptor(window, "matchMedia");
	const listeners = new Set<EventListener>();
	const forced = {
		matches: initial,
		media: FORCED_COLORS_QUERY,
		onchange: null,
		addEventListener: (_type: string, listener: EventListener) => {
			listeners.add(listener);
		},
		removeEventListener: (_type: string, listener: EventListener) => {
			listeners.delete(listener);
		},
		addListener() {},
		removeListener() {},
		dispatchEvent: () => true,
	};
	const other = (query: string) => ({
		...forced,
		matches: false,
		media: query,
		addEventListener() {},
		removeEventListener() {},
	});
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: (query: string) =>
			(query === FORCED_COLORS_QUERY ? forced : other(query)) as MediaQueryList,
	});
	return {
		listeners,
		set(matches: boolean) {
			forced.matches = matches;
			for (const listener of [...listeners]) {
				listener({
					matches,
					media: FORCED_COLORS_QUERY,
				} as MediaQueryListEvent);
			}
		},
		restore() {
			if (original) Object.defineProperty(window, "matchMedia", original);
			else Reflect.deleteProperty(window, "matchMedia");
		},
	};
}

let media: ReturnType<typeof installForcedColors> | null = null;

function mount(attributes: Record<string, string>): PieThemeElement {
	const element = document.createElement(TEST_TAG) as PieThemeElement;
	for (const [name, value] of Object.entries(attributes)) {
		element.setAttribute(name, value);
	}
	document.body.append(element);
	return element;
}

function inlineTokens(target: HTMLElement): Record<string, string> {
	const tokens: Record<string, string> = {};
	for (let index = 0; index < target.style.length; index++) {
		const name = target.style.item(index);
		if (name.startsWith("--pie-")) {
			tokens[name] = target.style.getPropertyValue(name);
		}
	}
	return tokens;
}

beforeAll(() => {
	// A subclass, since a constructor defines one tag per registry and other
	// files in the run define `PieThemeElement` itself.
	customElements.define(TEST_TAG, class extends ThemeElement {});
});

afterAll(() => {
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

afterEach(() => {
	document.body.replaceChildren();
	media?.restore();
	media = null;
});

describe("forced-colours token map", () => {
	test("maps the state tokens by role, and only Base Theme tokens", () => {
		expect({ ...getForcedColorsVariables() }).toEqual(EXPECTED_MAP);
		for (const token of Object.keys(EXPECTED_MAP)) {
			expect(getBaseThemeVariables("light")).toHaveProperty(token);
			expect(getBaseThemeVariables("dark")).toHaveProperty(token);
		}
	});
});

describe("<pie-theme> under forced colours", () => {
	test.each(["default", ...SCHEME_IDS])(
		"resolves every mapped token to its system colour over %s and variables",
		(scheme) => {
			media = installForcedColors(true);
			const element = mount({
				theme: "dark",
				scheme,
				provider: "none",
				variables: JSON.stringify({
					"--pie-disabled": "#123456",
					"--pie-secondary": "#654321",
				}),
			});
			const tokens = inlineTokens(element);
			for (const [token, systemColor] of MAPPED) {
				expect(tokens[token], token).toBe(systemColor);
			}
			// Tokens outside the map keep the resolved value, `variables` included.
			expect(tokens["--pie-secondary"]).toBe("#654321");
		},
	);

	test("writes the map to the document root under document scope", () => {
		media = installForcedColors(true);
		mount({ scope: "document", scheme: "yellow-on-blue", provider: "none" });
		const tokens = inlineTokens(document.documentElement);
		for (const [token, systemColor] of MAPPED) {
			expect(tokens[token], token).toBe(systemColor);
		}
		document.body.replaceChildren();
		expect(inlineTokens(document.documentElement)).toEqual({});
	});

	test("updates an existing node when forced colours turn on and off", () => {
		media = installForcedColors(false);
		const element = mount({ scheme: "black-on-rose", provider: "none" });
		const resolved = resolvePieTheme({
			baseTheme: "light",
			requestedScheme: "black-on-rose",
		}).variables;
		expect(inlineTokens(element)).toEqual({ ...resolved });

		media.set(true);
		expect(element.isConnected).toBe(true);
		for (const [token, systemColor] of MAPPED) {
			expect(element.style.getPropertyValue(token), token).toBe(systemColor);
		}

		media.set(false);
		expect(inlineTokens(element)).toEqual({ ...resolved });
	});

	test("stops listening on disconnect and listens again on reconnect", () => {
		media = installForcedColors(false);
		const element = mount({ provider: "none" });
		expect(media.listeners.size).toBe(1);
		element.remove();
		expect(media.listeners.size).toBe(0);
		document.body.append(element);
		expect(media.listeners.size).toBe(1);
	});

	test.each(["light", "dark"] as const)(
		"changes no token outside forced colours under the %s base theme and every scheme",
		(theme) => {
			media = installForcedColors(false);
			for (const scheme of ["default", ...SCHEME_IDS]) {
				const element = mount({ theme, scheme, provider: "none" });
				expect(inlineTokens(element), scheme).toEqual({
					...resolvePieTheme({ baseTheme: theme, requestedScheme: scheme })
						.variables,
				});
				element.remove();
			}
		},
	);
});

describe("tokens.css under forced colours", () => {
	const device = () =>
		(
			window as unknown as {
				happyDOM: { settings: { device: { forcedColors: string } } };
			}
		).happyDOM.settings.device;

	/** Each element a generated rule declares tokens on, with its own values. */
	function declaringElements(): Array<{
		label: string;
		element: HTMLElement;
		declared: Readonly<Record<string, string>>;
	}> {
		const style = document.createElement("style");
		style.textContent = GENERATED_CSS;
		document.body.append(style);
		const withAttribute = (name: string, value: string) => {
			const element = document.createElement("div");
			element.setAttribute(name, value);
			document.body.append(element);
			return element;
		};
		return [
			{
				label: ":root",
				element: document.documentElement,
				declared: getBaseThemeVariables("light"),
			},
			{
				label: "dark Base Theme",
				element: withAttribute("data-theme", "dark"),
				declared: getBaseThemeVariables("dark"),
			},
			...listBuiltInColorSchemeDefinitions().map((scheme) => ({
				label: scheme.id,
				element: withAttribute("data-color-scheme", scheme.id),
				declared: scheme.variables,
			})),
		];
	}

	afterEach(() => {
		device().forcedColors = "none";
	});

	test("resolves every mapped token to its system colour on every generated rule", () => {
		device().forcedColors = "active";
		for (const { label, element } of declaringElements()) {
			const computed = getComputedStyle(element);
			for (const [token, systemColor] of MAPPED) {
				expect(
					computed.getPropertyValue(token).trim(),
					`${label} ${token}`,
				).toBe(systemColor);
			}
		}
	});

	test("changes no token outside forced colours", () => {
		device().forcedColors = "none";
		for (const { label, element, declared } of declaringElements()) {
			const computed = getComputedStyle(element);
			for (const [token, value] of Object.entries(declared)) {
				// A scheme value naming another token computes to that token's value.
				const reference = /^var\((--pie-[a-z0-9-]+)\)$/.exec(value)?.[1];
				expect(
					computed.getPropertyValue(token).trim(),
					`${label} ${token}`,
				).toBe(reference ? declared[reference] : value);
			}
		}
	});
});
