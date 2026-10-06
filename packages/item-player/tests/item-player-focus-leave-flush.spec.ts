/**
 * Focus leaving `<pie-item-player>` delivers the pending `session-changed`.
 *
 * A host that submits from a button outside the player and then unmounts it
 * reads the answer its `session-changed` listener stored. Inside an element's
 * debounce that answer is still pending when the button is pressed, and the
 * player's teardown commit runs after removal, where a listener on the host's
 * own container no longer hears it. So the response has to arrive when focus
 * leaves, ahead of the click or key that submits.
 *
 * All three engines: WebKit does not focus a clicked button, so the editor's
 * `focusout` carries no `relatedTarget` there.
 */

import { expect, test, type Page } from "@playwright/test";
import { openDemoMenuIfCollapsed } from "../../../test-support/demo-menu";

const DELIVERY_PATH =
	"/demo/extended-text-entry-default/delivery?mode=gather&role=student";
const DELIVERY_PROMPT = "This is the question prompt";
const TYPED = "Answer typed just before submitting";
// extended-text-entry's own debounce: an announcement inside it is the flush.
const ELEMENT_DEBOUNCE_MS = 1_500;

type HostEntry = {
	kind: "session-changed" | "submit";
	value?: unknown;
	complete?: unknown;
	component?: unknown;
	reason?: unknown;
	at: number;
};

declare global {
	interface Window {
		__hostEntries?: HostEntry[];
	}
}

async function typeAnswer(page: Page): Promise<number> {
	await page.goto(DELIVERY_PATH, { waitUntil: "domcontentloaded" });
	await expect(
		page.getByRole("navigation", { name: "Demo controls" }),
	).toBeVisible({ timeout: 15_000 });
	await openDemoMenuIfCollapsed(page);
	await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({
		timeout: 30_000,
	});
	await page.evaluate(() => {
		const entries: HostEntry[] = [];
		window.__hostEntries = entries;
		const player = document.querySelector("pie-item-player");
		const container = player?.parentElement;
		container?.addEventListener("session-changed", (event) => {
			const detail = (event as CustomEvent).detail ?? {};
			entries.push({
				kind: "session-changed",
				value: detail.session?.data?.find(
					(entry: { value?: unknown }) => typeof entry?.value === "string",
				)?.value,
				complete: detail.complete,
				component: detail.component,
				reason: detail.sessionCommitReason ?? null,
				at: performance.now(),
			});
		});
		const submit = document.createElement("button");
		submit.type = "button";
		submit.id = "host-submit";
		submit.textContent = "Submit";
		submit.addEventListener("click", () => {
			entries.push({ kind: "submit", at: performance.now() });
			player?.remove();
		});
		document.body.append(submit);
	});
	const editable = page
		.locator('pie-item-player [contenteditable="true"]')
		.first();
	await editable.click();
	await page.keyboard.type(TYPED);
	return page.evaluate(() => performance.now());
}

async function assertAnsweredBeforeSubmit(page: Page, typedAt: number) {
	await expect
		.poll(() =>
			page.evaluate(() =>
				(window.__hostEntries ?? []).some((entry) => entry.kind === "submit"),
			),
		)
		.toBe(true);
	await page.waitForTimeout(ELEMENT_DEBOUNCE_MS + 500);
	const entries = await page.evaluate(() => window.__hostEntries ?? []);
	const submitAt = entries.findIndex((entry) => entry.kind === "submit");
	const answered = entries
		.slice(0, submitAt)
		.find(
			(entry) =>
				entry.kind === "session-changed" &&
				typeof entry.value === "string" &&
				entry.value.includes(TYPED),
		);
	expect(
		answered,
		`the answer did not reach the host before it submitted: ${JSON.stringify(entries)}`,
	).toBeDefined();
	expect(answered?.complete).toBe(true);
	expect(typeof answered?.component).toBe("string");
	expect(answered?.reason).toBeNull();
	expect((answered?.at ?? Infinity) - typedAt).toBeLessThan(ELEMENT_DEBOUNCE_MS);
}

test.describe("item-player focus-leave flush", () => {
	test("a click on a host button outside the player", async ({ page }) => {
		const typedAt = await typeAnswer(page);
		await page.locator("#host-submit").click();
		await assertAnsweredBeforeSubmit(page, typedAt);
	});

	test("Tab to a host button outside the player, then Enter", async ({
		page,
		browserName,
	}) => {
		const typedAt = await typeAnswer(page);
		// WebKit tabs only to text fields unless Option is held.
		const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
		let focused = "";
		for (let presses = 0; presses < 60 && focused !== "host-submit"; presses += 1) {
			await page.keyboard.press(tab);
			focused = await page.evaluate(() => document.activeElement?.id ?? "");
		}
		expect(focused, "Tab never reached the host's button").toBe("host-submit");
		await page.keyboard.press("Enter");
		await assertAnsweredBeforeSubmit(page, typedAt);
	});
});
