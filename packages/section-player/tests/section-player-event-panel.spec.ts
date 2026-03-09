import { expect, test } from "@playwright/test";

const DEMO_PATH = "/demo/tts-ssml?mode=candidate&layout=splitpane";
const VERTICAL_DEMO_PATH = "/demo/tts-ssml?mode=candidate&layout=vertical";

async function openEventPanel(page: import("@playwright/test").Page) {
	await page
		.getByRole("button", { name: "Toggle event broadcast panel" })
		.click({ force: true });
	const panel = page.locator("pie-section-player-tools-event-debugger");
	await expect(panel.locator(".pie-section-player-tools-event-debugger")).toBeVisible();
	return panel;
}

async function assertChoiceSelectionKeepsPaneScroll(args: {
	page: import("@playwright/test").Page;
	paneSelector: string;
}) {
	const { page, paneSelector } = args;
	const pane = page.locator(paneSelector);
	await expect(pane).toBeVisible();

	const scrollMetrics = await pane.evaluate((node) => ({
		maxScrollTop: Math.max(0, node.scrollHeight - node.clientHeight),
		clientHeight: node.clientHeight,
		scrollHeight: node.scrollHeight,
	}));
	expect(
		scrollMetrics.maxScrollTop,
		`Expected pane to be scrollable (client=${scrollMetrics.clientHeight}, scroll=${scrollMetrics.scrollHeight})`,
	).toBeGreaterThan(80);

	const beforeSelectionScrollTop = await pane.evaluate((node) => {
		const targetScrollTop = Math.max(
			24,
			Math.floor((node.scrollHeight - node.clientHeight) * 0.65),
		);
		node.scrollTop = targetScrollTop;
		return node.scrollTop;
	});
	await page.waitForTimeout(150);

	await pane.evaluate((node) => {
		const paneRect = node.getBoundingClientRect();
		const inputs = Array.from(
			node.querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]'),
		);
		const visibleInput = inputs.find((input) => {
			const rect = input.getBoundingClientRect();
			return rect.top >= paneRect.top && rect.bottom <= paneRect.bottom;
		});
		if (!visibleInput) {
			throw new Error("No visible selectable input found in pane.");
		}
		visibleInput.click();
	});

	await page.waitForTimeout(500);
	const afterSelectionScrollTop = await pane.evaluate((node) => node.scrollTop);
	expect(
		Math.abs(afterSelectionScrollTop - beforeSelectionScrollTop),
		`Pane scroll should remain stable after selection (before=${beforeSelectionScrollTop}, after=${afterSelectionScrollTop}).`,
	).toBeLessThanOrEqual(24);
}

async function getItemShellIdentityTokens(page: import("@playwright/test").Page) {
	const itemShells = page.locator('pie-item-shell[data-pie-shell-root="item"]');
	await expect(itemShells).toHaveCount(3);
	return itemShells.evaluateAll((nodes) => {
		const globalState = window as unknown as {
			__pieItemShellIdentityMap?: WeakMap<Element, string>;
			__pieItemShellIdentityCounter?: number;
		};
		const identityMap =
			globalState.__pieItemShellIdentityMap ||
			(globalState.__pieItemShellIdentityMap = new WeakMap<Element, string>());
		let counter = globalState.__pieItemShellIdentityCounter || 0;
		const tokens = nodes.map((node) => {
			let token = identityMap.get(node);
			if (!token) {
				counter += 1;
				token = `shell-${counter}`;
				identityMap.set(node, token);
			}
			return token;
		});
		globalState.__pieItemShellIdentityCounter = counter;
		return tokens;
	});
}

test.describe("section player controller event panel", () => {
	test("captures controller events and renders them", async ({ page }) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		const panel = await openEventPanel(page);

		const firstSelectable = page.locator('input[type="radio"], input[type="checkbox"]').first();
		await firstSelectable.click({ force: true });

		const panelRows = panel.locator(".pie-section-player-tools-event-debugger__row");
		await expect(
			panelRows
				.filter({ hasText: /item-session-data-changed|item-complete-changed/i })
				.first(),
		).toBeVisible({ timeout: 30_000 });
		await expect(panelRows.first()).toBeVisible();
	});

	test("replays critical lifecycle state when opened late", async ({ page }) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const firstSelectable = page.locator('input[type="radio"], input[type="checkbox"]').first();
		await firstSelectable.click({ force: true });

		const panel = await openEventPanel(page);
		await panel.getByRole("button", { name: "section" }).click();
		const panelRows = panel.locator(".pie-section-player-tools-event-debugger__row");
		await expect(
			panelRows.filter({ hasText: "replayed" }).first(),
		).toBeVisible({ timeout: 30_000 });
	});

	test("keeps items pane scroll position when selecting a choice", async ({ page }) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		await assertChoiceSelectionKeepsPaneScroll({
			page,
			paneSelector: "main.pie-section-player-items-pane",
		});
	});

	test("keeps vertical layout scroll position when selecting a choice", async ({
		page,
	}) => {
		await page.goto(VERTICAL_DEMO_PATH, { waitUntil: "networkidle" });
		await assertChoiceSelectionKeepsPaneScroll({
			page,
			paneSelector: ".pie-section-player-vertical-content",
		});
	});

	test("keeps item shell identity stable on session-only updates", async ({
		page,
	}) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		const beforeTokens = await getItemShellIdentityTokens(page);

		const firstSelectable = page.locator('input[type="radio"], input[type="checkbox"]').first();
		await firstSelectable.click({ force: true });
		await page.waitForTimeout(400);

		const afterTokens = await getItemShellIdentityTokens(page);
		expect(afterTokens).toEqual(beforeTokens);
	});

	test("emits runtime and composition events in expected directions", async ({
		page,
	}) => {
		await page.addInitScript(() => {
			const runtimeWindow = window as unknown as {
				__pieEventHistory?: string[];
				__pieDispatchPatched?: boolean;
			};
			if (runtimeWindow.__pieDispatchPatched) return;
			runtimeWindow.__pieEventHistory = [];
			runtimeWindow.__pieDispatchPatched = true;
			const trackedEvents = new Set([
				"runtime-owned",
				"runtime-inherited",
				"composition-changed",
				"session-changed",
			]);
			const originalDispatch = EventTarget.prototype.dispatchEvent;
			EventTarget.prototype.dispatchEvent = function patchedDispatch(event: Event) {
				if (trackedEvents.has(event.type)) {
					runtimeWindow.__pieEventHistory?.push(event.type);
				}
				return originalDispatch.call(this, event);
			};
		});
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const firstSelectable = page.locator('input[type="radio"], input[type="checkbox"]').first();
		await firstSelectable.click({ force: true });
		await page.waitForTimeout(500);

		const eventHistory = await page.evaluate(() => {
			return [
				...((window as unknown as { __pieEventHistory?: string[] })
					.__pieEventHistory || []),
			];
		});
		expect(eventHistory).toContain("session-changed");
		expect(eventHistory).toContain("composition-changed");
		const runtimeDirectionEvents = eventHistory.filter(
			(eventName) =>
				eventName === "runtime-owned" || eventName === "runtime-inherited",
		);
		expect(
			runtimeDirectionEvents.length,
			`Expected runtime ownership direction events, received: ${JSON.stringify(eventHistory)}`,
		).toBeGreaterThan(0);
	});
});
