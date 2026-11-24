import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	spyOn,
	test,
} from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();
const { observePieThemeChanges, readPieElementTheme } = await import(
	"../src/theme-observer.js"
);

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterAll(() => {
	if (ownsDom) GlobalRegistrator.unregister();
});

describe("observePieThemeChanges", () => {
	const cleanups: Array<() => void> = [];
	afterEach(() => {
		for (const cleanup of cleanups.splice(0)) cleanup();
		document.body.replaceChildren();
		document.documentElement.removeAttribute("data-color-scheme");
	});

	function observe(): { calls: () => number } {
		let count = 0;
		cleanups.push(observePieThemeChanges(() => count++));
		return { calls: () => count };
	}

	test("fires on a scheme change on a mounted <pie-theme>", async () => {
		const host = document.createElement("pie-theme");
		document.body.append(host);
		const listener = observe();

		host.setAttribute("scheme", "yellow-on-blue");
		await settle();

		expect(listener.calls()).toBe(1);
	});

	test("fires when a <pie-theme> mounts, then follows its attributes", async () => {
		const listener = observe();
		const host = document.createElement("pie-theme");
		document.body.append(host);
		await settle();
		expect(listener.calls()).toBe(1);

		host.setAttribute("style", "--pie-background: #000000");
		await settle();
		expect(listener.calls()).toBe(2);
	});

	test("fires on a document-element scheme change", async () => {
		const listener = observe();
		document.documentElement.setAttribute("data-color-scheme", "dark");
		await settle();
		expect(listener.calls()).toBe(1);
	});

	test("ignores unrelated insertions", async () => {
		const listener = observe();
		document.body.append(document.createElement("div"));
		await settle();
		expect(listener.calls()).toBe(0);
	});

	test("stops on unsubscribe", async () => {
		let count = 0;
		const stop = observePieThemeChanges(() => count++);
		stop();
		document.documentElement.setAttribute("data-color-scheme", "dark");
		await settle();
		expect(count).toBe(0);
	});

	test("is inert without MutationObserver", () => {
		const original = globalThis.MutationObserver;
		Object.defineProperty(globalThis, "MutationObserver", {
			value: undefined,
			configurable: true,
			writable: true,
		});
		try {
			const stop = observePieThemeChanges(() => {});
			expect(() => stop()).not.toThrow();
		} finally {
			Object.defineProperty(globalThis, "MutationObserver", {
				value: original,
				configurable: true,
				writable: true,
			});
		}
	});
});

/**
 * Stands in for the 2D context `createCanvasColorMeasure` paints on: `#rrggbb`
 * and `rgba()` parse, anything else is ignored the way `fillStyle` ignores it.
 */
function fakeCanvas(): HTMLCanvasElement {
	const parse = (value: string): number[] | null => {
		const hex = /^#([0-9a-f]{6})$/i.exec(value);
		if (hex) {
			const n = Number.parseInt(hex[1], 16);
			return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
		}
		const rgba = /^rgba\(([^)]+)\)$/i.exec(value);
		if (!rgba) return null;
		const [r, g, b, a] = rgba[1].split(",").map(Number);
		return [r, g, b, Math.round(a * 255)];
	};
	let fillStyle = "#000000";
	let pixel = [0, 0, 0, 0];
	const context = {
		get fillStyle() {
			return fillStyle;
		},
		set fillStyle(value: string) {
			if (parse(value)) fillStyle = value.toLowerCase();
		},
		clearRect() {
			pixel = [0, 0, 0, 0];
		},
		fillRect() {
			pixel = parse(fillStyle) ?? pixel;
		},
		getImageData() {
			return { data: pixel };
		},
	};
	return { getContext: () => context } as unknown as HTMLCanvasElement;
}

describe("readPieElementTheme", () => {
	const restores: Array<() => void> = [];
	afterEach(() => {
		for (const restore of restores.splice(0)) restore();
	});

	function computing(values: Record<string, string>): Element {
		const spy = spyOn(globalThis, "getComputedStyle").mockImplementation(
			() =>
				({
					getPropertyValue: (name: string) => values[name] ?? "",
				}) as CSSStyleDeclaration,
		);
		restores.push(() => spy.mockRestore());
		return document.createElement("div");
	}

	function withCanvas(canvas: HTMLCanvasElement | null): void {
		const create = document.createElement.bind(document);
		const spy = spyOn(document, "createElement").mockImplementation(((
			tag: string,
		) => (tag === "canvas" && canvas ? canvas : create(tag))) as never);
		restores.push(() => spy.mockRestore());
	}

	// First: once a canvas is found the measure is kept for the module's life.
	test("returns null where no canvas can resolve a colour", () => {
		withCanvas({ getContext: () => null } as unknown as HTMLCanvasElement);
		const element = computing({ "--pie-background": "#000000" });
		expect(readPieElementTheme(element)).toBeNull();
	});

	test("reads a dark background and opaque tokens as hex", () => {
		withCanvas(fakeCanvas());
		const element = computing({
			"--pie-background": "#00004D",
			"--pie-border": "#FFFF00",
			"--pie-text": "rgba(255, 255, 255, 0.5)",
		});

		expect(
			readPieElementTheme(element, [
				"--pie-border",
				"--pie-text",
				"--pie-missing",
			]),
		).toEqual({
			colorScheme: "dark",
			colors: { "--pie-border": "#ffff00" },
		});
	});

	test("reads a light background", () => {
		withCanvas(fakeCanvas());
		const element = computing({ "--pie-background": "#FFFFFF" });
		expect(readPieElementTheme(element)?.colorScheme).toBe("light");
	});

	test("leaves the scheme undecided without a background", () => {
		withCanvas(fakeCanvas());
		const element = computing({});
		expect(readPieElementTheme(element)).toEqual({
			colorScheme: null,
			colors: {},
		});
	});
});
