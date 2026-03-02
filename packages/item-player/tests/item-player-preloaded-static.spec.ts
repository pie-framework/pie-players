import { expect, test, type Page } from "@playwright/test";

const PRELOADED_DELIVERY_PATH =
	"/demo/multiple-choice/delivery?mode=gather&role=student&player=preloaded";

type SessionSnapshot = {
	data?: Array<{
		id?: string;
		value?: string[];
	}>;
};

async function readSessionState(page: Page): Promise<SessionSnapshot> {
	const sessionJson = page
		.locator("div.card-body")
		.filter({ has: page.getByRole("heading", { name: "Session State" }) })
		.locator("pre")
		.first();
	await expect(sessionJson).toBeVisible();
	for (let attempt = 0; attempt < 30; attempt += 1) {
		const text = (await sessionJson.textContent()) || "";
		try {
			return JSON.parse(text) as SessionSnapshot;
		} catch {
			await page.waitForTimeout(150);
		}
	}
	throw new Error("Session JSON did not become parseable in time");
}

test.describe("item-player preloaded strategy", () => {
	test("renders and updates session using preloaded bundles", async ({ page }) => {
		const bundleRequests: string[] = [];
		const esmRequests: string[] = [];
		page.on("request", (request) => {
			const url = request.url();
			if (url.includes("/bundles/")) bundleRequests.push(url);
			if (url.includes("esm.sh")) esmRequests.push(url);
		});

		await page.goto(PRELOADED_DELIVERY_PATH, { waitUntil: "networkidle" });

		await expect(
			page.getByText("Which planet in our solar system has the most moons?"),
		).toBeVisible({ timeout: 20_000 });

		await page
			.locator('label[for^="choice-"]')
			.filter({ hasText: "Mars" })
			.first()
			.click();

		const session = await readSessionState(page);
		const q1 = session.data?.find((entry) => entry.id === "q1");
		expect(q1?.value?.[0]).toBeTruthy();
		expect(bundleRequests.length).toBeGreaterThan(0);
		expect(esmRequests.length).toBe(0);
	});
});
