import { expect, test, type Page } from "@playwright/test";

const DEMO_ID = "multiple-choice-radio-simple";
const PRELOADED_DELIVERY_PATH =
	`/demo/${DEMO_ID}/delivery?mode=gather&role=student&player=preloaded`;
const DELIVERY_PROMPT = "Which is the largest planet in our solar system?";
const SESSION_ENTRY_ID = "2";

type SessionSnapshot = {
	data?: Array<{
		id?: string;
		value?: string[];
	}>;
};

async function readSessionState(page: Page): Promise<SessionSnapshot> {
	const panel = page.locator("pie-item-player-session-debugger");
	const sessionTab = page.getByRole("tab", { name: "Session" });
	if (!(await sessionTab.isVisible().catch(() => false))) {
		await page.getByRole("button", { name: "Toggle item session panel" }).click();
	}
	await expect(sessionTab).toBeVisible();
	await sessionTab.click();
	const sessionJson = panel
		.locator(".pie-item-player-session-debugger__card")
		.filter({ hasText: "Session Data" })
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

		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({ timeout: 20_000 });

		await page
			.locator('label[for^="choice-"]')
			.filter({ hasText: "Mars" })
			.first()
			.click();

		const session = await readSessionState(page);
		const entry = session.data?.find((item) => item.id === SESSION_ENTRY_ID);
		expect(entry?.value?.[0]).toBeTruthy();
		expect(bundleRequests.length).toBeGreaterThan(0);
		expect(esmRequests.length).toBe(0);
	});
});
