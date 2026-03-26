import { expect, test } from "@playwright/test";

const DEMO_PATH = "/invalid-tools-config";

test.describe("section demo invalid tools-config error surfacing", () => {
	test("malformed host tools config surfaces framework diagnostics", async ({
		page,
	}) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		await expect(page.getByTestId("framework-error-event-count")).toHaveText(
			/^[1-9]\d*$/,
		);
		await expect(page.getByTestId("framework-error-last-meta")).toContainText(
			"coordinator-init / pie-assessment-toolkit",
		);
		await expect(page.getByTestId("framework-error-last-message")).toContainText(
			'Invalid tools config at "placement.section": expected an array of tool ids.',
		);
	});
});
