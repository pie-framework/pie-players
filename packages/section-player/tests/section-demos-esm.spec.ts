import { expect, type Page, test } from "@playwright/test";

// `?player=esm` loads the demos' pinned pie-elements-ng builds. Each declares
// the shared editor runtime, so its variant loads.
const BROWSER_BUILD =
	/\/@pie-element\/[^/]+@[^/]+\/dist\/browser\/editor-runtime\/delivery\//;
const ITEM_RADIO =
	'pie-section-player-splitpane pie-item-player input[type="radio"]';

function openEsm(page: Page, path: string) {
	return page.goto(`${path}?mode=candidate&layout=splitpane&player=esm`, {
		waitUntil: "networkidle",
	});
}

for (const path of ["/tts-ssml", "/two-passages"]) {
	test(`${path} renders pie-elements-ng builds under the esm player`, async ({
		page,
	}) => {
		const browserBuilds: string[] = [];
		const loaderWarnings: string[] = [];
		page.on("response", (response) => {
			if (response.ok() && BROWSER_BUILD.test(response.url())) {
				browserBuilds.push(response.url());
			}
		});
		page.on("console", (message) => {
			if (message.text().includes("[pie-esm]")) {
				loaderWarnings.push(message.text());
			}
		});

		await openEsm(page, path);
		await expect(page.locator(ITEM_RADIO).first()).toBeVisible({
			timeout: 30_000,
		});
		await expect(page.getByText("Player Error")).toHaveCount(0);
		expect(browserBuilds.length).toBeGreaterThan(0);
		// Every item player on the page shares the one runtime mapped first.
		const runtimeMap = page.locator(
			'script[data-pie-editor-runtime]',
		);
		await expect(runtimeMap).toHaveCount(1);
		await expect(runtimeMap).toHaveAttribute(
			"data-pie-editor-runtime",
			/^@pie-element\/shared-editor-runtime@/,
		);
		expect(loaderWarnings).toEqual([]);
	});
}

// jsDelivr's `+esm` modules import their dependencies by root path
// (`/npm/react@18.2.0/+esm`). Behind a CDN mounted off `/npm` those resolve
// to nothing unless the player's import map scopes them back under the
// mount, so this mirror serves `/esm/` from jsDelivr and fails `/npm/`.
test("/question-passage renders under the esm player behind a CDN mounted off /npm", async ({
	page,
}) => {
	const mirror = "https://proxy.pie-api.com";
	const mirrorRequests: string[] = [];
	await page.route(`${mirror}/**`, async (route) => {
		const url = route.request().url();
		mirrorRequests.push(url);
		if (!url.startsWith(`${mirror}/esm/`)) {
			await route.fulfill({ status: 404, body: "" });
			return;
		}
		// Not `route.fetch`, which keeps the mirror's Host header.
		const response = await page.request.fetch(
			url.replace(`${mirror}/esm/`, "https://cdn.jsdelivr.net/npm/"),
		);
		await route.fulfill({
			response,
			headers: {
				...response.headers(),
				"access-control-allow-origin": "*",
			},
		});
	});

	await page.goto(
		"/question-passage?mode=candidate&layout=splitpane&player=esm&esmCdn=pie-proxy",
		{ waitUntil: "networkidle" },
	);
	await expect(page.locator(ITEM_RADIO).first()).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText("Player Error")).toHaveCount(0);
	expect(
		mirrorRequests.filter((url) => BROWSER_BUILD.test(url)).length,
	).toBeGreaterThan(0);
	expect(mirrorRequests.filter((url) => url.startsWith(`${mirror}/npm/`))).toEqual(
		[],
	);
});

// Builds before pie-elements-ng#198 each started MathJax, so on a page holding
// two of them its startup failed with `State ASSISTIVEMML already exists` and
// the page typeset nothing.
test("/tts-ssml typesets math under the esm player", async ({ page }) => {
	const pageErrors: string[] = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));

	await openEsm(page, "/tts-ssml");
	await expect(page.locator(ITEM_RADIO).first()).toBeVisible({
		timeout: 30_000,
	});
	await expect(
		page
			.getByRole("complementary", { name: "Passages" })
			.locator("p.formula mjx-container"),
	).toBeVisible({ timeout: 30_000 });
	expect(pageErrors.filter((error) => error.includes("ASSISTIVEMML"))).toEqual(
		[],
	);
});
