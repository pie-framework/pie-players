import { expect, test } from "@playwright/test";

const DEMO_PATH = "/demo/tts-ssml?mode=candidate&layout=splitpane";
const VERTICAL_DEMO_PATH = "/demo/tts-ssml?mode=candidate&layout=vertical";
const LOADING_EVENT_DEMO_PATH = "/demo/single-question?mode=candidate&layout=splitpane";

async function openEventPanel(page: import("@playwright/test").Page) {
	const toggleButton = page.getByRole("button", {
		name: "Toggle event broadcast panel",
	});
	await expect(toggleButton).toBeVisible();
	await expect(toggleButton).toBeEnabled();
	await toggleButton.click();
	const panel = page.locator("pie-section-player-tools-event-debugger");
	await expect(panel.locator(".pie-section-player-tools-event-debugger")).toBeVisible();
	return panel;
}

async function openSessionPanel(page: import("@playwright/test").Page) {
	const toggleButton = page.getByRole("button", {
		name: "Toggle session panel",
	});
	await expect(toggleButton).toBeVisible();
	await expect(toggleButton).toBeEnabled();
	await toggleButton.click();
	const panel = page.locator("pie-section-player-tools-session-debugger");
	await expect(panel.locator(".pie-section-player-tools-session-debugger")).toBeVisible();
	return panel;
}

async function openSourcePanel(page: import("@playwright/test").Page) {
	const toggleButton = page.getByRole("button", {
		name: "Toggle source panel",
	});
	await expect(toggleButton).toBeVisible();
	await expect(toggleButton).toBeEnabled();
	await toggleButton.click();
	const panel = page.locator(".pie-section-player-tools-source-panel");
	await expect(panel).toBeVisible();
	return panel;
}

async function openSessionControlsPanel(page: import("@playwright/test").Page) {
	const panel = page.getByRole("complementary", {
		name: "Session controls panel",
	});
	if (!(await panel.isVisible())) {
		const toggleButton = page.getByRole("button", {
			name: "Toggle host session controls panel",
		});
		await expect(toggleButton).toBeVisible();
		await expect(toggleButton).toBeEnabled();
		await toggleButton.click();
	}
	await expect(panel).toBeVisible();
	return panel;
}

async function openTTSSettingsPanel(page: import("@playwright/test").Page) {
	const panel = page.locator(".pie-tts-dialog-backdrop");
	if (!(await panel.isVisible())) {
		const toggleButton = page.getByRole("button", {
			name: "Toggle TTS settings panel",
		});
		await expect(toggleButton).toBeVisible();
		await expect(toggleButton).toBeEnabled();
		await toggleButton.click();
	}
	await expect(panel).toBeVisible();
	return panel;
}

async function getLocatorZIndex(
	locator: import("@playwright/test").Locator,
): Promise<number> {
	return locator.evaluate((node) => {
		const zIndex = window.getComputedStyle(node).zIndex;
		const parsed = Number.parseInt(zIndex || "", 10);
		return Number.isFinite(parsed) ? parsed : 0;
	});
}

async function focusPanelByHeader(args: {
	page: import("@playwright/test").Page;
	header: import("@playwright/test").Locator;
}) {
	const { page, header } = args;
	await header.scrollIntoViewIfNeeded();
	const box = await header.boundingBox();
	if (!box) {
		throw new Error("Panel header is not visible for focus interaction.");
	}
	const pointerX = box.x + Math.min(Math.max(12, box.width * 0.25), box.width - 8);
	const pointerY = box.y + Math.min(Math.max(8, box.height * 0.5), box.height - 4);
	await page.mouse.move(pointerX, pointerY);
	await page.mouse.down();
	await page.mouse.up();
}

async function triggerMouseDown(locator: import("@playwright/test").Locator) {
	await locator.evaluate((node) => {
		node.dispatchEvent(
			new MouseEvent("mousedown", {
				bubbles: true,
				cancelable: true,
				clientX: 2,
				clientY: 2,
			}),
		);
	});
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
	await expect.poll(async () => pane.evaluate((node) => node.scrollTop)).toBe(
		beforeSelectionScrollTop,
	);

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

	await expect
		.poll(async () => {
			const afterSelectionScrollTop = await pane.evaluate((node) => node.scrollTop);
			return Math.abs(afterSelectionScrollTop - beforeSelectionScrollTop);
		})
		.toBeLessThanOrEqual(24);
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
	test("shows section-loading-complete in section-level event panel", async ({
		page,
	}) => {
		// Wait for section readiness; subscribeSectionEvents should then immediately
		// deliver section-loading-complete when the runtime is fully loaded.
		await page.goto(LOADING_EVENT_DEMO_PATH, { waitUntil: "networkidle" });
		const panel = await openEventPanel(page);
		await panel
			.locator(".pie-section-player-tools-event-debugger__toggle-button", {
				hasText: "section",
			})
			.click();
		await page.evaluate(() => {
			const eventPanel = document.querySelector(
				"pie-section-player-tools-event-debugger",
			) as
				| (HTMLElement & {
						toolkitCoordinator?: {
							getSectionController?: (args: {
								sectionId: string;
								attemptId?: string;
							}) => {
								getRuntimeState?: () => { itemIdentifiers?: string[] } | null;
								handleContentRegistered?: (args: {
									itemId: string;
									canonicalItemId?: string;
									contentKind?: string;
								}) => void;
								handleContentLoaded?: (args: {
									itemId: string;
									canonicalItemId?: string;
									contentKind?: string;
									timestamp?: number;
								}) => void;
							} | null;
						};
						sectionId?: string;
						attemptId?: string;
				  })
				| null;
			const sectionId = eventPanel?.sectionId || "";
			const attemptId = eventPanel?.attemptId;
			const controller = eventPanel?.toolkitCoordinator?.getSectionController?.({
				sectionId,
				attemptId,
			});
			const runtimeState = controller?.getRuntimeState?.() || null;
			const itemIdentifiers = Array.isArray(runtimeState?.itemIdentifiers)
				? runtimeState.itemIdentifiers
				: [];
			for (const itemId of itemIdentifiers) {
				controller?.handleContentRegistered?.({
					itemId,
					canonicalItemId: itemId,
					contentKind: "item",
				});
				controller?.handleContentLoaded?.({
					itemId,
					canonicalItemId: itemId,
					contentKind: "item",
					timestamp: Date.now(),
				});
			}
		});
		await expect(
			panel
				.locator(".pie-section-player-tools-event-debugger__row")
				.filter({ hasText: /section-loading-complete/i })
				.first(),
		).toBeVisible({ timeout: 30_000 });
	});

	test("captures controller events and renders them", async ({ page }) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		const panel = await openEventPanel(page);

		const firstSelectable = page
			.locator("main.pie-section-player-items-pane")
			.locator('input[type="radio"], input[type="checkbox"]')
			.first();
		await firstSelectable.click();

		const panelRows = panel.locator(".pie-section-player-tools-event-debugger__row");
		await expect(
			panelRows
				.filter({ hasText: /item-session-data-changed|item-complete-changed/i })
				.first(),
		).toBeVisible({ timeout: 30_000 });
		await expect(panelRows.first()).toBeVisible();
	});

	test("brings selected debug window to foreground", async ({ page }) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		const sessionPanel = await openSessionPanel(page);
		const eventPanel = await openEventPanel(page);
		const sourcePanel = await openSourcePanel(page);
		const sessionControlsPanel = await openSessionControlsPanel(page);
		const sessionHeader = sessionPanel.locator(
			".pie-section-player-tools-session-debugger__header",
		);
		const sourceHeader = page.getByRole("button", {
			name: "Drag source panel",
		});

		await focusPanelByHeader({ page, header: sourceHeader });
		await expect
			.poll(async () => {
				const sourceZ = await getLocatorZIndex(sourcePanel);
				const sessionZ = await getLocatorZIndex(
					sessionPanel.locator(".pie-section-player-tools-session-debugger"),
				);
				const eventZ = await getLocatorZIndex(
					eventPanel.locator(".pie-section-player-tools-event-debugger"),
				);
				return sourceZ > sessionZ && sourceZ > eventZ;
			})
			.toBe(true);

		await focusPanelByHeader({ page, header: sessionHeader });
		await expect
			.poll(async () => {
				const sourceZ = await getLocatorZIndex(sourcePanel);
				const sessionZ = await getLocatorZIndex(
					sessionPanel.locator(".pie-section-player-tools-session-debugger"),
				);
				const eventZ = await getLocatorZIndex(
					eventPanel.locator(".pie-section-player-tools-event-debugger"),
				);
				return sessionZ > sourceZ && sessionZ > eventZ;
			})
			.toBe(true);

		const sessionControlsHeader = page.getByRole("button", {
			name: "Drag session controls panel",
		});
		await triggerMouseDown(sessionControlsHeader);
		await expect
			.poll(async () => {
				const controlsZ = await getLocatorZIndex(sessionControlsPanel);
				const sourceZ = await getLocatorZIndex(sourcePanel);
				const sessionZ = await getLocatorZIndex(
					sessionPanel.locator(".pie-section-player-tools-session-debugger"),
				);
				const eventZ = await getLocatorZIndex(
					eventPanel.locator(".pie-section-player-tools-event-debugger"),
				);
				return controlsZ > sourceZ && controlsZ > sessionZ && controlsZ > eventZ;
			})
			.toBe(true);

		const ttsPanel = await openTTSSettingsPanel(page);
		await expect
			.poll(async () => {
				const ttsZ = await getLocatorZIndex(ttsPanel);
				const controlsZ = await getLocatorZIndex(sessionControlsPanel);
				const sourceZ = await getLocatorZIndex(sourcePanel);
				const sessionZ = await getLocatorZIndex(
					sessionPanel.locator(".pie-section-player-tools-session-debugger"),
				);
				const eventZ = await getLocatorZIndex(
					eventPanel.locator(".pie-section-player-tools-event-debugger"),
				);
				return (
					ttsZ > controlsZ &&
					ttsZ > sourceZ &&
					ttsZ > sessionZ &&
					ttsZ > eventZ
				);
			})
			.toBe(true);
	});

	test("does not rely on replay when opened late", async ({ page }) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const firstSelectable = page
			.locator("main.pie-section-player-items-pane")
			.locator('input[type="radio"], input[type="checkbox"]')
			.first();
		await firstSelectable.click();

		const panel = await openEventPanel(page);
		await expect(
			panel.locator(".pie-section-player-tools-event-debugger__row").filter({
				hasText: /replayed/i,
			}),
		).toHaveCount(0);
		const secondSelectable = page
			.locator("main.pie-section-player-items-pane")
			.locator('input[type="radio"], input[type="checkbox"]')
			.nth(1);
		await secondSelectable.click();
		const panelRows = panel.locator(".pie-section-player-tools-event-debugger__row");
		await expect(
			panelRows
				.filter({ hasText: /item-session-data-changed|item-complete-changed/i })
				.first(),
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

		const firstSelectable = page
			.locator("main.pie-section-player-items-pane")
			.locator('input[type="radio"], input[type="checkbox"]')
			.first();
		await firstSelectable.click();
		await expect
			.poll(async () => await getItemShellIdentityTokens(page))
			.toEqual(beforeTokens);
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

		const firstSelectable = page
			.locator("main.pie-section-player-items-pane")
			.locator('input[type="radio"], input[type="checkbox"]')
			.first();
		await firstSelectable.click();
		let eventHistory: string[] = [];
		await expect
			.poll(async () => {
				eventHistory = await page.evaluate(() => {
					return [
						...((window as unknown as { __pieEventHistory?: string[] })
							.__pieEventHistory || []),
					];
				});
				return (
					eventHistory.includes("session-changed") &&
					eventHistory.includes("composition-changed")
				);
			})
			.toBe(true);
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
