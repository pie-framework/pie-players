import { expect, test, type Page } from "@playwright/test";

const DEMO_PATH = "/demo/tts-ssml?mode=candidate&layout=splitpane";

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
});

