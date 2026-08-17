import { expect, test } from "@playwright/test";

/**
 * Timed media, end to end.
 *
 * The unit suites cover the cue reduction, the session slice and the controller
 * wiring in isolation. What only a browser can show is the round trip: a real
 * `<video>` is adapted into the Media Time Source port by the stimulus card, the
 * clock drives cue state through the controller, and the republished composition
 * changes which cards are on screen.
 *
 * That round trip has the same non-obvious failure mode formative delivery had,
 * and it bit during implementation: a cue firing changes neither the renderables
 * nor the item sessions, so the toolkit's composition revision key had to learn
 * about cue state or the emit is coalesced away — the controller then holds correct
 * cue state that no card ever sees. It bit a second way too, which is why the
 * `pie-media-time-source` case below matters: a diagnostic handler that threw
 * inside the engine's controller subscription aborted the listener before the
 * republish, silently stopping every controller event in the section.
 */
const DEMO_PATH = "/timed-media?mode=candidate&layout=splitpane";

type CardState = { id: string; hidden: boolean; gate: string | null };

async function cards(page: import("@playwright/test").Page): Promise<CardState[]> {
	return page.evaluate(() =>
		[...document.querySelectorAll("pie-section-player-item-card")].map((card) => {
			const inner = card.querySelector("[data-section-item-card]");
			return {
				id: inner?.getAttribute("data-canonical-item-id") ?? "",
				hidden: card.hasAttribute("hidden"),
				gate: inner?.getAttribute("data-pie-timed-media-gate") ?? null,
			};
		}),
	);
}

function statusRegion(page: import("@playwright/test").Page) {
	return page.locator("[data-pie-timed-media-status]").first();
}

function video(page: import("@playwright/test").Page) {
	return page.locator("video").first();
}

/**
 * Start playback muted.
 *
 * Chrome blocks unmuted programmatic play without a gesture, and the demo's
 * stimulus is deliberately not authored `muted` — a lecture stimulus should not
 * be. Muting here is a test concern, exactly as the signing spec does it.
 */
async function play(page: import("@playwright/test").Page): Promise<void> {
	await page.waitForFunction(
		() => (document.querySelector("video")?.readyState ?? 0) >= 2,
		null,
		{ timeout: 30_000 },
	);
	await page.evaluate(() => {
		const element = document.querySelector("video") as HTMLVideoElement;
		element.muted = true;
		return element.play();
	});
}

async function waitForTime(
	page: import("@playwright/test").Page,
	seconds: number,
): Promise<void> {
	await page.waitForFunction(
		(target) => (document.querySelector("video")?.currentTime ?? 0) > target,
		seconds,
		{ timeout: 40_000 },
	);
}

async function answerCorrectly(
	page: import("@playwright/test").Page,
	itemId: string,
	label: string,
): Promise<void> {
	// Click the label, not the input: the choice element's radio is visually
	// hidden and React-driven, so `check()` reports no state change. Same reason
	// the formative spec clicks label text.
	const choice = page
		.locator(`[data-section-item-card][data-canonical-item-id="${itemId}"]`)
		.getByText(label, { exact: true })
		.first();
	await expect(choice).toBeVisible({ timeout: 30_000 });
	await choice.click();
	await page
		.locator(
			`[data-section-item-card][data-canonical-item-id="${itemId}"] [data-pie-formative-action]`,
		)
		.first()
		.click();
}

test.describe("timed media", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(DEMO_PATH);
		// The uncued item is delivered normally, which is also the signal that the
		// section mounted and the cards are live.
		await expect(
			page.locator('[data-section-item-card][data-canonical-item-id="tm-q3"]'),
		).toBeVisible({ timeout: 30_000 });
		await expect(video(page)).toBeVisible();
	});

	test("a cue fires at its range and not before", async ({ page }) => {
		// Before playback the cued items are mounted and hidden, and the region says
		// what will reveal them.
		expect(await cards(page)).toEqual([
			{ id: "tm-q1", hidden: true, gate: null },
			{ id: "tm-q2", hidden: true, gate: null },
			{ id: "tm-q3", hidden: false, gate: null },
		]);
		await expect(statusRegion(page)).toHaveText(
			"Questions will appear as the media plays.",
		);

		await play(page);
		// Still hidden a second before the cue at 0:04.
		await waitForTime(page, 2.5);
		expect((await cards(page))[0]).toMatchObject({ id: "tm-q1", hidden: true });

		await waitForTime(page, 5);
		await expect
			.poll(async () => (await cards(page))[0].hidden, { timeout: 10_000 })
			.toBe(false);
		// A reveal cue does not stop playback.
		expect(await video(page).evaluate((el: HTMLVideoElement) => el.paused)).toBe(
			false,
		);
		await expect(statusRegion(page)).toHaveText("Question 1 is now available.");
	});

	test("a gate pauses playback, moves focus, and announces why", async ({
		page,
	}) => {
		await play(page);
		// The gate cue sits at 0:10.
		await expect
			.poll(
				() => video(page).evaluate((el: HTMLVideoElement) => el.paused),
				{ timeout: 40_000 },
			)
			.toBe(true);

		const gated = (await cards(page)).find((card) => card.id === "tm-q2");
		expect(gated).toMatchObject({ hidden: false, gate: "holding" });

		// Announced as text, never colour alone, and stating what to do next.
		await expect(statusRegion(page)).toHaveText(
			"Playback paused. Answer question 2 to continue.",
		);
		await expect(statusRegion(page)).toHaveAttribute("aria-live", "polite");

		// Focus is on the gated card, which is where the learner's next action is.
		const focused = await page.evaluate(() =>
			document.activeElement?.getAttribute("data-canonical-item-id"),
		);
		expect(focused).toBe("tm-q2");
	});

	test("the gate releases on a correct answer and keeps playback in the learner's hands", async ({
		page,
	}) => {
		await play(page);
		await expect
			.poll(
				() => video(page).evaluate((el: HTMLVideoElement) => el.paused),
				{ timeout: 40_000 },
			)
			.toBe(true);

		// Wrong answer: the gate holds.
		await answerCorrectly(page, "tm-q2", "It evaporates a second time");
		await expect(statusRegion(page)).toHaveText(
			"Playback paused. Answer question 2 to continue.",
		);
		expect(
			(await cards(page)).find((card) => card.id === "tm-q2")?.gate,
		).toBe("holding");

		// Retry, then the correct answer releases it.
		await page
			.locator(
				'[data-section-item-card][data-canonical-item-id="tm-q2"] [data-pie-formative-action]',
			)
			.first()
			.click();
		await answerCorrectly(page, "tm-q2", "It condenses and forms clouds");

		await expect(statusRegion(page)).toHaveText(
			"Answer accepted. Continue playing the media.",
			{ timeout: 15_000 },
		);
		expect(
			(await cards(page)).find((card) => card.id === "tm-q2")?.gate,
		).toBeNull();
		// Released, not resumed: starting audio the learner did not ask for would
		// talk over the announcement.
		expect(await video(page).evaluate((el: HTMLVideoElement) => el.paused)).toBe(
			true,
		);
	});

	test("a source that cannot pause degrades to advisory rather than pretending to hold", async ({
		page,
	}) => {
		// A host-supplied port, registered through the one seam media reaches the
		// section by — the same event the stimulus card uses for its native adapter.
		// This is the third-party-embed case: it reports time and nothing else.
		await page.evaluate(() => {
			const card = document.querySelector("pie-section-player-passage-card");
			let currentTime = 0;
			const listeners = new Set<(n: unknown) => void>();
			(window as unknown as { __advance: (s: number) => void }).__advance = (
				seconds: number,
			) => {
				currentTime = seconds;
				for (const listener of listeners) listener({ type: "time", currentTime });
			};
			card?.dispatchEvent(
				new CustomEvent("pie-media-time-source", {
					bubbles: true,
					composed: true,
					detail: {
						renderableId: "passage-water-cycle-video",
						action: "attach",
						source: {
							get currentTime() {
								return currentTime;
							},
							duration: 20,
							paused: false,
							seekable: null,
							capabilities: { canPause: false, canRestrictSeeking: false },
							play() {},
							pause() {
								(window as unknown as { __paused: boolean }).__paused = true;
							},
							seekTo() {
								(window as unknown as { __sought: boolean }).__sought = true;
							},
							subscribe(listener: (n: unknown) => void) {
								listeners.add(listener);
								return () => listeners.delete(listener);
							},
						},
					},
				}),
			);
		});

		await page.evaluate(() =>
			(window as unknown as { __advance: (s: number) => void }).__advance(11),
		);

		// Cues still fire and state is still recorded.
		await expect
			.poll(
				async () => (await cards(page)).find((card) => card.id === "tm-q2")?.hidden,
				{ timeout: 10_000 },
			)
			.toBe(false);
		// The gate is reported as advisory, and the wording asks rather than claims
		// playback stopped — a lock that does not lock must not read as one that does.
		await expect(statusRegion(page)).toHaveText(
			"Answer question 2 before continuing with the media.",
		);
		expect(
			(await cards(page)).find((card) => card.id === "tm-q2")?.gate,
		).toBe("holding");
		// And nothing was pretended: the port was never asked to pause or seek.
		expect(
			await page.evaluate(
				() => (window as unknown as { __paused?: boolean }).__paused ?? false,
			),
		).toBe(false);

		// Read the projection the layouts are actually given — the one on the
		// republished composition model — rather than calling the controller. That is
		// the surface a host consumes, and it is the one the degradation has to reach.
		const projection = await page.evaluate(() => {
			const pane = document.querySelector(
				"pie-section-player-items-pane",
			) as unknown as {
				compositionModel?: {
					timedMedia?: {
						enforcement?: { pause?: string };
						degradations?: Array<{ policy?: string }>;
						mediaAttached?: boolean;
					} | null;
				};
			};
			return pane?.compositionModel?.timedMedia ?? null;
		});
		expect(projection?.enforcement?.pause).toBe("advisory");
		expect(projection?.degradations?.[0]?.policy).toBe("pause-on-required-cue");

		// And the host's port keeps the section: the stimulus card re-runs its own
		// discovery on every re-render, so a native adapter reclaiming the port would
		// silently restore `enforced` and the gate would look like it holds again.
		const handleEnforcement = await page.evaluate(async () => {
			const host = document.querySelector(
				"pie-section-player-splitpane",
			) as unknown as {
				waitForSectionController: (
					timeoutMs?: number,
				) => Promise<{
					getTimedMediaProjection?: () => { enforcement?: { pause?: string } } | null;
				} | null>;
			};
			const controller = await host.waitForSectionController(3000);
			return controller?.getTimedMediaProjection?.()?.enforcement?.pause ?? null;
		});
		expect(handleEnforcement).toBe("advisory");
	});
});
