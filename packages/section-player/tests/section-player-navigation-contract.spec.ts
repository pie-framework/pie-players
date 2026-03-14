import { expect, test } from "@playwright/test";

const SPLIT_DEMO = "/tts-ssml?mode=candidate&layout=splitpane";
const VERTICAL_DEMO = "/tts-ssml?mode=candidate&layout=vertical";

async function validateNavigationContract(args: {
	page: import("@playwright/test").Page;
	selector: "pie-section-player-splitpane" | "pie-section-player-vertical";
	path: string;
}) {
	const { page, selector, path } = args;
	await page.goto(path, { waitUntil: "networkidle" });
	await expect(page.locator(selector)).toBeVisible();

	const result = await page.evaluate(async (hostSelector) => {
		const host = document.querySelector(hostSelector) as
			| (HTMLElement & {
					navigateNext?: () => boolean;
					navigatePrevious?: () => boolean;
					getSectionController?: () => {
						subscribe?: (
							listener: (event: {
								type?: string;
								itemIndex?: number;
								currentItemId?: string;
								totalItems?: number;
								itemLabel?: string;
							}) => void,
						) => () => void;
					} | null;
					waitForSectionController?: (
						timeoutMs?: number,
					) => Promise<{
						subscribe?: (
							listener: (event: {
								type?: string;
								itemIndex?: number;
								currentItemId?: string;
								totalItems?: number;
								itemLabel?: string;
							}) => void,
						) => () => void;
					} | null>;
					selectNavigation?: () => {
						currentIndex: number;
						totalItems: number;
						canNext: boolean;
						canPrevious: boolean;
						currentItemId?: string;
					};
			  })
			| null;
		if (!host) {
			return { ok: false, reason: "missing-host" };
		}

		const itemSelectedEvents: Array<{
			currentItemId?: string;
			itemIndex?: number;
			totalItems?: number;
			itemLabel?: string;
		}> = [];
		const controller =
			host.getSectionController?.() ||
			(await host.waitForSectionController?.(5000)) ||
			null;
		const unsubscribe = controller?.subscribe?.((event) => {
			if (event?.type !== "item-selected") return;
			itemSelectedEvents.push({
				currentItemId: event.currentItemId,
				itemIndex: event.itemIndex,
				totalItems: event.totalItems,
				itemLabel: event.itemLabel,
			});
		});

		const before = host.selectNavigation?.();
		const nextResult = host.navigateNext?.() === true;
		const afterNext = host.selectNavigation?.();
		const prevResult = host.navigatePrevious?.() === true;
		const afterPrev = host.selectNavigation?.();
		await new Promise<void>((resolve) => setTimeout(resolve, 50));
		unsubscribe?.();

		// Capture the aria-live status region text after navigation.
		// The region is rendered inside the layout scaffold's light DOM or closest ancestor.
		const statusEl = document.querySelector(".pie-section-player-nav-status");
		const navStatusText = statusEl ? statusEl.textContent?.trim() ?? "" : null;

		return {
			ok: true,
			before,
			nextResult,
			afterNext,
			prevResult,
			afterPrev,
			itemSelectedEvents,
			navStatusText,
		};
	}, selector);

	expect(result.ok).toBe(true);
	if (!result.ok) return;
	expect(result.before).toBeTruthy();
	expect(result.afterNext).toBeTruthy();
	expect(result.afterPrev).toBeTruthy();

	// aria-live region must be present in the DOM (WCAG 4.1.3).
	expect(result.navStatusText).not.toBeNull();

	const canNext = result.before?.canNext === true;
	if (canNext) {
		expect(result.nextResult).toBe(true);
		expect(result.afterNext?.currentIndex).toBeGreaterThan(
			result.before?.currentIndex ?? 0,
		);
		expect(result.itemSelectedEvents.length).toBeGreaterThanOrEqual(1);
		expect(result.itemSelectedEvents[0]?.itemIndex).toBe(
			result.afterNext?.currentIndex,
		);

		// itemLabel is optional (items without titles omit it) but must be a string when present.
		const firstLabel = result.itemSelectedEvents[0]?.itemLabel;
		if (firstLabel !== undefined) {
			expect(typeof firstLabel).toBe("string");
		}

		// aria-live region must contain a non-empty navigation announcement after navigation.
		expect(result.navStatusText).toBeTruthy();
		expect(result.navStatusText).toMatch(/question\s+\d+\s+of\s+\d+/i);
	} else {
		expect(result.nextResult).toBe(false);
		expect(result.afterNext?.currentIndex).toBe(result.before?.currentIndex);
	}

	const canPreviousAfterNext = result.afterNext?.canPrevious === true;
	if (canPreviousAfterNext) {
		expect(result.prevResult).toBe(true);
		expect(result.afterPrev?.currentIndex).toBe(result.before?.currentIndex);
	} else {
		expect(result.prevResult).toBe(false);
	}
}

test.describe("section player navigation contract", () => {
	test("splitpane exposes working navigation commands and emits controller item-selected", async ({
		page,
	}) => {
		await validateNavigationContract({
			page,
			selector: "pie-section-player-splitpane",
			path: SPLIT_DEMO,
		});
	});

	test("vertical exposes working navigation commands and emits controller item-selected", async ({
		page,
	}) => {
		await validateNavigationContract({
			page,
			selector: "pie-section-player-vertical",
			path: VERTICAL_DEMO,
		});
	});
});
