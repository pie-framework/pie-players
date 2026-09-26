import { expect, test } from "@playwright/test";

// Under `dev:section:cdn` the demos point the ESM loader at their own origin,
// where the dev server serves pie-elements-ng from the checkout on disk.
const NG_REQUEST = /\/@pie-(?:element|lib|elements-ng)\//;
// The config resolves the checkout path.
const CHECKOUT = `${process.env.PIE_ELEMENTS_NG_PATH}/`;

for (const path of ["/tts-ssml", "/two-passages"]) {
	test(`${path} loads pie-elements-ng from the dev server under esm`, async ({
		page,
		baseURL,
	}) => {
		const manifestsFromCheckout: string[] = [];
		const browserBuilds: string[] = [];
		const loadedElsewhere: string[] = [];
		page.on("response", (response) => {
			const url = response.url();
			if (!NG_REQUEST.test(url)) return;
			if (!url.startsWith(`${baseURL}/`)) {
				loadedElsewhere.push(url);
				return;
			}
			if (!response.ok()) return;
			// A manifest response names the file it served. Modules go through
			// Vite's transform, which sets no such header.
			if (response.headers()["x-local-esm-cdn-file"]?.startsWith(CHECKOUT)) {
				manifestsFromCheckout.push(url);
			}
			if (url.includes("/dist/browser/delivery/")) {
				browserBuilds.push(url);
			}
		});

		await page.goto(`${path}?mode=candidate&layout=splitpane&player=esm`, {
			waitUntil: "networkidle",
		});
		await expect(
			page
				.locator(
					'pie-section-player-splitpane pie-item-player input[type="radio"]',
				)
				.first(),
		).toBeVisible({ timeout: 60_000 });
		await expect(page.getByText("Player Error")).toHaveCount(0);

		expect(manifestsFromCheckout.length).toBeGreaterThan(0);
		expect(browserBuilds.length).toBeGreaterThan(0);
		expect(loadedElsewhere).toEqual([]);
	});
}

// A build addresses the MathQuill font relative to the module that declares
// it, so the font loads from the dev server like the module.
test("/tts-ssml loads the MathQuill font from the dev server under esm", async ({
	page,
	baseURL,
}) => {
	const fonts: string[] = [];
	page.on("response", (response) => {
		const url = response.url();
		if (!NG_REQUEST.test(url) || !url.endsWith(".woff2")) return;
		fonts.push(
			`${response.status()} ${response.headers()["content-type"]} ${url}`,
		);
	});

	await page.goto("/tts-ssml?mode=candidate&layout=splitpane&player=esm", {
		waitUntil: "networkidle",
	});
	await expect(
		page
			.locator(
				'pie-section-player-splitpane pie-item-player input[type="radio"]',
			)
			.first(),
	).toBeVisible({ timeout: 60_000 });
	// Rejects when the font fails to load.
	const faces = await page.evaluate(
		async () => (await document.fonts.load("16px Symbola")).length,
	);

	expect(faces).toBeGreaterThan(0);
	expect(fonts).not.toHaveLength(0);
	expect(
		fonts.filter((font) => !font.startsWith(`200 font/woff2 ${baseURL}/@pie-`)),
	).toEqual([]);
});

// Only the ESM loader's URLs are the checkout's. A bare import in the app keeps
// resolving from node_modules, so this demo bundles the installed element.
test("/preloaded-bundled-elements bundles the installed element", async ({
	page,
	baseURL,
}) => {
	const fromCheckout: string[] = [];
	page.on("request", (request) => {
		if (request.url().startsWith(`${baseURL}/@pie-element/`)) {
			fromCheckout.push(request.url());
		}
	});

	await page.goto(
		"/preloaded-bundled-elements?mode=candidate&layout=splitpane",
		{ waitUntil: "networkidle" },
	);
	await expect(
		page
			.locator("mc-populated-blank--version-0-3-0-next-16")
			.getByRole("radio", { name: "teapot" }),
	).toBeVisible({ timeout: 30_000 });
	expect(fromCheckout).toEqual([]);
});
