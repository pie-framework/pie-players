import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * The demos link FA Pro and Roboto in their own document head, which the
 * toolbar and the read-aloud trigger detect and reuse. Most of these tests
 * strip those links, the setup of a host that links no FontAwesome: the
 * players then add FA Free and render every NDS glyph in Solid, the one Free
 * weight carrying them all.
 */
const desmosStub = `window.Desmos = Object.fromEntries(
	["GraphingCalculator", "ScientificCalculator", "FourFunctionCalculator"].map((name) => [
		name,
		() => ({ destroy() {}, resize() {}, setBlank() {}, getState() { return {}; }, setState() {}, focusFirstExpression() {} }),
	]),
);`;

const asHostWithoutFontAwesome = async (
	page: Page,
	{ faFreeLoads = true } = {},
) => {
	const requests: string[] = [];
	page.on("request", (request) => {
		const url = new URL(request.url());
		if (url.pathname.startsWith("/_fa-pro/")) requests.push(url.pathname);
		if (url.pathname.includes("/@fortawesome/fontawesome-free"))
			requests.push("fa-free");
		if (request.resourceType() === "stylesheet" && /roboto/i.test(url.href))
			requests.push(`roboto:${url.hostname}`);
	});
	await page.route("**/_fa-pro/**", (route) =>
		route.fulfill({ status: 404, body: "" }),
	);
	await page.route("https://ui.renaissance.com/fonts/Roboto/**", (route) =>
		route.fulfill({ status: 200, contentType: "text/css", body: "" }),
	);
	await page.route("**/@fortawesome/fontawesome-free@*/**", (route) =>
		faFreeLoads
			? route.fulfill({
					status: 200,
					contentType: "text/css",
					headers: { "cache-control": "max-age=3600" },
					body: "",
				})
			: route.fulfill({ status: 404, body: "" }),
	);
	await page.route("**/*", async (route) => {
		if (route.request().resourceType() !== "document") return route.fallback();
		const response = await route.fetch();
		const body = (await response.text()).replace(
			/<link rel="stylesheet" href="\/_(?:fa-pro|fonts\/Roboto)\/[^"]*" \/>/g,
			"",
		);
		await route.fulfill({ response, body });
	});
	await page.route("https://www.desmos.com/api/**/calculator.js**", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/javascript",
			body: desmosStub,
		}),
	);
	return requests;
};

const count = (requests: string[], name: string) =>
	requests.filter((request) => request === name).length;

const shadowStylesheets = (host: Locator) =>
	host.evaluate((element) =>
		Array.from(
			element.shadowRoot?.querySelectorAll<HTMLLinkElement>(
				"link[rel=stylesheet]",
			) ?? [],
			(link) => new URL(link.href).pathname,
		),
	);

/** The FA weight class on each NDS glyph, deduplicated. */
const glyphWeights = async (scope: Locator) => [
	...new Set(
		await scope.evaluate((element) =>
			Array.from(
				(element.shadowRoot ?? element).querySelectorAll("nds-icon-button i"),
				(icon) => icon.className.match(/\bfa-(light|regular|solid)\b/)?.[0],
			),
		),
	),
];

const NDS_ICON_PAGE = "/quiz-engine-nds-icon?mode=candidate&layout=splitpane";

test.describe("FontAwesome assets on a host that links none", () => {
	test("plain controls load FA Free alone", async ({ page }) => {
		const requests = await asHostWithoutFontAwesome(page);
		await page.goto("/three-questions?mode=candidate&layout=splitpane", {
			waitUntil: "networkidle",
		});
		const player = page.locator("pie-section-player-splitpane");
		await expect(
			player.getByRole("button", { name: "Calculator", exact: true }).first(),
		).toBeVisible();
		await expect(
			player.getByRole("button", { name: "Play reading", exact: true }).first(),
		).toBeVisible();

		// The read-aloud glyphs are FA Free's `fa-solid`, requested once for every
		// trigger on the page.
		expect(requests).toEqual(["fa-free"]);
	});

	test("NDS icon buttons render in FA Free Solid", async ({ page }) => {
		const requests = await asHostWithoutFontAwesome(page);
		await page.goto(NDS_ICON_PAGE, { waitUntil: "networkidle" });
		const toolbar = page.locator("pie-item-toolbar").first();
		const calculatorButton = toolbar.locator("nds-icon-button").first();
		await expect(calculatorButton).toBeVisible();
		await expect(
			page.locator("pie-tool-tts-inline nds-icon-button").first(),
		).toBeVisible();

		// The toolbar's shadow root copies the stylesheet the toolbar added. FA
		// Free has no Light weight, so `fa-light` would render no glyph.
		await expect
			.poll(() => shadowStylesheets(toolbar))
			.toEqual([expect.stringContaining("/@fortawesome/fontawesome-free@")]);
		expect(await glyphWeights(toolbar)).toEqual(["fa-solid"]);
		expect(count(requests, "fa-free")).toBe(1);
		expect(
			requests.filter((request) => request.startsWith("/_fa-pro/")),
		).toEqual([]);
		// The NDS buttons link Renaissance's Roboto, once between them.
		expect(requests.filter((request) => request.startsWith("roboto"))).toEqual([
			"roboto:ui.renaissance.com",
		]);

		// Free's Regular font lacks the window controls' icons, which drew as
		// boxes before they moved to Solid.
		await calculatorButton.click();
		const shell = page.locator('[data-pie-tool-shell="calculator"]').first();
		await expect(shell).toBeVisible();
		expect(await glyphWeights(shell)).toEqual(["fa-solid"]);
	});

	test("stylesheets that all fail are requested once each", async ({
		page,
	}) => {
		const requests = await asHostWithoutFontAwesome(page, {
			faFreeLoads: false,
		});
		await page.goto(NDS_ICON_PAGE, { waitUntil: "networkidle" });
		const toolbars = page.locator("pie-item-toolbar");
		await expect(
			toolbars.first().locator("nds-icon-button").first(),
		).toBeVisible();
		await expect(
			page.locator("pie-tool-tts-inline nds-icon-button").first(),
		).toBeVisible();

		// Every toolbar and read-aloud button finds the failed links still in the
		// document head, so none adds or copies them again.
		expect(await toolbars.count()).toBeGreaterThan(1);
		for (const toolbar of await toolbars.all()) {
			expect(await shadowStylesheets(toolbar)).toEqual([]);
		}
		expect(count(requests, "fa-free")).toBe(1);
	});
});

test.describe("FontAwesome assets on a host that links FA Pro and Roboto", () => {
	test("NDS icon buttons keep the design weights and fetch nothing", async ({
		page,
	}) => {
		await page.route(/\/_(?:fa-pro|fonts\/Roboto)\//, (route) =>
			route.fulfill({ status: 200, contentType: "text/css", body: "" }),
		);
		await page.route("https://www.desmos.com/api/**/calculator.js**", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/javascript",
				body: desmosStub,
			}),
		);
		const injectedRequests: string[] = [];
		page.on("request", (request) => {
			const url = request.url();
			if (
				url.includes("/@fortawesome/fontawesome-free") ||
				url.includes("fonts.googleapis.com") ||
				url.includes("ui.renaissance.com")
			)
				injectedRequests.push(url);
		});
		await page.goto(NDS_ICON_PAGE, { waitUntil: "networkidle" });
		const toolbar = page.locator("pie-item-toolbar").first();
		const calculatorButton = toolbar.locator("nds-icon-button").first();
		await expect(calculatorButton).toBeVisible();

		expect(await glyphWeights(toolbar)).toEqual(["fa-light"]);
		await calculatorButton.click();
		const shell = page.locator('[data-pie-tool-shell="calculator"]').first();
		await expect(shell).toBeVisible();
		expect(await glyphWeights(shell)).toEqual(["fa-regular"]);
		expect(injectedRequests).toEqual([]);
	});
});
