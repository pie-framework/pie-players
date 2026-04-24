import { expect, test } from "@playwright/test";

/**
 * Regression for the "Preloaded strategy requires pre-registered elements;
 * missing tags: pie-passage--version-3-2-4" bug reported by Renaissance
 * (Darin's host) when the host swaps from one section to another whose
 * element set includes a new package.
 *
 * Root cause — the section-player today:
 *   1. Substitutes `strategy="iife"` -> `strategy="preloaded"` for embedded
 *      item-players (`resolveEmbeddedItemStrategy` in
 *      `section-player-view-state.ts`).
 *   2. Caches readiness in `SectionItemsPane.svelte` via three `$state`
 *      fields (`elementsLoaded`, `lastPreloadSignature`, `preloadRunToken`).
 *   3. When `section` swaps under a live host, the template re-renders with
 *      the new items while the cached readiness signal can still be stale.
 *      Items mount with a false "preloaded" claim and throw the misleading
 *      missing-tags error.
 *
 * This spec asserts both halves of the fix:
 *
 *   - Observable: a live section swap to a section with a genuinely new
 *     element package never surfaces a missing-tags error on the page.
 *   - Architectural invariant: with the section-player strategy set to
 *     `iife`, its embedded item-players also report `strategy="iife"`.
 *     No parent-to-child strategy substitution. This invariant is the
 *     structural reason the swap is safe; it currently fails on main
 *     (strategies are forced to "preloaded") and passes after Phase B.
 *
 * Must fail on main. Passes after Phase B (delete `resolveEmbeddedItemStrategy`
 * + rewrite SectionItemsPane to a functional view over ElementLoader).
 */

type CapturedEvent = {
	type: "element-preload-error" | "player-error";
	detail: Record<string, unknown>;
	at: number;
};

declare global {
	interface Window {
		__pieSwapCapture?: {
			start: number;
			events: CapturedEvent[];
		};
	}
}

const ROUTE = "/single-question?mode=candidate&layout=splitpane&player=iife";

const MULTIPLE_CHOICE_PACKAGE = "@pie-element/multiple-choice@latest";
const PASSAGE_PACKAGE = "@pie-element/passage@latest";

const MISSING_TAGS_PATTERN =
	/missing tags|preloaded strategy requires pre-registered/i;

test.describe("section swap across changed element set", () => {
	test("does not surface missing-tags when swapping to a section with new elements", async ({
		page,
	}) => {
		const pageErrors: string[] = [];
		page.on("pageerror", (error) => {
			pageErrors.push(error.message);
		});
		const consoleErrors: string[] = [];
		page.on("console", (message) => {
			if (message.type() === "error") consoleErrors.push(message.text());
		});

		await page.goto(ROUTE, { waitUntil: "networkidle" });

		const host = page.locator("pie-section-player-splitpane");
		await expect(host).toBeVisible();
		await expect(page.locator("pie-item-player").first()).toBeVisible({
			timeout: 30_000,
		});

		// Document-level capture for element-preload-error (forwarded up the
		// composition and re-emitted from the splitpane host) and player-error
		// (dispatched from each pie-item-player on load failure).
		await page.evaluate(() => {
			const capture = {
				start: performance.now(),
				events: [] as CapturedEvent[],
			};
			window.__pieSwapCapture = capture;
			const record = (type: CapturedEvent["type"]) => (event: Event) => {
				const detail = (event as CustomEvent<Record<string, unknown>>).detail;
				capture.events.push({
					type,
					detail: detail ?? {},
					at: performance.now() - capture.start,
				});
			};
			document.addEventListener(
				"element-preload-error",
				record("element-preload-error"),
				true,
			);
			document.addEventListener("player-error", record("player-error"), true);
		});

		const sectionA = {
			identifier: "swap-section-a",
			title: "Section A (multiple-choice only)",
			keepTogether: true,
			rubricBlocks: [],
			assessmentItemRefs: [
				{
					identifier: "a-q1",
					required: true,
					item: {
						id: "a-q1",
						baseId: "a-q1",
						version: { major: 1, minor: 0, patch: 0 },
						name: "A Question 1",
						config: {
							markup:
								'<multiple-choice id="aq1" data-swap-section="a"></multiple-choice>',
							elements: { "multiple-choice": MULTIPLE_CHOICE_PACKAGE },
							models: [
								{
									id: "aq1",
									element: "multiple-choice",
									prompt: "Section A prompt",
									choiceMode: "radio",
									choices: [
										{ value: "a", label: "A", correct: true },
										{ value: "b", label: "B", correct: false },
									],
								},
							],
						},
					},
				},
			],
		};

		const sectionB = {
			identifier: "swap-section-b",
			title: "Section B (multiple-choice + passage)",
			keepTogether: true,
			rubricBlocks: [],
			assessmentItemRefs: [
				{
					identifier: "b-q1",
					required: true,
					item: {
						id: "b-q1",
						baseId: "b-q1",
						version: { major: 1, minor: 0, patch: 0 },
						name: "B Question 1",
						config: {
							markup:
								'<passage-element id="bp1" data-swap-section="b"></passage-element><multiple-choice id="bq1" data-swap-section="b"></multiple-choice>',
							elements: {
								"multiple-choice": MULTIPLE_CHOICE_PACKAGE,
								"passage-element": PASSAGE_PACKAGE,
							},
							models: [
								{
									id: "bp1",
									element: "passage-element",
									passages: [
										{
											title: "Section B Passage",
											text: "<p>Swap test stimulus.</p>",
										},
									],
								},
								{
									id: "bq1",
									element: "multiple-choice",
									prompt: "Section B prompt",
									choiceMode: "radio",
									choices: [
										{ value: "a", label: "A", correct: true },
										{ value: "b", label: "B", correct: false },
									],
								},
							],
						},
					},
				},
			],
		};

		// Imperatively drive section A onto the host.
		await page.evaluate((section) => {
			const host = document.querySelector(
				"pie-section-player-splitpane",
			) as HTMLElement & { section?: unknown };
			if (!host) throw new Error("section-player host not found");
			host.section = section;
		}, sectionA);
		await expect(
			page.locator('[data-swap-section="a"]').first(),
		).toBeAttached({ timeout: 30_000 });

		// Swap to section B. This is the exact motion that reproduces Darin's
		// bug in production.
		await page.evaluate((section) => {
			const host = document.querySelector(
				"pie-section-player-splitpane",
			) as HTMLElement & { section?: unknown };
			if (!host) throw new Error("section-player host not found");
			host.section = section;
		}, sectionB);

		// Let the player settle. Either the new section fully renders, or the
		// bug fires.
		await page
			.waitForFunction(
				() => {
					const bAttached = document.querySelector('[data-swap-section="b"]');
					const hadError = Boolean(
						window.__pieSwapCapture?.events.some(
							(event) =>
								event.type === "element-preload-error" ||
								event.type === "player-error",
						),
					);
					return Boolean(bAttached) || hadError;
				},
				null,
				{ timeout: 25_000 },
			)
			.catch(() => {
				// Fall through to assertions for a diagnostic failure message.
			});

		const capture = await page.evaluate(() => window.__pieSwapCapture);

		// Assertion 1: no missing-tags pageerror.
		const missingTagsPageErrors = pageErrors.filter((message) =>
			MISSING_TAGS_PATTERN.test(message),
		);
		expect(
			missingTagsPageErrors,
			`section swap surfaced missing-tags pageerror(s):\n${missingTagsPageErrors.join("\n")}`,
		).toEqual([]);

		// Assertion 2: no missing-tags console error.
		const missingTagsConsoleErrors = consoleErrors.filter((message) =>
			MISSING_TAGS_PATTERN.test(message),
		);
		expect(
			missingTagsConsoleErrors,
			`section swap logged missing-tags console error(s):\n${missingTagsConsoleErrors.join("\n")}`,
		).toEqual([]);

		// Assertion 3: no player-error events with the ITEM_PLAYER_LOAD_ERROR
		// code pointing at missing tags.
		const loadErrors = (capture?.events ?? []).filter(
			(event) =>
				event.type === "player-error" &&
				(event.detail.code === "ITEM_PLAYER_LOAD_ERROR" ||
					MISSING_TAGS_PATTERN.test(String(event.detail.message ?? ""))),
		);
		expect(
			loadErrors,
			`section swap dispatched ITEM_PLAYER_LOAD_ERROR event(s):\n${JSON.stringify(loadErrors, null, 2)}`,
		).toEqual([]);

		// Assertion 4: no section-level element-preload-error events.
		const preloadErrors = (capture?.events ?? []).filter(
			(event) => event.type === "element-preload-error",
		);
		expect(
			preloadErrors,
			`section swap surfaced element-preload-error event(s):\n${JSON.stringify(preloadErrors, null, 2)}`,
		).toEqual([]);

		// Assertion 5: section B is ultimately rendered.
		await expect(
			page.locator('[data-swap-section="b"]').first(),
		).toBeAttached({ timeout: 5_000 });
	});

	test("embedded item-player strategy matches the section-player strategy (no substitution)", async ({
		page,
	}) => {
		// This is the architectural root cause check. When the host sets the
		// section-player strategy to `iife`, every embedded item-player MUST
		// also report `strategy="iife"`. The current implementation forces
		// `preloaded` via `resolveEmbeddedItemStrategy`, which is the
		// mechanical reason the section-swap race produces a misleading
		// "missing tags" error instead of a clean fallback load. Once the
		// substitution is deleted in Phase B, this test passes.
		await page.goto(ROUTE, { waitUntil: "networkidle" });

		const host = page.locator("pie-section-player-splitpane");
		await expect(host).toBeVisible();
		await expect(page.locator("pie-item-player").first()).toBeVisible({
			timeout: 30_000,
		});

		const reportedStrategies = await page
			.locator("pie-item-player")
			.evaluateAll((els) =>
				els.map((el) => el.getAttribute("strategy") ?? ""),
			);

		expect(
			reportedStrategies.length,
			"expected at least one embedded pie-item-player",
		).toBeGreaterThan(0);

		for (const strategy of reportedStrategies) {
			expect(
				strategy,
				`embedded item-player reported strategy="${strategy}" but section-player strategy is "iife" — parent-to-child strategy substitution is the root cause of the missing-tags race`,
			).toBe("iife");
		}
	});
});
