import { expect, test } from "@playwright/test";

const SPLIT_DEMO = "/demo/tts-ssml?mode=candidate&layout=splitpane";
const VERTICAL_DEMO = "/demo/tts-ssml?mode=candidate&layout=vertical";

async function validateControllerAccess(args: {
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
					getSectionController?: () => unknown | null;
					waitForSectionController?: (timeoutMs?: number) => Promise<unknown | null>;
					selectNavigation?: () => { canNext?: boolean; canPrevious?: boolean };
					navigateNext?: () => boolean;
					navigatePrevious?: () => boolean;
					canNavigateForward?: () => boolean;
					canNavigateBackward?: () => boolean;
					setNavigationPolicy?: (...args: unknown[]) => unknown;
			  })
			| null;
		if (!host) return { ok: false, reason: "missing-host" };

		let readyEventCount = 0;
		let readyEventControllerSeen = false;
		const onControllerReady = (event: Event) => {
			readyEventCount += 1;
			const detail = (event as CustomEvent).detail as
				| { controller?: unknown }
				| undefined;
			readyEventControllerSeen = Boolean(detail?.controller);
		};
		host.addEventListener("section-controller-ready", onControllerReady);

		const immediate = host.getSectionController?.() || null;
		const awaited = await host.waitForSectionController?.(5000);
		const afterWait = host.getSectionController?.() || null;

		host.removeEventListener("section-controller-ready", onControllerReady);

		const hasRuntimeState =
			typeof (awaited as { getRuntimeState?: unknown } | null)
				?.getRuntimeState === "function";
		const hasSessionState =
			typeof (awaited as { getSessionState?: unknown } | null)
				?.getSessionState === "function";
		const hasSubscribe =
			typeof (awaited as { subscribe?: unknown } | null)?.subscribe ===
			"function";
		let sectionComplete = false;
		const navBefore = host.selectNavigation?.();
		const canAdvanceBefore = Boolean(navBefore?.canNext && sectionComplete);
		sectionComplete = true;
		const navAfter = host.selectNavigation?.();
		const canAdvanceAfter = Boolean(navAfter?.canNext && sectionComplete);

		return {
			ok: true,
			hasImmediate: Boolean(immediate),
			hasAwaited: Boolean(awaited),
			hasAfterWait: Boolean(afterWait),
			hasRuntimeState,
			hasSessionState,
			hasSubscribe,
			canAdvanceBefore,
			canAdvanceAfter,
			hasCanNavigateForwardApi: typeof host.canNavigateForward === "function",
			hasCanNavigateBackwardApi: typeof host.canNavigateBackward === "function",
			hasSetNavigationPolicyApi: typeof host.setNavigationPolicy === "function",
			readyEventCount,
			readyEventControllerSeen,
		};
	}, selector);

	expect(result.ok).toBe(true);
	if (!result.ok) return;
	expect(result.hasAwaited).toBe(true);
	expect(result.hasAfterWait).toBe(true);
	expect(result.hasRuntimeState).toBe(true);
	expect(result.hasSessionState).toBe(true);
	expect(result.hasSubscribe).toBe(true);
	expect(result.canAdvanceBefore).toBe(false);
	expect(typeof result.canAdvanceAfter).toBe("boolean");
	expect(result.hasCanNavigateForwardApi).toBe(false);
	expect(result.hasCanNavigateBackwardApi).toBe(false);
	expect(result.hasSetNavigationPolicyApi).toBe(false);
	if (result.readyEventCount > 0) {
		expect(result.readyEventControllerSeen).toBe(true);
	}
}

test.describe("section player controller access", () => {
	test("splitpane exposes section controller via JS API", async ({ page }) => {
		await validateControllerAccess({
			page,
			selector: "pie-section-player-splitpane",
			path: SPLIT_DEMO,
		});
	});

	test("vertical exposes section controller via JS API", async ({ page }) => {
		await validateControllerAccess({
			page,
			selector: "pie-section-player-vertical",
			path: VERTICAL_DEMO,
		});
	});
});
