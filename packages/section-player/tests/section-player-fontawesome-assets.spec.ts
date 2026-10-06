import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * The demos link FontAwesome in their own document head, which the toolbar and
 * the read-aloud trigger detect and reuse. These tests strip those links and
 * serve no `/_fa-pro/` path, the setup of a host that links no FontAwesome: the
 * players then add FA Free for the glyphs they render, and probe FA Pro Light
 * only for NDS icon buttons.
 */
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
		if (/roboto/i.test(request.url())) requests.push("roboto");
	});
	await page.route("**/_fa-pro/**", (route) =>
		route.fulfill({ status: 404, body: "" }),
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
			/<link rel="stylesheet" href="\/_(?:fa-pro|roboto)\/[^"]*" \/>/g,
			"",
		);
		await route.fulfill({ response, body });
	});
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

	test("NDS icon buttons probe each FA Pro stylesheet once", async ({
		page,
	}) => {
		const requests = await asHostWithoutFontAwesome(page);
		await page.goto(NDS_ICON_PAGE, { waitUntil: "networkidle" });
		const toolbar = page.locator("pie-item-toolbar").first();
		await expect(toolbar.locator("nds-icon-button").first()).toBeVisible();
		await expect(
			page.locator("pie-tool-tts-inline nds-icon-button").first(),
		).toBeVisible();

		// The toolbar's shadow root copies the stylesheet that loaded and skips the
		// probes that failed, so the probes are not requested again.
		await expect
			.poll(() => shadowStylesheets(toolbar))
			.toEqual([expect.stringContaining("/@fortawesome/fontawesome-free@")]);
		expect(count(requests, "/_fa-pro/fontawesome.min.css")).toBe(1);
		expect(count(requests, "/_fa-pro/light.min.css")).toBe(1);
		expect(count(requests, "fa-free")).toBe(1);
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
		expect(count(requests, "/_fa-pro/fontawesome.min.css")).toBe(1);
		expect(count(requests, "/_fa-pro/light.min.css")).toBe(1);
		expect(count(requests, "fa-free")).toBe(1);
	});
});
