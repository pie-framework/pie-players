/**
 * The item player bundled into a host's single ES module, as Vite through 7
 * builds one with `inlineDynamicImports`: Rollup evaluates every inlined
 * dynamic import at startup, the MathJax 3 module the IIFE strategy imports
 * included. Until a host asks for IIFE math rendering, the player must leave the
 * page's `MathJax` alone. See
 * `packages/players-shared/math-rendering-module-deferral.mjs`.
 *
 * Bundles the built `dist`, which `test:e2e:item-player` builds first.
 */

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { type RollupLog, rollup } from "rollup";

const ITEM_PLAYER_DIST = join(import.meta.dirname, "../dist");
const MATH_RENDERING_MODULE = createRequire(
	join(import.meta.dirname, "../../players-shared/package.json"),
).resolve("@pie-lib/math-rendering-module/module/index.js");

const ORIGIN = "http://host.test";
const ENTRY = "\0host-entry";

/** `entry` as one ES module, the way a Vite 7 library build emits it. */
async function bundleLikeHost(
	entry: string,
): Promise<{ code: string; warnings: RollupLog[] }> {
	const warnings: RollupLog[] = [];
	const bundle = await rollup({
		input: ENTRY,
		plugins: [
			{
				name: "host-entry",
				resolveId: (id) => (id === ENTRY ? id : null),
				load: (id) => (id === ENTRY ? entry : null),
			},
		],
		onwarn: (warning) => {
			warnings.push(warning);
		},
	});
	try {
		const { output } = await bundle.generate({
			format: "es",
			inlineDynamicImports: true,
		});
		return { code: output[0].code, warnings };
	} finally {
		await bundle.close();
	}
}

/**
 * A MathJax 4 global, whose loader has no `preLoad`, behind a proxy that
 * records every property the page reads or writes on it.
 */
const HOST_MATHJAX_4 = `
	const access = { reads: [], writes: [] };
	const hostMathJax = new Proxy(
		{ version: "4.0.0", loader: { ready() {}, load() {} } },
		{
			get(target, key, receiver) {
				access.reads.push(String(key));
				return Reflect.get(target, key, receiver);
			},
			set(target, key, value, receiver) {
				access.writes.push(String(key));
				return Reflect.set(target, key, value, receiver);
			},
			defineProperty(target, key, descriptor) {
				access.writes.push(String(key));
				return Reflect.defineProperty(target, key, descriptor);
			},
			deleteProperty(target, key) {
				access.writes.push(String(key));
				return Reflect.deleteProperty(target, key);
			},
		},
	);
	window.MathJax = hostMathJax;
	window.hostMathJax = { access, object: hostMathJax };
`;

/** Serves `bundle` as the host page's one module, after `beforeBundle` runs. */
async function openHostPage(
	page: Page,
	bundle: string,
	beforeBundle = "",
): Promise<string[]> {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.route(`${ORIGIN}/**`, (route) => {
		const { pathname } = new URL(route.request().url());
		if (pathname === "/host.js") {
			return route.fulfill({ contentType: "text/javascript", body: bundle });
		}
		if (pathname === "/") {
			return route.fulfill({
				contentType: "text/html",
				body: `<!doctype html><html><head><script>${beforeBundle}</script><script type="module" src="/host.js"></script></head><body></body></html>`,
			});
		}
		return route.fulfill({ status: 404 });
	});
	await page.goto(`${ORIGIN}/`);
	return errors;
}

async function waitForBundle(page: Page, errors: string[]): Promise<void> {
	await expect
		.poll(async () =>
			errors.length > 0
				? errors
				: page.evaluate(() => Reflect.get(window, "hostBundleEvaluated")),
		)
		.toBe(true);
}

test.describe("item player in a single-module host bundle", () => {
	let playerBundle: { code: string; warnings: RollupLog[] };

	test.beforeAll(async () => {
		const entry = join(ITEM_PLAYER_DIST, "preloaded.js");
		if (!existsSync(entry)) {
			throw new Error(
				`${entry} does not exist. Run "bun run build:e2e:item-player" before this suite.`,
			);
		}
		playerBundle = await bundleLikeHost(`
			import ${JSON.stringify(join(ITEM_PLAYER_DIST, "pie-item-player.js"))};
			import { ensureItemPlayerMathRenderingReady } from ${JSON.stringify(entry)};
			window.ensureItemPlayerMathRenderingReady = ensureItemPlayerMathRenderingReady;
			window.hostBundleEvaluated = true;
		`);
	});

	test("the bare MathJax 3 module throws on a page running MathJax 4", async ({
		page,
	}) => {
		const control = await bundleLikeHost(`
			import(${JSON.stringify(MATH_RENDERING_MODULE)});
			window.hostBundleEvaluated = true;
		`);
		const errors = await openHostPage(page, control.code, HOST_MATHJAX_4);

		await expect.poll(() => errors).toContainEqual(
			expect.stringContaining("preLoad"),
		);
	});

	test("evaluates without touching the page's MathJax 4", async ({ page }) => {
		expect(
			playerBundle.warnings.filter(
				(warning) => warning.code === "MISSING_EXPORT",
			),
		).toEqual([]);
		const errors = await openHostPage(page, playerBundle.code, HOST_MATHJAX_4);
		await waitForBundle(page, errors);

		const state = await page.evaluate(() => {
			const host = Reflect.get(window, "hostMathJax");
			return {
				samePageGlobal: Reflect.get(window, "MathJax") === host.object,
				reads: host.access.reads,
				writes: host.access.writes,
				renderer: typeof Reflect.get(window, "@pie-lib/math-rendering"),
				player: typeof customElements.get("pie-item-player"),
			};
		});
		expect(state).toEqual({
			samePageGlobal: true,
			reads: [],
			writes: [],
			renderer: "undefined",
			player: "function",
		});
		expect(errors).toEqual([]);
	});

	test("sets MathJax 3 up only when the IIFE strategy asks for it", async ({
		page,
	}) => {
		const errors = await openHostPage(page, playerBundle.code);
		await waitForBundle(page, errors);
		expect(
			await page.evaluate(() => typeof Reflect.get(window, "MathJax")),
		).toBe("undefined");

		await page.evaluate(() =>
			Reflect.get(window, "ensureItemPlayerMathRenderingReady")(),
		);

		expect(
			await page.evaluate(() => ({
				renderMath: typeof Reflect.get(window, "@pie-lib/math-rendering")
					?.renderMath,
				mathJaxVersion: Reflect.get(window, "MathJax")?.version,
			})),
		).toEqual({ renderMath: "function", mathJaxVersion: expect.stringMatching(/^3\./) });
		expect(errors).toEqual([]);
	});
});
