import { afterEach, describe, expect, test } from "bun:test";
import { GeoGebraCalculatorProvider } from "../src/geogebra-provider.js";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(
	globalThis,
	"document",
);

function setGlobal(name: "window" | "document", value: unknown): void {
	Object.defineProperty(globalThis, name, {
		configurable: true,
		writable: true,
		value,
	});
}

function restoreGlobal(
	name: "window" | "document",
	descriptor: PropertyDescriptor | undefined,
): void {
	if (descriptor) Object.defineProperty(globalThis, name, descriptor);
	else Reflect.deleteProperty(globalThis, name);
}

afterEach(() => {
	restoreGlobal("window", originalWindow);
	restoreGlobal("document", originalDocument);
});

function fakeContainer() {
	return {
		id: "",
		clientWidth: 640,
		clientHeight: 480,
		replaceChildren: () => {},
		querySelector: () => null,
	} as unknown as HTMLElement;
}

describe("GeoGebraCalculatorProvider", () => {
	test("loads the documented GeoGebra deployment script by default", async () => {
		let loadedSrc = "";
		const browserWindow: { GGBApplet?: unknown } = {};
		setGlobal("window", browserWindow);
		setGlobal("document", {
			createElement: () => ({
				src: "",
				async: false,
				dataset: {},
				onload: null as null | (() => void),
				onerror: null as null | (() => void),
			}),
			head: {
				appendChild: (script: { src: string; onload: null | (() => void) }) => {
					loadedSrc = script.src;
					browserWindow.GGBApplet = class {};
					script.onload?.();
				},
			},
		});

		await new GeoGebraCalculatorProvider().initialize();
		expect(loadedSrc).toBe("https://www.geogebra.org/apps/deployggb.js");
	});

	test("maps basic to the scientific app and graphing to graphing", async () => {
		const appNames: string[] = [];
		const injectionTargets: string[] = [];
		const api = {
			getEditorState: () => ({ content: "2+2" }),
			getBase64: () => "encoded-state",
			setBase64: () => {},
			newConstruction: () => {},
			remove: () => {},
		};
		setGlobal("window", {
			GGBApplet: class {
				constructor(
					private readonly parameters: {
						appName: string;
						appletOnLoad: (value: typeof api) => void;
					},
				) {
					appNames.push(parameters.appName);
				}

				inject(target: string) {
					injectionTargets.push(target);
					this.parameters.appletOnLoad(api);
				}
			},
		});
		setGlobal("document", {});

		const provider = new GeoGebraCalculatorProvider();
		await provider.initialize();
		const basic = await provider.createCalculator("basic", fakeContainer());
		const graphing = await provider.createCalculator(
			"graphing",
			fakeContainer(),
		);

		expect(appNames).toEqual(["scientific", "graphing"]);
		expect(injectionTargets).toHaveLength(2);
		expect(
			injectionTargets.every((target) => target.startsWith("pie-geogebra-")),
		).toBe(true);
		expect(basic.exportState()).toMatchObject({
			type: "basic",
			provider: "geogebra",
			providerState: "encoded-state",
		});
		graphing.destroy();
	});

	test("keeps generic config separate and forwards only provider settings", async () => {
		let parameters: Record<string, unknown> = {};
		setGlobal("window", {
			GGBApplet: class {
				constructor(value: Record<string, unknown>) {
					parameters = value;
				}

				inject(_target: string) {
					(parameters.appletOnLoad as (api: Record<string, unknown>) => void)({
						remove: () => {},
					});
				}
			},
		});
		setGlobal("document", {});

		const provider = new GeoGebraCalculatorProvider();
		await provider.initialize();
		await provider.createCalculator("scientific", fakeContainer(), {
			restrictedMode: true,
			theme: "dark",
			settings: { showResetIcon: true },
		});

		expect(parameters.appName).toBe("scientific");
		expect(parameters.showAlgebraInput).toBe(true);
		expect(parameters.showResetIcon).toBe(true);
		expect(parameters.enableCAS).toBe(false);
		expect(parameters).not.toHaveProperty("restrictedMode");
		expect(parameters).not.toHaveProperty("theme");
	});
});
