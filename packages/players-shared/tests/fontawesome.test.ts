import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";

import {
	applyNdsGlyphVariant,
	ensureFontAwesome,
	installFontAwesomeInShadow,
} from "../src/ui/fontawesome.js";

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		// The tests settle links by hand; a real fetch would race them.
		GlobalRegistrator.register({ settings: { disableCSSFileLoading: true } });
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

afterEach(() => {
	document.head.innerHTML = "";
	document.body.innerHTML = "";
});

const linkStylesheet = (href: string) => {
	const link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = href;
	document.head.appendChild(link);
	return link;
};

const headStylesheets = () =>
	Array.from(
		document.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
	).map((link) => link.href);

describe("ensureFontAwesome", () => {
	test("adds FA Free from the configured CDN once", () => {
		ensureFontAwesome({ esmCdnUrl: "https://mirror.test/esm" });
		ensureFontAwesome({ esmCdnUrl: "https://mirror.test/esm" });
		const added = headStylesheets();
		expect(added).toHaveLength(1);
		expect(added[0]).toStartWith(
			"https://mirror.test/esm/@fortawesome/fontawesome-free@",
		);
	});

	test("adds nothing when the page links its own FontAwesome", () => {
		linkStylesheet("https://host.test/_fa-pro/css/all.css");
		ensureFontAwesome(undefined);
		expect(headStylesheets()).toEqual(["https://host.test/_fa-pro/css/all.css"]);
	});

	test("marks a stylesheet that fails to load", () => {
		ensureFontAwesome(undefined);
		const link = document.head.querySelector("link") as HTMLLinkElement;
		link.dispatchEvent(new Event("error"));
		expect("pieLoadFailed" in link.dataset).toBe(true);
	});
});

describe("installFontAwesomeInShadow", () => {
	const shadowNode = () => {
		const host = document.createElement("div");
		document.body.appendChild(host);
		const shadow = host.attachShadow({ mode: "open" });
		const node = document.createElement("span");
		shadow.appendChild(node);
		return { shadow, node };
	};
	const shadowStylesheets = (shadow: ShadowRoot) =>
		Array.from(
			shadow.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
		).map((link) => link.href);

	test("copies a loaded FontAwesome link into the shadow root once", () => {
		const link = linkStylesheet("https://host.test/fontawesome.min.css");
		Object.defineProperty(link, "sheet", { value: {} });
		linkStylesheet("https://host.test/site.css");
		const { shadow, node } = shadowNode();
		installFontAwesomeInShadow(node);
		installFontAwesomeInShadow(node);
		expect(shadowStylesheets(shadow)).toEqual([
			"https://host.test/fontawesome.min.css",
		]);
	});

	test("copies a link that is still loading when it loads, never one that fails", () => {
		const loading = linkStylesheet("https://host.test/fontawesome.min.css");
		Object.defineProperty(loading, "sheet", { value: null });
		const failing = linkStylesheet("https://host.test/fa-pro.css");
		Object.defineProperty(failing, "sheet", { value: null });
		const { shadow, node } = shadowNode();
		installFontAwesomeInShadow(node);
		expect(shadowStylesheets(shadow)).toEqual([]);
		failing.dispatchEvent(new Event("error"));
		loading.dispatchEvent(new Event("load"));
		expect(shadowStylesheets(shadow)).toEqual([
			"https://host.test/fontawesome.min.css",
		]);
	});

	test("skips a link marked as failed", () => {
		const link = linkStylesheet("https://host.test/fontawesome.min.css");
		link.dataset.pieLoadFailed = "";
		const { shadow, node } = shadowNode();
		installFontAwesomeInShadow(node);
		expect(shadowStylesheets(shadow)).toEqual([]);
	});

	test("does nothing for a node in the document tree", () => {
		linkStylesheet("https://host.test/fontawesome.min.css");
		const node = document.createElement("span");
		document.body.appendChild(node);
		installFontAwesomeInShadow(node);
		expect(document.body.querySelectorAll("link")).toHaveLength(0);
	});
});

describe("applyNdsGlyphVariant", () => {
	const button = () => {
		const el = document.createElement("div");
		el.innerHTML = '<i class="fa-light fa-calculator"></i>';
		return el;
	};

	test("renders Solid without Pro, whatever is preferred", () => {
		const el = button();
		const disconnect = applyNdsGlyphVariant(el, "fa-light");
		expect(el.querySelector("i")?.className).toBe("fa-calculator fa-solid");
		disconnect();
	});

	test("renders Solid when the page links only FA Free", () => {
		linkStylesheet(
			"https://cdn.test/npm/@fortawesome/fontawesome-free/css/all.min.css",
		);
		const el = button();
		const disconnect = applyNdsGlyphVariant(el, "fa-regular");
		expect(el.querySelector("i")?.className).toBe("fa-calculator fa-solid");
		disconnect();
	});

	test("renders the preferred weight with Pro", () => {
		linkStylesheet("https://host.test/_fa-pro/css/all.css");
		const el = button();
		const disconnect = applyNdsGlyphVariant(el, "fa-regular");
		expect(el.querySelector("i")?.className).toBe("fa-calculator fa-regular");
		disconnect();
	});

	test("re-applies when the glyph is re-rendered", async () => {
		const el = button();
		const disconnect = applyNdsGlyphVariant(el, "fa-solid");
		el.innerHTML = '<i class="fa-light fa-pause"></i>';
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(el.querySelector("i")?.className).toBe("fa-pause fa-solid");
		disconnect();
	});
});

describe("FontAwesome pin", () => {
	const packagesDir = path.resolve(import.meta.dir, "../..");
	const SKIP = new Set(["node_modules", "dist", "tests", ".turbo"]);
	const sourceFiles = (dir: string, out: string[] = []): string[] => {
		for (const entry of readdirSync(dir)) {
			if (SKIP.has(entry)) continue;
			const full = path.join(dir, entry);
			if (statSync(full).isDirectory()) sourceFiles(full, out);
			else if (/\.(ts|svelte)$/.test(entry) && !/\.test\.ts$/.test(entry)) {
				out.push(full);
			}
		}
		return out;
	};

	test("is declared once, in ui/fontawesome", () => {
		const files = sourceFiles(packagesDir);
		const pinned = files
			.filter((file) => readFileSync(file, "utf8").includes("fontawesome-free@"))
			.map((file) => path.relative(packagesDir, file));
		// Positive control: the walk reached the toolbar that renders the glyphs.
		expect(
			files.some((file) => file.endsWith("ItemToolBar.svelte")),
		).toBe(true);
		expect(pinned).toEqual(["players-shared/src/ui/fontawesome.ts"]);
	});
});
