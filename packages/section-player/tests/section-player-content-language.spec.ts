import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Language variants in one section: an English item beside its Spanish variant,
 * which declares `language: "es"` on the entity and no `lang` in its markup.
 *
 * The unit tests cover the env narrowing. A browser settles that the narrowed
 * `env.locale` reaches the item player's content-language stamp and, through
 * it, the voice read-aloud picks.
 */

const DEMO_PATH = "/content-language?mode=candidate&layout=splitpane";

const ENGLISH_ITEM = "content-language-en";
const SPANISH_ITEM = "content-language-es";

type SpokenUtterance = { text: string; lang: string };

/**
 * Silent stand-in for browser speech synthesis that records each utterance's
 * text and language. Duplicated from the other TTS specs, which is this suite's
 * convention: each spec is self-contained.
 */
async function recordSpeech(page: Page): Promise<void> {
	await page.addInitScript(() => {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
		const spoken: Array<{ text: string; lang: string }> = [];
		(window as unknown as { __pieSpoken: typeof spoken }).__pieSpoken = spoken;
		const original = window.speechSynthesis;
		let speaking = false;
		let active: SpeechSynthesisUtterance | null = null;
		const fake: SpeechSynthesis = {
			...original,
			getVoices: () => original.getVoices(),
			speak: (utterance: SpeechSynthesisUtterance) => {
				spoken.push({
					text: String(utterance.text || ""),
					lang: String(utterance.lang || ""),
				});
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

const spoken = (page: Page) =>
	page.evaluate(
		() =>
			(window as unknown as { __pieSpoken?: SpokenUtterance[] }).__pieSpoken ||
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
		await coordinator?.ensureTTSReady?.();
	});
}

function itemCard(page: Page, itemId: string): Locator {
	return page
		.locator("pie-section-player-item-card")
		.filter({ has: page.locator(`[data-canonical-item-id="${itemId}"]`) });
}

/** The content root the item player stamps its content language on. */
function itemContentRoot(page: Page, itemId: string): Locator {
	return itemCard(page, itemId).locator("pie-item-player [lang]").first();
}

async function gotoDemo(page: Page): Promise<void> {
	await recordSpeech(page);
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await page.waitForSelector("pie-section-player-splitpane", {
		state: "attached",
	});
	await expect(page.getByText("El agua hierve")).toBeVisible({
		timeout: 30_000,
	});
	await forceBrowserTtsRuntime(page);
}

test.describe("language variants in one section", () => {
	test("each item's player stamps its own content language", async ({
		page,
	}) => {
		await gotoDemo(page);

		await expect(itemContentRoot(page, SPANISH_ITEM)).toHaveAttribute(
			"lang",
			"es",
		);
		await expect(itemContentRoot(page, ENGLISH_ITEM)).toHaveAttribute(
			"lang",
			"en",
		);
	});

	test("read-aloud speaks the Spanish variant as Spanish", async ({ page }) => {
		await gotoDemo(page);
		const button = itemCard(page, SPANISH_ITEM)
			.getByRole("button", { name: "Play reading" })
			.first();
		await expect(button).toBeVisible({ timeout: 15_000 });
		await button.click();

		await expect
			.poll(
				async () =>
					(await spoken(page)).find((utterance) =>
						utterance.text.includes("El agua hierve"),
					)?.lang ?? null,
				{ message: "expected the Spanish item to be spoken", timeout: 20_000 },
			)
			.toMatch(/^es/i);
	});
});
