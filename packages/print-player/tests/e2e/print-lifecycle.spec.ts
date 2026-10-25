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
