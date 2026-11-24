import { expect, test, type Page } from "@playwright/test";
import { expectDemoChromeReady } from "../../../test-support/demo-menu";

/**
 * The measuring tools' graphics, the graph tool's grid slider and the tool
 * window's resize grip under a colour scheme. Each drew from a fixed colour the
 * scheme never reached: black marks on a white plate, the browser's accent and
 * a black alpha that vanished on a dark page.
 */
const DEMO_PATH = "/tts-ssml?mode=candidate&layout=splitpane";

const SCHEMES = [
	{
		scheme: "yellow-on-navy",
		text: "rgb(255, 255, 85)",
		background: "rgb(51, 80, 138)",
		primary: "rgb(255, 255, 153)",
		borderDark: "rgb(224, 224, 74)",
	},
	{
		scheme: "white-on-black",
		text: "rgb(255, 255, 255)",
		background: "rgb(0, 0, 0)",
		primary: "rgb(255, 255, 0)",
		borderDark: "rgb(255, 255, 255)",
	},
] as const;

async function openTool(page: Page, name: string) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expectDemoChromeReady(page);
	await page
		.locator(".pie-section-player-toolbar-pane--right pie-section-toolbar")
		.first()
		.getByRole("button", { name, exact: true })
		.click();
}

async function setHostScheme(page: Page, scheme: string) {
	await page
		.locator('pie-theme[scope="document"]')
		.evaluate((host, value) => host.setAttribute("scheme", value), scheme);
}

/** The ink and plate the graphic resolves to, read off the inline SVG. */
function graphicPaint(page: Page, selector: string, plate: string) {
	return page.locator(selector).evaluate((image, plateClass) => {
		const mark = image.querySelector(
			'svg [stroke="currentColor"]:not([class])',
		);
		const plateEl = image.querySelector(`.${plateClass}`);
		if (!mark || !plateEl) throw new Error("graphic is not inline");
		return {
			ink: getComputedStyle(mark).stroke,
			plate: getComputedStyle(plateEl).fill,
		};
	}, plate);
}

test.describe("tool graphics under a colour scheme", () => {
	for (const tool of [
		{
			name: "Ruler",
			image: ".pie-tool-ruler__image",
			plate: "pie-tool-ruler__plate",
		},
		{
			name: "Protractor",
			image: ".pie-tool-protractor__image",
			plate: "pie-tool-protractor__plate",
		},
	]) {
		test(`the ${tool.name.toLowerCase()} draws its marks in the scheme's ink`, async ({
			page,
		}) => {
			await openTool(page, tool.name);
			await expect(page.locator(tool.image)).toBeVisible();
			await expect(
				page.getByRole("img", { name: new RegExp(tool.name, "i") }),
			).toBeVisible();

			for (const { scheme, text, background } of SCHEMES) {
				await setHostScheme(page, scheme);
				await expect
					.poll(() => graphicPaint(page, tool.image, tool.plate), {
						message: scheme,
					})
					.toEqual({ ink: text, plate: background });
			}
		});
	}

	test("the graph slider and the tool window's grip follow the scheme", async ({
		page,
	}) => {
		await openTool(page, "Graph, coordinate plane");
		const shell = page.locator('[data-pie-tool-shell="graph"]').first();
		await expect(shell).toBeVisible();
		const slider = page.locator(
			".pie-tool-graph__transparency-control input[type='range']",
		);
		await expect(slider).toBeVisible();
		const grip = shell.locator(".pie-tool-shell__resize").nth(1);

		for (const { scheme, primary, borderDark } of SCHEMES) {
			await setHostScheme(page, scheme);
			await expect
				.poll(() => slider.evaluate((el) => getComputedStyle(el).accentColor), {
					message: scheme,
				})
				.toBe(primary);
			await expect
				.poll(
					() => grip.evaluate((el) => getComputedStyle(el).backgroundImage),
					{ message: `${scheme} grip` },
				)
				.toContain(`${borderDark} 40%`);
		}
	});
});
