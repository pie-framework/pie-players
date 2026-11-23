import { afterEach, describe, expect, mock, test } from "bun:test";
import type { CalculatorType } from "@pie-players/pie-calculator";

/**
 * The live theme, faked at the module the provider reads it through. A theme
 * of `null` is what the reader returns where nothing can be measured, and is
 * the state every other test file in this package sees.
 */
type FakeColors = Record<string, string> | null;
const live: { colors: FakeColors; listeners: Set<() => void> } = {
	colors: null,
	listeners: new Set(),
};
mock.module("@pie-players/pie-theme/theme-observer", () => ({
	readPieElementTheme: (_element: Element, tokens: readonly string[] = []) =>
		live.colors && {
			colorScheme: null,
			colors: Object.fromEntries(
				tokens.flatMap((token) =>
					live.colors?.[token] ? [[token, live.colors[token]]] : [],
				),
			),
		},
	observePieThemeChanges: (listener: () => void) => {
		live.listeners.add(listener);
		return () => live.listeners.delete(listener);
	},
}));

const { GeoGebraCalculatorProvider } = await import(
	"../src/geogebra-provider.js"
);

function switchTheme(colors: FakeColors): void {
	live.colors = colors;
	for (const listener of [...live.listeners]) listener();
}

const DARK = {
	"--pie-border": "#ffff00",
	"--pie-background": "#00004d",
	"--pie-blue-grey-300": "#5c5c8a",
	"--pie-text": "#ffff00",
};
const LIGHT = {
	"--pie-border": "#64748b",
	"--pie-background": "#ffffff",
	"--pie-blue-grey-300": "#c0c3cf",
	"--pie-text": "#0f172a",
};

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

interface Applet {
	parameters: Record<string, unknown>;
	graphics: Array<[number, Record<string, string>]>;
	loadBase64: (callback?: () => void) => void;
}

function installApplets(): Applet[] {
	const applets: Applet[] = [];
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		writable: true,
		value: {
			GGBApplet: class {
				private readonly applet: Applet;
				constructor(parameters: Record<string, unknown>) {
					this.applet = { parameters, graphics: [], loadBase64: () => {} };
					applets.push(this.applet);
				}

				inject() {
					const applet = this.applet;
					(
						applet.parameters.appletOnLoad as (
							api: Record<string, unknown>,
						) => void
					)({
						setGraphicsOptions: (
							view: number,
							options: Record<string, string>,
						) => applet.graphics.push([view, options]),
						newConstruction: () => {},
						setBase64: (_value: string, callback?: () => void) =>
							applet.loadBase64(callback),
						remove: () => {},
					});
				}
			},
		},
	});
	return applets;
}

function fakeContainer(): HTMLElement {
	return {
		id: "",
		clientWidth: 640,
		clientHeight: 480,
		replaceChildren: () => {},
		querySelector: () => null,
	} as unknown as HTMLElement;
}

async function create(
	type: CalculatorType,
	settings?: Record<string, unknown>,
) {
	const provider = new GeoGebraCalculatorProvider();
	await provider.initialize();
	return provider.createCalculator(type, fakeContainer(), { settings });
}

afterEach(() => {
	live.colors = null;
	live.listeners.clear();
	if (originalWindow)
		Object.defineProperty(globalThis, "window", originalWindow);
	else Reflect.deleteProperty(globalThis, "window");
});

describe("GeoGebra follows the theme on its container", () => {
	test("takes its border from --pie-border", async () => {
		const applets = installApplets();
		live.colors = { ...DARK };
		await create("scientific");
		expect(applets[0]?.parameters.borderColor).toBe("#ffff00");
	});

	test("a host border keeps precedence", async () => {
		const applets = installApplets();
		live.colors = { ...DARK };
		await create("graphing", { borderColor: "#123456" });
		expect(applets[0]?.parameters.borderColor).toBe("#123456");
	});

	test("an unmeasurable theme leaves GeoGebra's defaults alone", async () => {
		const applets = installApplets();
		await create("graphing");
		expect(applets[0]?.parameters).not.toHaveProperty("borderColor");
		expect(applets[0]?.graphics).toEqual([]);
	});

	test("paints the graphing view at load", async () => {
		const applets = installApplets();
		live.colors = { ...DARK };
		await create("graphing");
		expect(applets[0]?.graphics).toEqual([
			[1, { bgColor: "#00004d", gridColor: "#5c5c8a", axesColor: "#ffff00" }],
		]);
	});

	test("the scientific app has no graphics view to paint or observe", async () => {
		const applets = installApplets();
		live.colors = { ...DARK };
		await create("scientific");
		await create("basic");
		expect(applets.map((applet) => applet.graphics)).toEqual([[], []]);
		expect(live.listeners.size).toBe(0);
	});
});

describe("GeoGebra re-applies on a scheme change", () => {
	test("repaints the graphing view once per change", async () => {
		const applets = installApplets();
		live.colors = { ...LIGHT };
		await create("graphing");

		switchTheme({ ...DARK });
		switchTheme({ ...DARK });

		expect(applets[0]?.graphics.map(([, options]) => options.bgColor)).toEqual([
			"#ffffff",
			"#00004d",
		]);
	});

	test("repaints after clear() and a restored construction", async () => {
		const applets = installApplets();
		live.colors = { ...DARK };
		const calculator = await create("graphing");
		const applet = applets[0] as Applet;
		let loaded: (() => void) | undefined;
		applet.loadBase64 = (callback) => {
			loaded = callback;
		};

		calculator.clear();
		calculator.importState({
			type: "graphing",
			provider: "geogebra",
			value: "",
			providerState: "encoded",
		});
		expect(applet.graphics).toHaveLength(2);
		loaded?.();
		expect(applet.graphics).toHaveLength(3);
	});

	test("stops following the theme once destroyed", async () => {
		const applets = installApplets();
		live.colors = { ...LIGHT };
		const calculator = await create("graphing");
		expect(live.listeners.size).toBe(1);

		calculator.destroy();
		switchTheme({ ...DARK });

		expect(live.listeners.size).toBe(0);
		expect(applets[0]?.graphics).toHaveLength(1);
	});
});
