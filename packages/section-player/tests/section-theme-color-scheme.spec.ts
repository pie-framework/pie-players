import { expect, test, type Page } from "@playwright/test";

const DEMO_PATH = "/tts-ssml?mode=candidate&layout=splitpane";

async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expect(page.getByRole("link", { name: "Student" })).toBeVisible();
}

test.describe("section theme and color scheme integration", () => {
	test("propagates themed css variables to light and shadow dom", async ({ page }) => {
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
				light: getComputedStyle(lightNode).getPropertyValue("--pie-primary").trim(),
				shadow: getComputedStyle(shadowNode).getPropertyValue("--pie-primary").trim(),
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
				light: getComputedStyle(lightNode).getPropertyValue("--pie-primary").trim(),
				shadow: getComputedStyle(shadowNode).getPropertyValue("--pie-primary").trim(),
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
});

