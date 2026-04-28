import { expect, test } from "@playwright/test";

/**
 * PIE-512 regression e2e.
 *
 * Drives the responsive scenario reported by the consumer (320×900
 * split-pane, navigation across asymmetric sections) and subscribes to the
 * toolkit coordinator's item / section lifecycle helpers via the
 * event-debugger so deliveries are observed exactly the way an integrating
 * host sees them.
 *
 * The PIE-512 demo intentionally configures the section-player elements
 * with `lazy-init={true}`, so item lifecycle handlers are NOT driven by
 * natural network bundle loading in this environment. To get into the
 * "controller has finished loading, late subscriber arrives" state that
 * the regression occurs in, the test mirrors the established pattern from
 * `section-player-event-panel.spec.ts` and drives
 * `handleContentRegistered` + `handleContentLoaded` for each item id
 * before subscribing.
 *
 * The flow per cohort is intentionally:
 *   1. navigate to the section,
 *   2. open the event-debugger panel (so the coordinator + attemptId are
 *      available without the test owning that wiring),
 *   3. drive the controller's load handlers — at that point live
 *      `content-loaded` and `section-loading-complete` events fire and
 *      are missed by any not-yet-attached subscriber,
 *   4. subscribe AFTER the drive finishes — this exercises the
 *      coordinator's replay path. PIE-512 regressed precisely on the
 *      `content-loaded` half of that replay; pre-fix the late subscriber
 *      observed only `section-loading-complete` and silently dropped
 *      every `content-loaded` event for items that finished loading
 *      before the subscription attached.
 *
 * The assertion below pins both the count of replayed `content-loaded`
 * events and the ordering invariant (every `content-loaded` must arrive
 * before the single `section-loading-complete`). A `.some(...)` check
 * would silently pass on a "first item only" replay regression or an
 * inverted-order replay.
 */

const DEMO_BASE = "/pie-512-asymmetric-sections?mode=candidate&layout=splitpane";
const SECTION_A_PATH = `${DEMO_BASE}&page=pie-512-section-a`;
const SECTION_B_PATH = `${DEMO_BASE}&page=pie-512-section-b`;
const SECTION_A_ID = "pie-512-section-a";
const SECTION_B_ID = "pie-512-section-b";

type Pie512Event = {
	type: string;
	sectionId: string;
};

declare global {
	interface Window {
		__pie512Events?: Pie512Event[];
		__pie512Subscriptions?: Array<() => void>;
	}
}

type ControllerHandle = {
	getRuntimeState?: () => {
		itemIdentifiers?: string[];
		loadingComplete?: boolean;
	} | null;
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
};

type EventPanelHandle = HTMLElement & {
	toolkitCoordinator?: {
		subscribeItemEvents?: (args: {
			sectionId: string;
			attemptId?: string;
			eventTypes?: string[];
			listener: (event: { type: string }) => void;
		}) => () => void;
		subscribeSectionLifecycleEvents?: (args: {
			sectionId: string;
			attemptId?: string;
			eventTypes?: string[];
			listener: (event: { type: string }) => void;
		}) => () => void;
		getSectionController?: (args: {
			sectionId: string;
			attemptId?: string;
		}) => ControllerHandle | null;
	};
	sectionId?: string;
	attemptId?: string;
};

async function openEventPanel(
	page: import("@playwright/test").Page,
): Promise<void> {
	// Narrow-viewport toolbar items overlap, so click via JavaScript bypasses
	// pointer-event interception. The regression we test is event delivery,
	// not toolbar hit-testing.
	await page.evaluate(() => {
		const button = document.querySelector(
			'button[aria-label="Toggle event broadcast panel"]',
		) as HTMLButtonElement | null;
		if (!button) {
			throw new Error(
				"[pie-512 e2e] event broadcast toggle button not found",
			);
		}
		const pressed = button.getAttribute("aria-pressed") === "true";
		if (!pressed) {
			button.click();
		}
	});
	const panel = page.locator("pie-section-player-tools-event-debugger");
	await expect(panel).toBeAttached();
	await page.waitForFunction(() => {
		const eventPanel = document.querySelector(
			"pie-section-player-tools-event-debugger",
		) as EventPanelHandle | null;
		return Boolean(eventPanel?.toolkitCoordinator && eventPanel?.attemptId);
	});
}

/**
 * Drive the section controller's item lifecycle handlers — matches the
 * helper used in `section-player-event-panel.spec.ts`. After this resolves
 * the controller has fired live `content-loaded` events for every item id
 * plus the aggregate `section-loading-complete`. Any subscriber attached
 * AFTER this resolves only sees those events through the coordinator
 * replay path, which is what PIE-512 covers.
 */
async function driveControllerLoadFor(
	page: import("@playwright/test").Page,
	sectionId: string,
): Promise<void> {
	await page.waitForFunction(
		(targetSectionId: string) => {
			const eventPanel = document.querySelector(
				"pie-section-player-tools-event-debugger",
			) as EventPanelHandle | null;
			const coordinator = eventPanel?.toolkitCoordinator;
			const attemptId = eventPanel?.attemptId;
			if (!coordinator || !attemptId) return false;
			const controller = coordinator.getSectionController?.({
				sectionId: targetSectionId,
				attemptId,
			});
			const runtimeState = controller?.getRuntimeState?.();
			const ids = runtimeState?.itemIdentifiers;
			return Array.isArray(ids) && ids.length > 0;
		},
		sectionId,
		{ timeout: 30_000 },
	);

	await page.evaluate((targetSectionId: string) => {
		const eventPanel = document.querySelector(
			"pie-section-player-tools-event-debugger",
		) as EventPanelHandle | null;
		const coordinator = eventPanel?.toolkitCoordinator;
		const attemptId = eventPanel?.attemptId;
		if (!coordinator || !attemptId) {
			throw new Error(
				`[pie-512 e2e] coordinator unavailable while driving section ${targetSectionId}`,
			);
		}
		const controller = coordinator.getSectionController?.({
			sectionId: targetSectionId,
			attemptId,
		});
		if (!controller) {
			throw new Error(
				`[pie-512 e2e] no controller for section ${targetSectionId}`,
			);
		}
		const runtimeState = controller.getRuntimeState?.() ?? null;
		const itemIdentifiers = Array.isArray(runtimeState?.itemIdentifiers)
			? runtimeState.itemIdentifiers
			: [];
		for (const itemId of itemIdentifiers) {
			controller.handleContentRegistered?.({
				itemId,
				canonicalItemId: itemId,
				contentKind: "item",
			});
			controller.handleContentLoaded?.({
				itemId,
				canonicalItemId: itemId,
				contentKind: "item",
				timestamp: Date.now(),
			});
		}
	}, sectionId);

	// Confirm the drive landed before the test subscribes. If the drive
	// somehow no-oped (handler missing, controller swap mid-drive), the
	// test should fail loudly here rather than producing a misleading
	// "0 events replayed" assertion downstream.
	await page.waitForFunction(
		(targetSectionId: string) => {
			const eventPanel = document.querySelector(
				"pie-section-player-tools-event-debugger",
			) as EventPanelHandle | null;
			const coordinator = eventPanel?.toolkitCoordinator;
			const attemptId = eventPanel?.attemptId;
			if (!coordinator || !attemptId) return false;
			const controller = coordinator.getSectionController?.({
				sectionId: targetSectionId,
				attemptId,
			});
			const runtimeState = controller?.getRuntimeState?.() ?? null;
			return Boolean(runtimeState?.loadingComplete);
		},
		sectionId,
		{ timeout: 30_000 },
	);
}

async function ensureSubscriptionsForSection(
	page: import("@playwright/test").Page,
	sectionId: string,
): Promise<void> {
	await page.evaluate((targetSectionId: string) => {
		const eventPanel = document.querySelector(
			"pie-section-player-tools-event-debugger",
		) as EventPanelHandle | null;
		const coordinator = eventPanel?.toolkitCoordinator;
		const attemptId = eventPanel?.attemptId;
		if (!coordinator || !attemptId) {
			throw new Error(
				`[pie-512 e2e] could not resolve toolkit coordinator for section ${targetSectionId}`,
			);
		}
		if (!Array.isArray(window.__pie512Events)) {
			window.__pie512Events = [];
		}
		if (!Array.isArray(window.__pie512Subscriptions)) {
			window.__pie512Subscriptions = [];
		}
		const events = window.__pie512Events;
		const recordEvent = (type: string) => {
			events.push({ type, sectionId: targetSectionId });
		};
		const itemUnsub = coordinator.subscribeItemEvents?.({
			sectionId: targetSectionId,
			attemptId,
			eventTypes: ["content-loaded"],
			listener: (event) => recordEvent(event.type),
		});
		const sectionUnsub = coordinator.subscribeSectionLifecycleEvents?.({
			sectionId: targetSectionId,
			attemptId,
			eventTypes: ["section-loading-complete"],
			listener: (event) => recordEvent(event.type),
		});
		if (itemUnsub) window.__pie512Subscriptions.push(itemUnsub);
		if (sectionUnsub) window.__pie512Subscriptions.push(sectionUnsub);
	}, sectionId);
}

async function readEventsForSection(
	page: import("@playwright/test").Page,
	sectionId: string,
): Promise<Pie512Event[]> {
	return page.evaluate((targetSectionId: string) => {
		const events = Array.isArray(window.__pie512Events)
			? window.__pie512Events
			: [];
		return events.filter((entry) => entry.sectionId === targetSectionId);
	}, sectionId);
}

async function expectSectionEvents(
	page: import("@playwright/test").Page,
	sectionId: string,
	expectedContentLoadedCount: number,
): Promise<void> {
	await expect
		.poll(
			async () => {
				const events = await readEventsForSection(page, sectionId);
				const types = events.map((entry) => entry.type);
				const lastContentIdx = types.lastIndexOf("content-loaded");
				const firstCompleteIdx = types.indexOf(
					"section-loading-complete",
				);
				return {
					contentLoadedCount: types.filter(
						(type) => type === "content-loaded",
					).length,
					sectionLoadingCompleteCount: types.filter(
						(type) => type === "section-loading-complete",
					).length,
					contentLoadedBeforeSectionComplete:
						lastContentIdx !== -1 &&
						firstCompleteIdx !== -1 &&
						lastContentIdx < firstCompleteIdx,
				};
			},
			{ timeout: 30_000 },
		)
		.toEqual({
			contentLoadedCount: expectedContentLoadedCount,
			sectionLoadingCompleteCount: 1,
			contentLoadedBeforeSectionComplete: true,
		});
}

test.describe("section player PIE-512 cross-section event delivery", () => {
	test("delivers replayed content-loaded and section-loading-complete on A -> B -> A traversal", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 320, height: 900 });

		// Section A: passage + 1 item. Drive item lifecycle to completion,
		// then subscribe — replay must surface a content-loaded for each
		// loaded renderable (passage + item = 2) + 1
		// section-loading-complete, in registration order, every
		// content-loaded before the section-loading-complete.
		await page.goto(SECTION_A_PATH, { waitUntil: "networkidle" });
		await openEventPanel(page);
		await driveControllerLoadFor(page, SECTION_A_ID);
		await ensureSubscriptionsForSection(page, SECTION_A_ID);
		await expectSectionEvents(page, SECTION_A_ID, 2);

		// Cohort flip A -> B. Section B has 3 items, no passage. Same
		// drive-then-subscribe timing: replay must surface 3
		// content-loaded + 1 section-loading-complete, in registration
		// order, all before the section-loading-complete. Pre-fix this
		// branch delivered 0 content-loaded events to the late subscriber.
		await page.goto(SECTION_B_PATH, { waitUntil: "networkidle" });
		await openEventPanel(page);
		await driveControllerLoadFor(page, SECTION_B_ID);
		await ensureSubscriptionsForSection(page, SECTION_B_ID);
		await expectSectionEvents(page, SECTION_B_ID, 3);

		// Cohort flip B -> A — second visit to A's shape with a fresh
		// controller. Same drive-then-subscribe timing as the prior
		// cohorts.
		await page.goto(SECTION_A_PATH, { waitUntil: "networkidle" });
		await openEventPanel(page);
		await driveControllerLoadFor(page, SECTION_A_ID);
		await ensureSubscriptionsForSection(page, SECTION_A_ID);
		await expectSectionEvents(page, SECTION_A_ID, 2);
	});
});
