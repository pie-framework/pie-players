/**
 * A host with its own section navigation, switching sections on one section
 * player element inside an element's `session-changed` debounce.
 *
 * Such a host handles a response for an item by making that item its current
 * one, and treats a response for an item outside its current section as fatal.
 * So the response has to reach it while the leaving item is still current -
 * before its navigation runs - and nothing for that item may arrive once the
 * section input has changed, including from the persist and teardown commits
 * that follow. The page emulates the host's order: current item, then the new
 * section on the same element, then a persist of the previous section.
 *
 * Runs in all three engines: WebKit does not focus a clicked button, so the
 * editor's `focusout` carries no `relatedTarget` there.
 */

import { expect, test, type Page } from "@playwright/test";

const DEMO = "/section-switch-commit";
const LEAVING_ITEM = "section-switch-item-one";
const TARGET_ITEM = "section-switch-item-two";
const TYPED = "Typed just before the host navigates";
// extended-text-entry's own debounce: an announcement inside it is the flush.
const ELEMENT_DEBOUNCE_MS = 1_500;

type HostLogEntry = {
	channel: string;
	itemId?: string;
	canonicalItemId?: string;
	complete?: unknown;
	reason?: unknown;
	response?: string;
	at: number;
};

declare global {
	interface Window {
		__hostLog?: HostLogEntry[];
	}
}

const isHostMarker = (entry: HostLogEntry) => entry.channel.startsWith("host:");
const isLeavingItem = (entry: HostLogEntry) =>
	!isHostMarker(entry) &&
	[entry.itemId, entry.canonicalItemId].some((id) =>
		String(id ?? "").startsWith(LEAVING_ITEM),
	);

async function typeIntoLeavingItem(page: Page): Promise<number> {
	await page.goto(DEMO, { waitUntil: "domcontentloaded" });
	const editor = page
		.locator('pie-section-player-splitpane [contenteditable="true"]')
		.first();
	await expect(editor).toBeVisible({ timeout: 45_000 });
	await expect
		.poll(() => page.evaluate(() => Array.isArray(window.__hostLog)), {
			timeout: 15_000,
		})
		.toBe(true);
	await editor.click();
	await page.keyboard.type(TYPED);
	return page.evaluate(() => performance.now());
}

async function readHostLog(page: Page): Promise<HostLogEntry[]> {
	await expect(page.getByTestId("host-current-item")).toHaveText(TARGET_ITEM);
	// Past the element's debounce and the old section's teardown, so a late
	// event for the leaving item is caught here.
	await page.waitForTimeout(ELEMENT_DEBOUNCE_MS + 1_500);
	return page.evaluate(() => window.__hostLog ?? []);
}

function assertHostOrdering(log: HostLogEntry[], typedAt: number) {
	const currentItemAt = log.findIndex(
		(entry) => entry.channel === "host:current-item",
	);
	const sectionInputAt = log.findIndex(
		(entry) => entry.channel === "host:section-input",
	);
	expect(currentItemAt, JSON.stringify(log)).toBeGreaterThanOrEqual(0);
	expect(sectionInputAt).toBeGreaterThan(currentItemAt);

	const announcements = log
		.slice(0, currentItemAt)
		.filter(
			(entry) =>
				isLeavingItem(entry) &&
				entry.channel === "coordinator:item-session-data-changed" &&
				entry.response?.includes(TYPED),
		);
	expect(
		announcements,
		`the response did not reach the host before it navigated: ${JSON.stringify(log)}`,
	).not.toHaveLength(0);
	const announcement = announcements[0];
	expect(announcement.complete).toBe(true);
	expect(announcement.reason).toBeNull();
	expect(announcement.at - typedAt).toBeLessThan(ELEMENT_DEBOUNCE_MS);

	const late = log.slice(sectionInputAt).filter(isLeavingItem);
	expect(
		late,
		`the leaving item was announced after the section changed: ${JSON.stringify(late)}`,
	).toEqual([]);

	const commits = log.filter(
		(entry) => isLeavingItem(entry) && entry.reason !== null,
	);
	expect(commits, "a commit found the response still pending").toEqual([]);
}

test.describe("host section navigation mid-debounce", () => {
	test("a click on the host's navigation", async ({ page }) => {
		const typedAt = await typeIntoLeavingItem(page);
		await page.locator("#host-next-section").click();
		assertHostOrdering(await readHostLog(page), typedAt);
	});

	test("Tab to the host's navigation, then Enter", async ({
		page,
		browserName,
	}) => {
		const typedAt = await typeIntoLeavingItem(page);
		// WebKit tabs only to text fields unless Option is held.
		const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
		let focused = "";
		for (
			let presses = 0;
			presses < 40 && focused !== "host-next-section";
			presses += 1
		) {
			await page.keyboard.press(tab);
			focused = await page.evaluate(() => document.activeElement?.id ?? "");
		}
		expect(focused, "Tab never reached the host's navigation").toBe(
			"host-next-section",
		);
		await page.keyboard.press("Enter");
		assertHostOrdering(await readHostLog(page), typedAt);
	});
});

// A swap on the live element has to show the new section's items and none of
// the previous section's, in both directions and in either order of the two
// inputs. `section-id` then `section` froze the section player under Svelte
// 5.57.0: the new section reached `<pie-section-player-base>` and never its
// toolkit. Svelte 5.57.1 fixes it with
// https://github.com/sveltejs/svelte/pull/18508. `section` then `section-id` is
// the order an Angular host's `[section]` and `[attr.section-id]` bindings
// produce.
test.describe("host section navigation renders the new section", () => {
	const FIRST_PROMPT = "Describe the first thing you noticed.";
	const SECOND_PROMPT = "Describe the second thing you noticed.";

	const cases = ["iife", "esm"].flatMap((player) =>
		["section-id-first", "section-first"].map((order) => ({ player, order })),
	);

	for (const { player, order } of cases) {
		test(`${player}, ${order}: next, then previous`, async ({ page }) => {
			await page.goto(`${DEMO}?player=${player}&order=${order}`, {
				waitUntil: "domcontentloaded",
			});
			const sectionPlayer = page.locator("pie-section-player-splitpane");
			await expect(sectionPlayer.getByText(FIRST_PROMPT)).toBeVisible({
				timeout: 45_000,
			});

			await page.locator("#host-next-section").click();
			await expect(sectionPlayer.getByText(SECOND_PROMPT)).toBeVisible({
				timeout: 15_000,
			});
			await expect(sectionPlayer.getByText(FIRST_PROMPT)).toHaveCount(0);

			await page.locator("#host-previous-section").click();
			await expect(sectionPlayer.getByText(FIRST_PROMPT)).toBeVisible({
				timeout: 15_000,
			});
			await expect(sectionPlayer.getByText(SECOND_PROMPT)).toHaveCount(0);
		});
	}
});
