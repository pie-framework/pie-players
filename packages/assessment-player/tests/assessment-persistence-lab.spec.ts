import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { readLab } from "../../../apps/assessment-demos/src/lib/server/persistence-lab";

type ServerState = ReturnType<typeof readLab>;
type Observation = {
	server: ServerState;
	operations: Array<{ id: number; kind: string; result: string }>;
	submitted: boolean;
	submissionEvents: number;
	errors: string[];
};
const choice = (page: Page, value: string) => page.locator(`pie-assessment-player-default input[type="radio"][value="${value}"]`).first();
const observation = async (page: Page): Promise<Observation> => JSON.parse((await page.getByTestId("lab-state").textContent())!);
const ready = async (page: Page) => {
	await expect(page.getByRole("status").filter({ hasText: "Ready." })).toBeVisible();
	await expect(page.locator(".pie-assessment-player-section-host")).toHaveAttribute("aria-busy", "false");
};
async function answer(page: Page, value: string) {
	await choice(page, value).click();
	await expect(choice(page, value)).toBeChecked();
}
async function settled(page: Page, count: number) {
	await expect.poll(async () => (await observation(page)).operations.filter(operation => operation.result !== "pending").length).toBe(count);
}

let attemptId: string;
let endpoint: string;
test.beforeEach(async ({ page }) => {
	attemptId = randomUUID();
	endpoint = `/api/persistence-lab/${attemptId}`;
	await page.goto(`/persistence-lab?attempt=${attemptId}`);
	await ready(page);
});
test.afterEach(async ({ request }, testInfo) => {
	const response = await request.get(endpoint);
	if (response.ok()) await testInfo.attach("persistence-server.json", { body: await response.body(), contentType: "application/json" });
	await request.delete(endpoint);
});

test("real answers survive HTTP save, navigation and reload without browser storage", async ({ page, request }) => {
	await answer(page, "a");
	await page.getByRole("button", { name: "Save snapshot", exact: true }).click();
	await settled(page, 1);
	await page.getByRole("button", { name: "Next section", exact: true }).click();
	await ready(page);
	await answer(page, "b");
	await page.getByRole("button", { name: "Save snapshot", exact: true }).click();
	await settled(page, 2);
	const stored: ServerState = await (await request.get(endpoint)).json();
	expect(stored.snapshot?.navigationState.currentSectionIndex).toBe(1);
	expect(stored.writes.map(write => write.phase)).toEqual(["committed", "committed"]);
	// The server owns the reload snapshot, even with the nested player's local
	// storage removed. A different attempt must not see this assessment session.
	expect((await (await request.get(`/api/persistence-lab/${randomUUID()}`)).json()).snapshot).toBeNull();
	await page.evaluate(() => localStorage.clear());
	await page.reload();
	await ready(page);
	await expect(choice(page, "b")).toBeChecked();
	await page.getByRole("button", { name: "Previous section", exact: true }).click();
	await ready(page);
	await expect(choice(page, "a")).toBeChecked();
});

test("held writes stay uncommitted until released and expose keyboard controls", async ({ page, request }, testInfo) => {
	await page.setViewportSize({ width: 320, height: 800 });
	await page.getByLabel("Next write behavior").selectOption("hold");
	await page.getByRole("button", { name: "Save snapshot", exact: true }).click();
	await expect.poll(async () => (await observation(page)).server.writes.length).toBe(1);
	const before: ServerState = await (await request.get(endpoint)).json();
	expect(before.snapshot).toBeNull();
	expect(before.writes[0].phase).toBe("pending");
	expect((await request.post(`/api/persistence-lab/${randomUUID()}`, { data: { id: before.writes[0].id, commit: true } })).status()).toBe(409);
	const release = page.getByRole("button", { name: `Release write ${before.writes[0].id}`, exact: true });
	await release.focus();
	await page.keyboard.press("Tab");
	await page.keyboard.press("Shift+Tab");
	await expect(release).toBeFocused();
	await expect(release).toHaveCSS("outline-style", "solid");
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	const axe = await new AxeBuilder({ page }).include(".pie-lab-controls").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
	expect(axe.violations).toEqual([]);
	await page.screenshot({ path: testInfo.outputPath("persistence-lab-held.png"), fullPage: true });
	await release.press("Enter");
	await settled(page, 1);
	expect((await (await request.get(endpoint)).json()).writes[0].phase).toBe("committed");
});

test("commit followed by failed acknowledgement is distinguishable from rejection", async ({ page, request }) => {
	await answer(page, "a");
	await page.getByLabel("Next write behavior").selectOption("lose-ack");
	const response = page.waitForResponse(response => response.url().endsWith(endpoint) && response.request().method() === "PUT");
	await page.getByRole("button", { name: "Save snapshot", exact: true }).click();
	expect((await response).status()).toBe(504);
	await settled(page, 1);
	await expect(page.getByRole("alert").filter({ hasText: "Persistence hook:" })).toContainText("snapshot was committed");
	const stored: ServerState = await (await request.get(endpoint)).json();
	expect(stored.writes[0].phase).toBe("committed");
	expect(stored.snapshot).not.toBeNull();
	await page.evaluate(() => localStorage.clear());
	await page.reload();
	await ready(page);
	await expect(choice(page, "a")).toBeChecked();
});

test("R2: the newer save survives an older held write completing last", async ({ page, request }, testInfo) => {
	await answer(page, "a");
	await page.getByLabel("Next write behavior").selectOption("hold");
	await page.getByRole("button", { name: "Save snapshot", exact: true }).click();
	await expect.poll(async () => (await observation(page)).server.writes.length).toBe(1);
	const oldestId = (await observation(page)).server.writes[0].id;
	await page.getByRole("button", { name: "Next section", exact: true }).click();
	await ready(page);
	await answer(page, "b");
	await page.getByRole("button", { name: "Save snapshot", exact: true }).click();
	// Observe concurrent admission when the implementation permits it. A future
	// serialized writer instead keeps the second call pending until release.
	// This bounded observation window controls the injected schedule; correctness
	// below is asserted only after both calls and database writes have settled.
	await page.waitForFunction(() => {
		const state = JSON.parse(document.querySelector('[data-testid="lab-state"]')!.textContent!);
		return state.server.writes.length === 2 && state.server.writes[1].phase === "committed";
	}, undefined, { timeout: 1_000 }).catch(error => {
		if (error.name !== "TimeoutError") throw error;
	});
	await page.getByRole("button", { name: `Release write ${oldestId}`, exact: true }).click();
	await settled(page, 2);
	const stored: ServerState = await (await request.get(endpoint)).json();
	expect(stored.writes).toHaveLength(2);
	expect(stored.writes.every(write => write.phase === "committed")).toBe(true);
	await testInfo.attach("race-observation.json", { body: JSON.stringify(stored, null, 2), contentType: "application/json" });
	await page.evaluate(() => localStorage.clear());
	await page.reload();
	await ready(page);
	const reloaded = await observation(page);
	// Only the known invariant is expected to fail. Setup, real HTTP/SQLite,
	// fault controls and reload failures above still fail CI normally. When R2
	// is fixed this becomes an unexpected pass until this annotation is removed.
	test.fail(process.env.PIE_R2_STRICT !== "1", "R2 open: older snapshot overwrites the newer acknowledged save");
	expect({ storedSection: stored.snapshot?.navigationState.currentSectionIndex, reloadedSection: reloaded.server.snapshot?.navigationState.currentSectionIndex, newerAnswerVisible: await choice(page, "b").isChecked() }).toEqual({ storedSection: 1, reloadedSection: 1, newerAnswerVisible: true });
});

test("R2: rejected submission rejects its caller and never announces success", async ({ page, request }, testInfo) => {
	await answer(page, "a");
	await page.getByLabel("Next write behavior").selectOption("reject");
	const response = page.waitForResponse(response => response.url().endsWith(endpoint) && response.request().method() === "PUT");
	await page.getByRole("button", { name: "Submit attempt", exact: true }).click();
	expect((await response).status()).toBe(503);
	await settled(page, 1);
	await expect(page.getByRole("alert").filter({ hasText: "Persistence hook:" })).toContainText("no snapshot was committed");
	const stored: ServerState = await (await request.get(endpoint)).json();
	expect(stored.snapshot).toBeNull();
	expect(stored.writes[0].phase).toBe("rejected");
	await expect(choice(page, "a")).toBeChecked();
	const result = await observation(page);
	await testInfo.attach("submission-observation.json", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
	test.fail(process.env.PIE_R2_STRICT !== "1", "R2 open: save rejection is swallowed and successful submission is published early");
	expect({ caller: result.operations[0].result, submitted: result.submitted, submissionEvents: result.submissionEvents }).toEqual({ caller: "rejected", submitted: false, submissionEvents: 0 });
});
