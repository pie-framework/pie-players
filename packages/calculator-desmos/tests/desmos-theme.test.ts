import { afterEach, describe, expect, mock, test } from "bun:test";
import type { CalculatorType } from "@pie-players/pie-calculator";

/**
 * The live theme, faked at the module the provider reads it through. A theme
 * of `null` is what the reader returns where nothing can be measured, and is
 * the state every other test file in this package sees.
 */
type FakeTheme = {
	colorScheme: "light" | "dark" | null;
	colors: Record<string, string>;
} | null;
const live: { theme: FakeTheme; listeners: Set<() => void> } = {
	theme: null,
	listeners: new Set(),
};
mock.module("@pie-players/pie-theme/theme-observer", () => ({
	readPieElementTheme: (_element: Element, tokens: readonly string[] = []) =>
		live.theme && {
			colorScheme: live.theme.colorScheme,
			colors: Object.fromEntries(
				tokens.flatMap((token) =>
					live.theme?.colors[token] ? [[token, live.theme.colors[token]]] : [],
				),
			),
		},
	observePieThemeChanges: (listener: () => void) => {
		live.listeners.add(listener);
		return () => live.listeners.delete(listener);
	},
}));

const { DesmosCalculatorProvider } = await import("../src/index.js");

function switchTheme(theme: FakeTheme): void {
	live.theme = theme;
	for (const listener of [...live.listeners]) listener();
}

const DESMOS_COLORS = {
	RED: "#c74440",
	BLUE: "#2d70b3",
	GREEN: "#388c46",
	PURPLE: "#6042a6",
	ORANGE: "#fa7e19",
	BLACK: "#000000",
};

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

interface Constructed {
	type: CalculatorType;
	config: Record<string, unknown>;
	updates: Record<string, unknown>[];
}

function installDesmosStub(): Constructed[] {
	const constructed: Constructed[] = [];
	const capture =
		(type: CalculatorType) =>
		(_container: HTMLElement, config: Record<string, unknown>) => {
			const entry: Constructed = { type, config, updates: [] };
			constructed.push(entry);
			return {
				destroy: () => {},
				updateSettings: (settings: Record<string, unknown>) => {
					entry.updates.push(settings);
				},
			};
		};
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		writable: true,
		value: {
			Desmos: {
				Colors: DESMOS_COLORS,
				FourFunctionCalculator: capture("basic"),
				ScientificCalculator: capture("scientific"),
				GraphingCalculator: capture("graphing"),
			},
		},
	});
	return constructed;
}

async function create(
	type: CalculatorType,
	settings?: Record<string, unknown>,
) {
	const provider = new DesmosCalculatorProvider();
	await provider.initialize();
	const container = { replaceChildren: () => {} } as unknown as HTMLElement;
	return provider.createCalculator(type, container, { settings });
}

afterEach(() => {
	live.theme = null;
	live.listeners.clear();
	if (originalWindow)
		Object.defineProperty(globalThis, "window", originalWindow);
	else Reflect.deleteProperty(globalThis, "window");
});

const DARK = { colorScheme: "dark", colors: {} } as const;
const LIGHT = { colorScheme: "light", colors: {} } as const;

describe("Desmos follows the theme on its container", () => {
	test("a dark background inverts every calculator type", async () => {
		const constructed = installDesmosStub();
		live.theme = { ...DARK };
		for (const type of ["basic", "scientific", "graphing"] as const) {
			await create(type);
		}
		for (const { config } of constructed) {
			expect(config.invertedColors).toBe(true);
			expect(config).not.toHaveProperty("colors");
		}
	});

	test("a light background leaves it uninverted", async () => {
		const constructed = installDesmosStub();
		live.theme = { ...LIGHT };
		await create("scientific");
		expect(constructed[0]?.config.invertedColors).toBe(false);
	});

	test("an unmeasurable theme leaves Desmos's defaults alone", async () => {
		const constructed = installDesmosStub();
		await create("graphing");
		expect(constructed[0]?.config).not.toHaveProperty("invertedColors");
		expect(constructed[0]?.config).not.toHaveProperty("colors");
	});

	test("graphing takes the series tokens as its palette, Desmos's colour in an unset slot", async () => {
		const constructed = installDesmosStub();
		live.theme = {
			colorScheme: "light",
			colors: {
				"--pie-calculator-series-1": "#075985",
				"--pie-calculator-series-3": "#166534",
			},
		};
		await create("graphing");
		await create("basic");

		expect(constructed[0]?.config.colors).toEqual({
			SERIES_1: "#075985",
			SERIES_2: DESMOS_COLORS.BLUE,
			SERIES_3: "#166534",
			SERIES_4: DESMOS_COLORS.PURPLE,
			SERIES_5: DESMOS_COLORS.ORANGE,
			SERIES_6: DESMOS_COLORS.BLACK,
		});
		expect(constructed[1]?.config).not.toHaveProperty("colors");
	});

	test("an inverted calculator keeps Desmos's palette, since Desmos would invert the tokens", async () => {
		const constructed = installDesmosStub();
		live.theme = {
			colorScheme: "dark",
			colors: { "--pie-calculator-series-1": "#7dd3fc" },
		};
		await create("graphing");
		expect(constructed[0]?.config).not.toHaveProperty("colors");
	});

	test("host settings keep precedence, at creation and on every switch", async () => {
		const constructed = installDesmosStub();
		live.theme = {
			colorScheme: "dark",
			colors: { "--pie-calculator-series-1": "#7dd3fc" },
		};
		const hostColors = { MINE: "#123456" };
		await create("graphing", { invertedColors: false, colors: hostColors });

		expect(constructed[0]?.config.invertedColors).toBe(false);
		expect(constructed[0]?.config.colors).toEqual(hostColors);

		switchTheme({ colorScheme: "light", colors: {} });
		switchTheme({ ...DARK });
		expect(constructed[0]?.updates).toEqual([]);
	});
});

describe("Desmos re-applies on a scheme change", () => {
	test("updates only what changed, once per change", async () => {
		const constructed = installDesmosStub();
		live.theme = { ...LIGHT };
		await create("scientific");

		switchTheme({ ...DARK });
		switchTheme({ ...DARK });
		switchTheme({ ...LIGHT });

		expect(constructed[0]?.updates).toEqual([
			{ invertedColors: true },
			{ invertedColors: false },
		]);
	});

	test("drops the token palette for Desmos's own when the calculator inverts", async () => {
		const constructed = installDesmosStub();
		const series = { "--pie-calculator-series-1": "#075985" };
		live.theme = { colorScheme: "light", colors: series };
		await create("graphing");

		switchTheme({ colorScheme: "dark", colors: series });

		expect(constructed[0]?.updates).toEqual([
			{ invertedColors: true, colors: DESMOS_COLORS },
		]);
	});

	test("ignores a notification it cannot measure", async () => {
		const constructed = installDesmosStub();
		live.theme = { ...DARK };
		await create("basic");

		switchTheme(null);

		expect(constructed[0]?.updates).toEqual([]);
	});

	test("stops following the theme once destroyed", async () => {
		const constructed = installDesmosStub();
		live.theme = { ...LIGHT };
		const calculator = await create("basic");
		expect(live.listeners.size).toBe(1);

		calculator.destroy();
		switchTheme({ ...DARK });

		expect(live.listeners.size).toBe(0);
		expect(constructed[0]?.updates).toEqual([]);
	});
});
