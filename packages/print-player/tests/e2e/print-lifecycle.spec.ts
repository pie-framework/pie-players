import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { expect, test } from "@playwright/test";
import type { PiePrint } from "../../src/pie-print.js";
import type { Config, PkgResolution } from "../../src/types.js";

const PACKAGE_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
let bundledCode: string;

test.beforeAll(async () => {
	const result = await esbuild.build({
		entryPoints: [path.join(PACKAGE_ROOT, "src/pie-print.ts")],
		bundle: true,
		platform: "browser",
		format: "iife",
		target: "es2020",
		write: false,
	});
	bundledCode = result.outputFiles[0].text;
});

test.beforeEach(async ({ page }) => {
	await page.route("https://print.test/**", (route) =>
		route.fulfill({
			contentType: "text/javascript",
			headers: { "access-control-allow-origin": "*" },
			body: "export default class extends HTMLElement { set model(value) { this.textContent = value.prompt; } }",
		}),
	);
	await page.setContent("<!doctype html><html><body></body></html>");
	await page.addScriptTag({ content: bundledCode });
});

test("a late resolver cannot replace the latest print job", async ({
	page,
}) => {
	await page.evaluate(() => {
		const player = document.createElement("pie-print") as PiePrint;
		const resolution = (name: string): PkgResolution => ({
			tagName: `pie-${name}`,
			printTagName: `pie-${name}-print`,
			pkg: name,
			url: `https://print.test/${name}.js`,
			module: true,
		});
		player.resolve = (_tag, pkg) =>
			pkg === "older"
				? new Promise((resolve) => {
						(window as unknown as { releaseOlder: () => void }).releaseOlder =
							() => resolve(resolution("older"));
					})
				: Promise.resolve(resolution("newer"));
		const config = (name: string): Config => ({
			item: {
				markup: `<pie-${name} id="q1"></pie-${name}>`,
				elements: { [`pie-${name}`]: name },
				models: [{ id: "q1", element: `pie-${name}`, prompt: name }],
			},
		});
		document.body.append(player);
		player.config = config("older");
		player.config = config("newer");
	});
	await expect(page.locator("pie-newer-print")).toHaveText("newer");
	await page.evaluate(async () => {
		(window as unknown as { releaseOlder: () => void }).releaseOlder();
		await new Promise((resolve) => requestAnimationFrame(resolve));
		await (document.querySelector("pie-print") as PiePrint).updateComplete;
	});
	await expect(page.locator("pie-newer-print")).toHaveText("newer");
	await expect(page.locator("pie-older-print")).toHaveCount(0);
});

test("the previous output stays until the next config resolves", async ({
	page,
}) => {
	await page.evaluate(() => {
		const player = document.createElement("pie-print") as PiePrint;
		const resolution = (name: string): PkgResolution => ({
			tagName: `pie-${name}`,
			printTagName: `pie-${name}-print`,
			pkg: name,
			url: `https://print.test/${name}.js`,
			module: true,
		});
		player.resolve = (_tag, pkg) =>
			pkg === "later"
				? new Promise((resolve) => {
						(window as unknown as { releaseLater: () => void }).releaseLater =
							() => resolve(resolution("later"));
					})
				: Promise.resolve(resolution("first"));
		const config = (name: string): Config => ({
			item: {
				markup: `<pie-${name} id="q1"></pie-${name}>`,
				elements: { [`pie-${name}`]: name },
				models: [{ id: "q1", element: `pie-${name}`, prompt: name }],
			},
		});
		(window as unknown as { configFor: typeof config }).configFor = config;
		document.body.append(player);
		player.config = config("first");
	});
	await expect(page.locator("pie-first-print")).toHaveText("first");
	const rejected = await page.evaluate(async () => {
		const player = document.querySelector("pie-print") as PiePrint;
		const { configFor } = window as unknown as {
			configFor: (name: string) => Config;
		};
		player.config = configFor("later");
		const pendingConfig = player.config;
		let error = "";
		try {
			player.config = {
				item: { markup: "<pie-undeclared></pie-undeclared>", elements: {}, models: [] },
			};
		} catch (cause) { error = (cause as Error).message; }
		await player.updateComplete;
		return { error, pendingUnchanged: player.config === pendingConfig };
	});
	expect(rejected.error).toContain("PIE markup tag is not declared");
	expect(rejected.pendingUnchanged).toBe(true);
	await expect(page.locator("pie-first-print")).toHaveText("first");
	await page.evaluate(() =>
		(window as unknown as { releaseLater: () => void }).releaseLater(),
	);
	await expect(page.locator("pie-later-print")).toHaveText("later");
	await expect(page.locator("pie-first-print")).toHaveCount(0);
});

for (const mode of ["default", "trusted", "custom sanitizer"] as const) {
	test(`rejects undeclared registered PIE markup before construction (${mode})`, async ({ page }) => {
		const result = await page.evaluate(async (mode) => {
			let constructions = 0;
			let resolutions = 0;
			customElements.define("pie-undeclared", class extends HTMLElement {
				constructor() { super(); constructions++; }
			});
			const player = document.createElement("pie-print") as PiePrint;
			player.trustMarkup = mode === "trusted";
			if (mode === "custom sanitizer") player.sanitizeMarkup = (markup) => markup;
			player.resolve = async () => {
				resolutions++;
				throw new Error("resolver must not run");
			};
			document.body.append(player);
			let error = "";
			try {
				player.config = {
					item: { markup: '<PIE-UNDECLARED id="q1"></PIE-UNDECLARED>', elements: {}, models: [] },
				};
			} catch (cause) { error = (cause as Error).message; }
			await player.updateComplete;
			return { error, constructions, resolutions };
		}, mode);
		expect(result.error).toContain("PIE markup tag is not declared");
		expect(result.constructions).toBe(0);
		expect(result.resolutions).toBe(0);
	});
}

test("validates every declared tag before invoking any resolver", async ({ page }) => {
	const result = await page.evaluate(() => {
		const player = document.createElement("pie-print") as PiePrint;
		let resolutions = 0;
		player.resolve = async () => { resolutions++; throw new Error("must not resolve"); };
		let error = "";
		try {
			player.config = {
				item: { markup: "", elements: { "pie-valid": "valid", "Invalid-tag": "invalid" }, models: [] },
			};
		} catch (cause) { error = (cause as Error).message; }
		return { error, resolutions };
	});
	expect(result.error).toContain("custom element names must be lowercase");
	expect(result.resolutions).toBe(0);
});

test("package policy applies before custom resolvers, including registered tags", async ({ page }) => {
	const result = await page.evaluate(() => {
		customElements.define("pie-policy", class extends HTMLElement {});
		const player = document.createElement("pie-print") as PiePrint;
		player.loaderOptions = { elementPackagePolicy: { allowedPackages: ["@pie-element/allowed"] } };
		let resolutions = 0;
		player.resolve = async () => { resolutions++; throw new Error("must not resolve"); };
		const errors: string[] = [];
		for (const pkg of ["@pie-element/denied@1.0.0", "@pie-element/allowed@latest"]) {
			try {
				player.config = {
					item: { markup: "<pie-policy></pie-policy>", elements: { "pie-policy": pkg }, models: [] },
				};
			} catch (cause) { errors.push((cause as Error).message); }
		}
		return { errors, resolutions };
	});
	expect(result.errors).toHaveLength(2);
	expect(result.errors[0]).toContain("does not allow");
	expect(result.errors[1]).toContain("requires an exact version");
	expect(result.resolutions).toBe(0);
});

test("an allowed package still resolves and renders without upgrading its delivery tag", async ({ page }) => {
	const failures: string[] = [];
	page.on("pageerror", (error) => failures.push(error.message));
	await page.evaluate(() => {
		customElements.define("pie-allowed", class extends HTMLElement {
			constructor() { super(); throw new Error("delivery element must not be constructed"); }
		});
		const player = document.createElement("pie-print") as PiePrint;
		player.loaderOptions = { elementPackagePolicy: { allowedPackages: ["@pie-element/allowed@1.0.0"] } };
		player.resolve = async (tagName, pkg, options) => {
			if (!options?.elementPackagePolicy) throw new Error("policy options not forwarded");
			return { tagName, pkg, printTagName: "pie-allowed-print", url: "https://print.test/allowed.js", module: true };
		};
		document.body.append(player);
		player.config = {
			item: {
				markup: '<pie-allowed id="q1"></pie-allowed>',
				elements: { "pie-allowed": "@pie-element/allowed@1.0.0" },
				models: [{ id: "q1", element: "pie-allowed", prompt: "Allowed print" }],
			},
		};
	});
	await expect(page.locator("pie-allowed-print")).toHaveText("Allowed print");
	expect(failures).toEqual([]);
});

test("PIE-like text, comments and SVG names are not executable HTML tags", async ({ page }) => {
	await page.evaluate(() => {
		const player = document.createElement("pie-print") as PiePrint;
		document.body.append(player);
		player.config = {
			item: {
				markup: "<p>&lt;pie-text&gt;</p><!-- <pie-comment></pie-comment> --><svg><pie-graphic></pie-graphic></svg>",
				elements: {}, models: [],
			},
		};
	});
	await expect(page.locator("pie-print")).toContainText("<pie-text>");
});

test("a failed resolver clears stale output without leaking its error", async ({
	page,
}) => {
	const failures: string[] = [];
	page.on("pageerror", (error) => failures.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") failures.push(message.text());
	});
	await page.evaluate(() => {
		const player = document.createElement("pie-print") as PiePrint;
		player.resolve = async (tagName, pkg) => ({
			tagName,
			pkg,
			printTagName: "pie-safe-print",
			url: "https://print.test/safe.js",
			module: true,
		});
		document.body.append(player);
		player.config = {
			item: {
				markup: '<pie-safe id="q1"></pie-safe>',
				elements: { "pie-safe": "safe" },
				models: [{ id: "q1", element: "pie-safe", prompt: "safe output" }],
			},
		};
	});
	await expect(page.locator("pie-safe-print")).toHaveText("safe output");
	await page.evaluate(() => {
		const player = document.querySelector("pie-print") as PiePrint;
		player.resolve = async () => {
			throw new Error("private authored response");
		};
		player.config = {
			item: {
				markup: "<p>private authored response</p>",
				elements: { "pie-failed": "failed" },
				models: [],
			},
		};
	});
	await expect(page.locator("pie-safe-print")).toHaveCount(0);
	await expect.poll(() => failures.length).toBeGreaterThan(0);
	expect(failures).toEqual(["[pie-print] Failed to resolve print elements"]);
	await expect(page.locator("pie-print")).not.toContainText(
		"private authored response",
	);
});

test("prints plain markup when a config has no elements", async ({
	page,
}) => {
	await page.evaluate(() => {
		const player = document.createElement("pie-print") as PiePrint;
		document.body.append(player);
		player.config = {
			item: { markup: "<p>Plain print content</p>", elements: {}, models: [] },
		};
	});
	await expect(page.locator("pie-print")).toContainText("Plain print content");
});

test("matches quoted IDs and dotted element names literally", async ({
	page,
}) => {
	const id = 'answer"][quoted="value';
	await page.evaluate((id) => {
		const player = document.createElement("pie-print") as PiePrint;
		player.resolve = async (tagName, pkg) => ({
			tagName,
			pkg,
			printTagName: "pie-choice-print",
			url: "https://print.test/choice.js",
			module: true,
		});
		document.body.append(player);
		const encodedId = id.replaceAll('"', "&quot;");
		player.config = {
			item: {
				markup: `<p id="${encodedId}">Other tag</p><pie-choice.input id="${encodedId}"></pie-choice.input>`,
				elements: { "pie-choice.input": "choice" },
				models: [
					{ id, element: "pie-choice.input", prompt: "Exact model assigned" },
				],
			},
		};
	}, id);
	await expect(page.locator("pie-choice-print")).toHaveText(
		"Exact model assigned",
	);
	await expect(page.locator("pie-choice-print")).toHaveAttribute("id", id);
});
