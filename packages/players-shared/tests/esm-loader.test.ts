import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { EsmPieLoader } from "../src/pie/esm-loader.js";

type GlobalWithDom = typeof globalThis & {
	customElements?: {
		get: (name: string) => unknown;
		define: (name: string, ctor: CustomElementConstructor) => void;
		whenDefined: (name: string) => Promise<void>;
	};
	HTMLScriptElement?: {
		supports?: (type: string) => boolean;
	};
};

const globalWithDom = globalThis as GlobalWithDom;

const originalCustomElements = globalWithDom.customElements;
const originalHtmlScriptElement = globalWithDom.HTMLScriptElement;

function installMockCustomElements() {
	globalWithDom.customElements = {
		get: () => undefined,
		define: () => undefined,
		whenDefined: async () => undefined,
	};
}

function createMockDocument(onAppend: (el: unknown) => void): Document {
	return {
		head: {
			appendChild: (el: unknown) => {
				onAppend(el);
				return el;
			},
		},
		createElement: () => ({}),
	} as unknown as Document;
}

describe("EsmPieLoader", () => {
	beforeEach(() => {
		installMockCustomElements();
		globalWithDom.HTMLScriptElement = class {
			static supports(type: string) {
				return type === "importmap";
			}
		} as unknown as GlobalWithDom["HTMLScriptElement"];
	});

	afterEach(() => {
		globalWithDom.customElements = originalCustomElements;
		globalWithDom.HTMLScriptElement = originalHtmlScriptElement;
	});

	test("url mode skips import-map injection across multiple loads", async () => {
		const appended: unknown[] = [];
		const doc = createMockDocument((el) => appended.push(el));
		const loader = new EsmPieLoader({
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
		});

		(loader as any).loadElement = async () => undefined;

		await loader.load(
			{ elements: { "pie-alpha": "@pie-element/alpha@1.0.0" } },
			doc,
			{ view: "delivery", loadControllers: false },
		);
		await loader.load(
			{ elements: { "pie-beta": "@pie-element/beta@1.0.0" } },
			doc,
			{ view: "delivery", loadControllers: false },
		);

		expect(appended.length).toBe(0);
	});

	test("import-map mode injects import map once", async () => {
		const appended: unknown[] = [];
		const doc = createMockDocument((el) => appended.push(el));
		const loader = new EsmPieLoader({
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			moduleResolution: "import-map",
		});

		(loader as any).loadElement = async () => undefined;

		await loader.load(
			{ elements: { "pie-alpha": "@pie-element/alpha@1.0.0" } },
			doc,
			{ view: "delivery", loadControllers: false },
		);
		await loader.load(
			{ elements: { "pie-beta": "@pie-element/beta@1.0.0" } },
			doc,
			{ view: "delivery", loadControllers: false },
		);

		expect(appended.length).toBe(1);
	});

	test("throws actionable error when import maps are unsupported", async () => {
		globalWithDom.HTMLScriptElement = class {} as unknown as GlobalWithDom["HTMLScriptElement"];
		const loader = new EsmPieLoader({
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			moduleResolution: "import-map",
		});

		const doc = createMockDocument(() => undefined);

		await expect(
			loader.load(
				{ elements: { "pie-alpha": "@pie-element/alpha@1.0.0" } },
				doc,
				{ view: "delivery", loadControllers: false },
			),
		).rejects.toThrow("does not support import maps");
	});
});
