import { expect, test, type Page } from "@playwright/test";

const DEMO_PATH = "/tts-ssml?mode=candidate&layout=splitpane";

async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expect(page.getByRole("link", { name: "Student" })).toBeVisible();
}

test.describe("section theme and color scheme integration", () => {
	test("propagates themed css variables to light and shadow dom", async ({
		page,
	}) => {
		await gotoDemo(page);

		const vars = await page.evaluate(() => {
			const themeHost = document.querySelector("pie-theme");
			if (!themeHost) {
				return { light: "", shadow: "" };
			}
			themeHost.setAttribute("scheme", "white-on-black");

			const lightNode = document.createElement("div");
			lightNode.id = "light-dom-theme-probe";
			document.body.appendChild(lightNode);

			const shadowHost = document.createElement("div");
			shadowHost.id = "shadow-dom-theme-host";
			const root = shadowHost.attachShadow({ mode: "open" });
			const shadowNode = document.createElement("span");
			shadowNode.id = "shadow-dom-theme-probe";
			root.appendChild(shadowNode);
			document.body.appendChild(shadowHost);

			return {
				light: getComputedStyle(lightNode)
					.getPropertyValue("--pie-primary")
					.trim(),
				shadow: getComputedStyle(shadowNode)
					.getPropertyValue("--pie-primary")
					.trim(),
			};
		});

		expect(vars.light).toBeTruthy();
		expect(vars.light).toBe("#ffff00");
		expect(vars.shadow).toBe(vars.light);
	});

	test("updates existing light and shadow nodes when scheme switches", async ({
		page,
	}) => {
		await gotoDemo(page);

		const vars = await page.evaluate(() => {
			const themeHost = document.querySelector("pie-theme");
			if (!themeHost) {
				return {
					blackOnWhite: { light: "", shadow: "" },
					whiteOnBlack: { light: "", shadow: "" },
				};
			}

			const lightNode = document.createElement("div");
			lightNode.id = "light-dom-theme-switch-probe";
			document.body.appendChild(lightNode);

			const shadowHost = document.createElement("div");
			shadowHost.id = "shadow-dom-theme-switch-host";
			const root = shadowHost.attachShadow({ mode: "open" });
			const shadowNode = document.createElement("span");
			shadowNode.id = "shadow-dom-theme-switch-probe";
			root.appendChild(shadowNode);
			document.body.appendChild(shadowHost);

			const readVars = () => ({
				light: getComputedStyle(lightNode)
					.getPropertyValue("--pie-primary")
					.trim(),
				shadow: getComputedStyle(shadowNode)
					.getPropertyValue("--pie-primary")
					.trim(),
			});

			themeHost.setAttribute("scheme", "black-on-white");
			const blackOnWhite = readVars();
			themeHost.setAttribute("scheme", "white-on-black");
			const whiteOnBlack = readVars();

			return { blackOnWhite, whiteOnBlack };
		});

		expect(vars.blackOnWhite.light).toBeTruthy();
		expect(vars.blackOnWhite.shadow).toBe(vars.blackOnWhite.light);
		expect(vars.whiteOnBlack.light).toBe("#ffff00");
		expect(vars.whiteOnBlack.shadow).toBe(vars.whiteOnBlack.light);
		expect(vars.whiteOnBlack.light).not.toBe(vars.blackOnWhite.light);
	});

	test("offers the low-glare schemes in the theme picker and applies them", async ({
		page,
	}) => {
		const SCHEMES = [
			{
				id: "grey-on-light-grey",
				name: "Grey on Light Grey",
				bg: "rgb(235, 235, 235)",
				text: "rgb(74, 74, 74)",
			},
			{
				id: "purple-on-light-green",
				name: "Purple on Light Green",
				bg: "rgb(204, 232, 212)",
				text: "rgb(142, 36, 100)",
			},
			{
				id: "black-on-violet",
				name: "Black on Violet",
				bg: "rgb(212, 169, 222)",
				text: "rgb(0, 0, 0)",
			},
			{
				id: "yellow-on-navy",
				name: "Yellow on Navy",
				bg: "rgb(51, 80, 138)",
				text: "rgb(255, 255, 85)",
			},
		];

		await gotoDemo(page);
		await page
			.getByRole("button", { name: "Theme - Change colors and contrast" })
			.first()
			.click();
		const themeTool = page.locator("pie-tool-theme").first();
		await expect(themeTool).toBeVisible();
		await themeTool.getByRole("button", { name: "Select theme" }).click();

		// The picker derives its list from listPieColorSchemes(), so every
		// registered scheme has to show up as a menu item.
		for (const scheme of SCHEMES) {
			await expect(
				themeTool.getByRole("menuitem", { name: scheme.name, exact: true }),
				`${scheme.name} listed in picker`,
			).toBeVisible();
		}

		// Selecting through the picker applies the scheme's tokens...
		await themeTool
			.getByRole("menuitem", { name: SCHEMES[0].name, exact: true })
			.click();
		const readApplied = async (schemeId?: string) =>
			await page.evaluate(async (id) => {
				if (id) {
					const host =
						document.querySelector('pie-theme[scope="document"]') ||
						document.querySelector("pie-theme");
					host?.setAttribute("scheme", id);
				}
				await new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve)),
				);
				const probe = document.createElement("div");
				probe.style.color = "var(--pie-text)";
				probe.style.backgroundColor = "var(--pie-background)";
				document.body.appendChild(probe);
				const computed = getComputedStyle(probe);
				const applied = {
					bg: computed.backgroundColor,
					text: computed.color,
				};
				probe.remove();
				return applied;
			}, schemeId);

		const viaPicker = await readApplied();
		expect(viaPicker.bg).toBe(SCHEMES[0].bg);
		expect(viaPicker.text).toBe(SCHEMES[0].text);

		// ...and each scheme resolves its background/text pair.
		for (const scheme of SCHEMES) {
			const applied = await readApplied(scheme.id);
			expect(applied.bg, `${scheme.id} background`).toBe(scheme.bg);
			expect(applied.text, `${scheme.id} text`).toBe(scheme.text);
		}
	});
});
