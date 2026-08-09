import { expect, test, type Page } from "@playwright/test";

/**
 * E2E tests for read-aloud suppression and recorded audio.
 *
 * The unit tests cover the predicates, the resolver and the playback path in
 * isolation. What only a browser can prove is that the whole read of a real item
 * honours them: that the word the item measures never reaches the speech
 * synthesizer through *any* of the paths that compose an utterance, and that a
 * `spoken` card carrying a file actually plays that file rather than resolving to
 * something a `<audio>` element silently declines.
 *
 * Suppression especially. A unit test asserts that one function withholds one
 * node; only the assembled read shows that no other contributor puts it back.
 */

const DEMO_PATH = "/read-aloud-accommodations?mode=candidate&layout=splitpane";

const SUPPRESSED_WORD = "cake";
const SUPPRESSED_PROMPT = "Which word rhymes with";
const RECORDED_PROMPT =
	"A plant absorbs carbon dioxide and releases oxygen. What is this process called?";
const BOTH_FORMS_PROMPT =
	"Where in a plant cell does photosynthesis mainly happen?";
const FALLBACK_PROMPT = "Which part of a plant takes in water from the soil?";

const PHOTOSYNTHESIS_CLIP = "/demo-assets/read-aloud/photosynthesis-prompt.wav";
const CHLOROPLAST_CLIP = "/demo-assets/read-aloud/chloroplast-prompt.wav";
const MISSING_CLIP = "/demo-assets/read-aloud/missing-on-purpose.wav";

/**
 * Autoplay is normally gated on a user gesture. Read-aloud *is* gesture-initiated
 * so the demo works in a real browser, but relying on sticky activation would
 * make these assertions depend on Chromium's activation heuristics rather than on
 * PIE. With the gate lifted, a clip that does not play failed for a reason worth
 * reporting.
 */
test.use({
	launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
});

/**
 * Silent stand-in for browser speech synthesis that records what was spoken.
 * Duplicated from the TTS specs rather than shared, which is this suite's
 * convention — each spec is self-contained. Utterances end quickly here because
 * every assertion below is about a completed read, not about controls.
 */
async function recordSpeech(page: Page): Promise<void> {
	await page.addInitScript(() => {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
		const spoken: string[] = [];
		(window as unknown as { __pieSpoken: string[] }).__pieSpoken = spoken;
		const original = window.speechSynthesis;
		let speaking = false;
		let active: SpeechSynthesisUtterance | null = null;
		const fake: SpeechSynthesis = {
			...original,
			getVoices: () => original.getVoices(),
			speak: (utterance: SpeechSynthesisUtterance) => {
				spoken.push(String(utterance.text || ""));
				active = utterance;
				speaking = true;
				utterance.onstart?.(new Event("start") as SpeechSynthesisEvent);
				window.setTimeout(() => {
					speaking = false;
					active?.onend?.(new Event("end") as SpeechSynthesisEvent);
					active = null;
				}, 50);
			},
			cancel: () => {
				active?.onend?.(new Event("end") as SpeechSynthesisEvent);
				active = null;
				speaking = false;
			},
			pause: () => {},
			resume: () => {},
			get speaking() {
				return speaking;
			},
			get paused() {
				return false;
			},
			get pending() {
				return false;
			},
		};
		Object.defineProperty(window, "speechSynthesis", {
			configurable: true,
			value: fake,
		});
	});
}

/**
 * Observes media playback without replacing it: the real `play` still runs, so a
 * clip Chromium cannot decode still fails here. A stub that resolved everything
 * would make a broken asset indistinguishable from a working one — the mistake
 * the signing demo's WebM note exists to prevent.
 */
async function recordAudioPlays(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const plays: string[] = [];
		(window as unknown as { __pieAudioPlays: string[] }).__pieAudioPlays =
			plays;
		const realPlay = HTMLMediaElement.prototype.play;
		HTMLMediaElement.prototype.play = function patchedPlay(
			this: HTMLMediaElement,
		) {
			plays.push(String(this.src || this.currentSrc || ""));
			return realPlay.call(this);
		};
	});
}

const spokenText = (page: Page) =>
	page.evaluate(
		() => (window as unknown as { __pieSpoken?: string[] }).__pieSpoken || [],
	);

const audioPlays = (page: Page) =>
	page.evaluate(
		() =>
			(window as unknown as { __pieAudioPlays?: string[] }).__pieAudioPlays ||
			[],
	);

async function forceBrowserTtsRuntime(page: Page): Promise<void> {
	await page.evaluate(async () => {
		const coordinator = (
			window as unknown as { __pieDemoToolkitCoordinator?: any }
		).__pieDemoToolkitCoordinator;
		if (!coordinator?.updateToolConfig) return;
		coordinator.updateToolConfig("textToSpeech", {
			enabled: true,
			backend: "browser",
			transportMode: "pie",
		});
		await coordinator?.ensureTTSReady?.(
			coordinator?.getToolConfig?.("textToSpeech"),
		);
	});
}

// `data-canonical-item-id` sits on nodes *inside* the card, not on the card, and
// the read-aloud control lives in the card header — a different subtree. So the
// card is found by what it contains rather than by descending into it.
function itemCard(page: Page, itemId: string) {
	return page
		.locator("pie-section-player-item-card")
		.filter({ has: page.locator(`[data-canonical-item-id="${itemId}"]`) });
}

async function gotoDemo(page: Page) {
	await recordSpeech(page);
	await recordAudioPlays(page);
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await page.waitForSelector("pie-section-player-splitpane", {
		state: "attached",
	});
	await expect(page.getByText(SUPPRESSED_PROMPT)).toBeVisible({
		timeout: 30_000,
	});
	await forceBrowserTtsRuntime(page);
}

async function readAloud(page: Page, itemId: string) {
	const card = itemCard(page, itemId);
	// The packaged inline TTS tool names its control "Play reading".
	const button = card.getByRole("button", { name: "Play reading" }).first();
	await expect(button).toBeVisible({ timeout: 15_000 });
	await button.click();
}

test.describe("read-aloud suppression", () => {
	test("withholds the word the item measures and speaks the rest", async ({
		page,
	}) => {
		await gotoDemo(page);
		await readAloud(page, "read-aloud-suppressed");

		await expect
			.poll(async () => (await spokenText(page)).join(" | "), {
				message: "expected the prompt around the suppressed word to be spoken",
				timeout: 15_000,
			})
			.toContain(SUPPRESSED_PROMPT);

		// The whole point: reading it aloud would answer the item.
		const spoken = await spokenText(page);
		expect(spoken.join(" | ")).not.toContain(SUPPRESSED_WORD);
		// And the accommodation still did its job for everything else — an
		// item-level read-aloud switch would have taken the directions too.
		expect(spoken.some((text) => text.includes(SUPPRESSED_PROMPT))).toBe(true);
	});

	test("refuses a selection of the suppressed word", async ({ page }) => {
		await gotoDemo(page);
		const word = itemCard(page, "read-aloud-suppressed").locator(
			"[data-tts-suppress]",
		);
		await expect(word).toHaveText(SUPPRESSED_WORD);

		// Select just that word and ask the service to speak the selection — the
		// path that hands `range.toString()` straight to the provider and consults
		// no catalog. Two clicks is all a candidate would need.
		const spokenBefore = (await spokenText(page)).length;
		await word.evaluate((element) => {
			const range = document.createRange();
			range.selectNodeContents(element);
			const selection = window.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(range);
			const coordinator = (
				window as unknown as { __pieDemoToolkitCoordinator?: any }
			).__pieDemoToolkitCoordinator;
			void coordinator?.ttsService?.speakRange?.(range);
		});

		await page.waitForTimeout(1_000);
		const spoken = await spokenText(page);
		expect(spoken.length).toBe(spokenBefore);
		expect(spoken.join(" | ")).not.toContain(SUPPRESSED_WORD);
	});
});

test.describe("recorded audio as a spoken alternate", () => {
	test("plays the recording instead of synthesizing the prompt", async ({
		page,
	}) => {
		await gotoDemo(page);
		await readAloud(page, "read-aloud-recorded");

		await expect
			.poll(async () => (await audioPlays(page)).join(" | "), {
				message: "expected the recorded prompt to be played",
				timeout: 15_000,
			})
			.toContain(PHOTOSYNTHESIS_CLIP);

		expect((await spokenText(page)).join(" | ")).not.toContain(RECORDED_PROMPT);
	});

	test("prefers the recording when the node carries a script as well", async ({
		page,
	}) => {
		await gotoDemo(page);
		await readAloud(page, "read-aloud-recorded-and-script");

		await expect
			.poll(async () => (await audioPlays(page)).join(" | "), {
				message: "expected the recording to win over the script",
				timeout: 15_000,
			})
			.toContain(CHLOROPLAST_CLIP);

		expect((await spokenText(page)).join(" | ")).not.toContain(
			BOTH_FORMS_PROMPT,
		);
	});

	test("falls back to the reading script when the recording will not load", async ({
		page,
	}) => {
		await gotoDemo(page);
		await readAloud(page, "read-aloud-recorded-fallback");

		// Attempted, failed, and degraded — rather than going silent, which is the
		// one outcome a candidate cannot report.
		await expect
			.poll(async () => (await audioPlays(page)).join(" | "), {
				message: "expected the missing clip to be attempted",
				timeout: 15_000,
			})
			.toContain(MISSING_CLIP);

		await expect
			.poll(async () => (await spokenText(page)).join(" | "), {
				message: "expected the reading script to be spoken instead",
				timeout: 15_000,
			})
			.toContain(FALLBACK_PROMPT);
	});
});
