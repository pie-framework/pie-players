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
		const currentCards = Array.from(
			document.querySelectorAll(".pie-section-player-content-card[data-section-item-card]"),
		);
		const ariaCurrentCount = currentCards.filter(
			(card) => (card as HTMLElement).getAttribute("aria-current") === "true",
		).length;

		return {
			ok: true,
			before,
			nextResult,
			afterNext,
			prevResult,
			afterPrev,
			itemSelectedEvents,
			navStatusText,
			ariaCurrentCount,
		};
	}, selector);

	expect(result.ok).toBe(true);
	if (!result.ok) return;
	expect(result.before).toBeTruthy();
	expect(result.afterNext).toBeTruthy();
	expect(result.afterPrev).toBeTruthy();

	// aria-live region must be present in the DOM (WCAG 4.1.3).
	expect(result.navStatusText).not.toBeNull();
	// Exactly one rendered item card should expose aria-current semantics.
	expect(result.ariaCurrentCount).toBe(1);

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

	test("default autoFocus policy moves focus to passage card after navigation", async ({
		page,
	}) => {
		await page.goto(SPLIT_DEMO, { waitUntil: "networkidle" });
		await expect(page.locator("pie-section-player-splitpane").first()).toBeVisible();

		// Wait for cards to mount and receive their public focus attributes.
		await expect(
			page.locator("pie-section-player-passage-card").first(),
		).toHaveAttribute("tabindex", "-1");
		await expect(
			page.locator("pie-section-player-item-card").first(),
		).toHaveAttribute("tabindex", "-1");

		const activeTag = await page.evaluate(async () => {
			const host = document.querySelector("pie-section-player-splitpane") as
				| (HTMLElement & { navigateNext?: () => boolean })
				| null;
			if (!host?.navigateNext) return null;
			if (!host.navigateNext()) return null;
			await new Promise((resolve) => setTimeout(resolve, 50));
			return (document.activeElement?.tagName || "").toLowerCase();
		});

		// tts-ssml demo has a passage, so start-of-content lands on the passage card.
		expect(activeTag).toBe("pie-section-player-passage-card");
	});

	test("autoFocus='current-item' focuses the active item surface (card or first control)", async ({
		page,
	}) => {
		await page.goto(SPLIT_DEMO, { waitUntil: "networkidle" });
		await expect(page.locator("pie-section-player-splitpane").first()).toBeVisible();

		const result = await page.evaluate(async () => {
			const host = document.querySelector("pie-section-player-splitpane") as
				| (HTMLElement & {
						policies?: Record<string, unknown>;
						navigateNext?: () => boolean;
				  })
				| null;
			if (!host) return { active: null, insideCurrentItem: false };
			host.policies = {
				readiness: { mode: "progressive" },
				preload: { enabled: true },
				focus: { autoFocus: "current-item" },
				telemetry: { enabled: true },
			};
			await new Promise((resolve) => setTimeout(resolve, 20));
			if (!host.navigateNext?.()) return { active: null, insideCurrentItem: false };
			await new Promise((resolve) => setTimeout(resolve, 120));
			const active = document.activeElement as HTMLElement | null;
			const card = document.querySelector("pie-section-player-item-card[is-current]");
			const insideCurrentItem =
				Boolean(card && active && (card === active || card.contains(active)));
			return {
				active: (active?.tagName || "").toLowerCase(),
				insideCurrentItem,
			};
		});

		expect(result.insideCurrentItem).toBe(true);
	});

	test("autoFocus='none' leaves focus unchanged after navigation", async ({
		page,
	}) => {
		await page.goto(SPLIT_DEMO, { waitUntil: "networkidle" });
		await expect(page.locator("pie-section-player-splitpane").first()).toBeVisible();

		const sameBody = await page.evaluate(async () => {
			const host = document.querySelector("pie-section-player-splitpane") as
				| (HTMLElement & {
						policies?: Record<string, unknown>;
						navigateNext?: () => boolean;
				  })
				| null;
			if (!host) return false;
			host.policies = {
				readiness: { mode: "progressive" },
				preload: { enabled: true },
				focus: { autoFocus: "none" },
				telemetry: { enabled: true },
			};
			await new Promise((resolve) => setTimeout(resolve, 20));
			document.body.focus();
			if (!host.navigateNext?.()) return false;
			await new Promise((resolve) => setTimeout(resolve, 50));
			return (
				document.activeElement === document.body ||
				document.activeElement === document.documentElement
			);
		});

		expect(sameBody).toBe(true);
	});

	test("deprecated autoFocusFirstItem:true still moves focus (start-of-content)", async ({
		page,
	}) => {
		await page.goto(SPLIT_DEMO, { waitUntil: "networkidle" });
		await expect(page.locator("pie-section-player-splitpane").first()).toBeVisible();

		const activeTag = await page.evaluate(async () => {
			const host = document.querySelector("pie-section-player-splitpane") as
				| (HTMLElement & {
						policies?: Record<string, unknown>;
						navigateNext?: () => boolean;
				  })
				| null;
			if (!host) return null;
			host.policies = {
				readiness: { mode: "progressive" },
				preload: { enabled: true },
				focus: { autoFocusFirstItem: true },
				telemetry: { enabled: true },
			};
			await new Promise((resolve) => setTimeout(resolve, 20));
			if (!host.navigateNext?.()) return null;
			await new Promise((resolve) => setTimeout(resolve, 50));
			return (document.activeElement?.tagName || "").toLowerCase();
		});

		expect(activeTag).toBe("pie-section-player-passage-card");
	});

	test("deprecated autoFocusFirstItem:false disables focus movement", async ({
		page,
	}) => {
		await page.goto(SPLIT_DEMO, { waitUntil: "networkidle" });
		await expect(page.locator("pie-section-player-splitpane").first()).toBeVisible();

		const sameBody = await page.evaluate(async () => {
			const host = document.querySelector("pie-section-player-splitpane") as
				| (HTMLElement & {
						policies?: Record<string, unknown>;
						navigateNext?: () => boolean;
				  })
				| null;
			if (!host) return false;
			host.policies = {
				readiness: { mode: "progressive" },
				preload: { enabled: true },
				focus: { autoFocusFirstItem: false },
				telemetry: { enabled: true },
			};
			await new Promise((resolve) => setTimeout(resolve, 20));
			document.body.focus();
			if (!host.navigateNext?.()) return false;
			await new Promise((resolve) => setTimeout(resolve, 50));
			return (
				document.activeElement === document.body ||
				document.activeElement === document.documentElement
			);
		});

		expect(sameBody).toBe(true);
	});

	test("focusStart() defaults to start-of-content even when autoFocus is 'none'", async ({
		page,
	}) => {
		await page.goto(SPLIT_DEMO, { waitUntil: "networkidle" });
		await expect(page.locator("pie-section-player-splitpane").first()).toBeVisible();

		const activeTag = await page.evaluate(async () => {
			const host = document.querySelector("pie-section-player-splitpane") as
				| (HTMLElement & {
						policies?: Record<string, unknown>;
						focusStart?: () => boolean;
				  })
				| null;
			if (!host?.focusStart) return null;
			// Even with autoFocus:'none', focusStart() must still move focus —
			// hosts only call it when they *want* focus to move.
			host.policies = {
				readiness: { mode: "progressive" },
				preload: { enabled: true },
				focus: { autoFocus: "none" },
				telemetry: { enabled: true },
			};
			await new Promise((resolve) => setTimeout(resolve, 20));
			document.body.focus();
			const moved = host.focusStart();
			await new Promise((resolve) => setTimeout(resolve, 20));
			if (!moved) return null;
			return (document.activeElement?.tagName || "").toLowerCase();
		});

		expect(activeTag).toBe("pie-section-player-passage-card");
	});

	test("focusStart() with autoFocus 'current-item' lands on the current item surface", async ({
		page,
	}) => {
		await page.goto(SPLIT_DEMO, { waitUntil: "networkidle" });
		await expect(page.locator("pie-section-player-splitpane").first()).toBeVisible();

		const result = await page.evaluate(async () => {
			const host = document.querySelector("pie-section-player-splitpane") as
				| (HTMLElement & {
						policies?: Record<string, unknown>;
						focusStart?: () => boolean;
				  })
				| null;
			if (!host?.focusStart) return null;
			host.policies = {
				readiness: { mode: "progressive" },
				preload: { enabled: true },
				focus: { autoFocus: "current-item" },
				telemetry: { enabled: true },
			};
			await new Promise((resolve) => setTimeout(resolve, 20));
			document.body.focus();
			const moved = host.focusStart();
			await new Promise((resolve) => setTimeout(resolve, 120));
			if (!moved) return null;
			const active = document.activeElement as HTMLElement | null;
			const card = document.querySelector("pie-section-player-item-card[is-current]");
			const insideCurrentItem =
				Boolean(card && active && (card === active || card.contains(active)));
			return {
				tag: (active?.tagName || "").toLowerCase(),
				insideCurrentItem,
			};
		});

		expect(result?.insideCurrentItem).toBe(true);
	});

	test("keepTogether:true + autoFocus:'current-item' still fires item-selected and focuses the new current card", async ({
		page,
	}) => {
		// The tts-ssml demo section has keepTogether:true. This asserts that the
		// QTI 3 keep-together pagination hint does NOT disable item-level
		// navigation events or current-item focus movement.
		await page.goto(SPLIT_DEMO, { waitUntil: "networkidle" });
		await expect(page.locator("pie-section-player-splitpane").first()).toBeVisible();

		const result = await page.evaluate(async () => {
			const host = document.querySelector("pie-section-player-splitpane") as
				| (HTMLElement & {
						policies?: Record<string, unknown>;
						navigateNext?: () => boolean;
						getSectionController?: () => {
							subscribe?: (
								listener: (event: {
									type?: string;
									itemIndex?: number;
									currentItemId?: string;
								}) => void,
							) => () => void;
						} | null;
						waitForSectionController?: (timeoutMs?: number) => Promise<{
							subscribe?: (
								listener: (event: {
									type?: string;
									itemIndex?: number;
									currentItemId?: string;
								}) => void,
							) => () => void;
						} | null>;
						selectNavigation?: () => {
							currentIndex: number;
							totalItems: number;
						};
				  })
				| null;
			if (!host) return null;

			host.policies = {
				readiness: { mode: "progressive" },
				preload: { enabled: true },
				focus: { autoFocus: "current-item" },
				telemetry: { enabled: true },
			};
			await new Promise((resolve) => setTimeout(resolve, 20));

			const controller =
				host.getSectionController?.() ||
				(await host.waitForSectionController?.(5000)) ||
				null;
			const events: Array<{ itemIndex?: number; currentItemId?: string }> = [];
			const unsubscribe = controller?.subscribe?.((event) => {
				if (event?.type !== "item-selected") return;
				events.push({
					itemIndex: event.itemIndex,
					currentItemId: event.currentItemId,
				});
			});

			const before = host.selectNavigation?.();
			const moved = host.navigateNext?.() === true;
			await new Promise((resolve) => setTimeout(resolve, 120));
			const after = host.selectNavigation?.();
			unsubscribe?.();
			const active = document.activeElement as HTMLElement | null;
			const currentCard = document.querySelector("pie-section-player-item-card[is-current]");
			const insideCurrentItem =
				Boolean(
					currentCard && active && (currentCard === active || currentCard.contains(active)),
				);

			return {
				moved,
				before,
				after,
				events,
				activeTag: (active?.tagName || "").toLowerCase(),
				insideCurrentItem,
			};
		});

		expect(result).not.toBeNull();
		if (!result) return;
		expect(result.moved).toBe(true);
		expect(result.before?.totalItems ?? 0).toBeGreaterThan(1);
		expect(result.after?.currentIndex).toBe((result.before?.currentIndex ?? 0) + 1);
		expect(result.events.length).toBeGreaterThanOrEqual(1);
		expect(result.events[0]?.itemIndex).toBe(result.after?.currentIndex);
		expect(result.insideCurrentItem).toBe(true);
	});

	test("passage and item cards expose public focus attributes", async ({ page }) => {
		await page.goto(SPLIT_DEMO, { waitUntil: "networkidle" });
		const passage = page.locator("pie-section-player-passage-card").first();
		const item = page.locator("pie-section-player-item-card").first();
		await expect(passage).toHaveAttribute("tabindex", "-1");
		await expect(passage).toHaveAttribute("role", "region");
		await expect(passage).toHaveAttribute("aria-labelledby", /.+/);
		await expect(item).toHaveAttribute("tabindex", "-1");
		await expect(item).toHaveAttribute("role", "region");
		await expect(item).toHaveAttribute("aria-labelledby", /.+/);
	});
});
