import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Read-aloud, highlighting and the annotation toolbar over content an element
 * renders into an open shadow root.
 *
 * The unit tests cover the flat-tree walk, the per-tree ranges and the language
 * climb over happy-dom. A browser settles what happy-dom cannot: that the
 * assembled read reaches shadow content in rendering order, that a highlight
 * range inside a shadow root is painted from a stylesheet adopted there, that a
 * real selection inside a shadow root reaches the toolbar, and that the content
 * language reaches the utterance.
 */

const DEMO_PATH = "/shadow-reading?mode=candidate&layout=splitpane";

const READING_ITEM = "shadow-reading-content";
const LANGUAGE_ITEM = "shadow-reading-language";
const MATH_ITEM = "shadow-reading-math";

type SpokenUtterance = { text: string; lang: string };
type HighlightRecord = { inShadowRoot: boolean; text: string };

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

/** Records every range added to a CSS custom highlight, and the tree it lies in. */
async function recordHighlights(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const records: Array<{ inShadowRoot: boolean; text: string }> = [];
		(window as unknown as { __pieHighlights: typeof records }).__pieHighlights =
			records;
		if (typeof Highlight === "undefined") return;
		const realAdd = Highlight.prototype.add;
		Highlight.prototype.add = function patchedAdd(
			this: Highlight,
			range: AbstractRange,
		) {
			records.push({
				inShadowRoot: range.startContainer.getRootNode() instanceof ShadowRoot,
				text: range instanceof Range ? range.toString() : "",
			});
			return realAdd.call(this, range);
		};
	});
}

const spoken = (page: Page) =>
	page.evaluate(
		() =>
			(window as unknown as { __pieSpoken?: SpokenUtterance[] }).__pieSpoken ||
			[],
	);

const spokenText = async (page: Page) =>
	(await spoken(page)).map((utterance) => utterance.text).join(" | ");

const highlights = (page: Page) =>
	page.evaluate(
		() =>
			(window as unknown as { __pieHighlights?: HighlightRecord[] })
				.__pieHighlights || [],
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

function itemCard(page: Page, itemId: string): Locator {
	return page
		.locator("pie-section-player-item-card")
		.filter({ has: page.locator(`[data-canonical-item-id="${itemId}"]`) });
}

function strip(page: Page): Locator {
	return page.locator("pie-tool-annotation-toolbar [role='toolbar']");
}

async function gotoDemo(page: Page): Promise<void> {
	await recordSpeech(page);
	await recordHighlights(page);
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await page.waitForSelector("pie-section-player-splitpane", {
		state: "attached",
	});
	// Playwright's text locators pierce open shadow roots.
	await expect(page.getByText("Words inside a shadow root.")).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByText("El agua hierve")).toBeVisible();
	await forceBrowserTtsRuntime(page);
}

async function readAloud(page: Page, itemId: string): Promise<void> {
	const button = itemCard(page, itemId)
		.getByRole("button", { name: "Play reading" })
		.first();
	await expect(button).toBeVisible({ timeout: 15_000 });
	await button.click();
}

/** Selects characters `start` to `end` of the first text node of the paragraph holding `text`. */
async function selectText(
	page: Page,
	text: string,
	start: number,
	end: number,
): Promise<string> {
	await page
		.getByText(text)
		.first()
		.evaluate(
			(element, [from, to]) => {
				const node = Array.from(element.childNodes).find(
					(child) => child.nodeType === Node.TEXT_NODE,
				);
				if (!node) throw new Error("No text node to select.");
				const selection = window.getSelection();
				if (!selection) throw new Error("Selection API unavailable.");
				selection.removeAllRanges();
				selection.setBaseAndExtent(node, from, node, to);
			},
			[start, end] as const,
		);
	return page.evaluate(() => window.getSelection()?.toString() ?? "");
}

test.describe("read-aloud over open shadow roots", () => {
	test("reads shadow content in rendering order, the catalog alternate included", async ({
		page,
	}) => {
		await gotoDemo(page);
		await readAloud(page, READING_ITEM);

		await expect
			.poll(() => spokenText(page), {
				message: "expected the light text after the shadow host to be read",
				timeout: 20_000,
			})
			.toContain("Light text after the shadow host");

		const read = await spokenText(page);
		const order = [
			"Light text before the shadow host",
			"Words inside a shadow root",
			"the catalog alternate",
			// An item with a docked span is composed from its text and its cards, so
			// its math is read as text; item 3 covers generated math speech.
			"x + 1",
			"Slotted light words",
			"Light text after the shadow host",
		].map((phrase) => ({ phrase, at: read.indexOf(phrase) }));
		for (const { phrase, at } of order) {
			expect(at, `expected "${phrase}" in: ${read}`).toBeGreaterThanOrEqual(0);
		}
		expect(order.map(({ at }) => at)).toEqual(
			[...order.map(({ at }) => at)].sort((a, b) => a - b),
		);
		// The docked span's catalog card replaces its text.
		expect(read).not.toContain("carries a catalog");
	});

	test("highlights shadow text from a stylesheet adopted into its shadow root", async ({
		page,
	}) => {
		await gotoDemo(page);
		await readAloud(page, READING_ITEM);

		await expect
			.poll(
				async () =>
					(await highlights(page)).some(
						(record) =>
							record.inShadowRoot &&
							record.text.includes("Words inside a shadow root"),
					),
				{
					message: "expected a highlight range inside the shadow root",
					timeout: 20_000,
				},
			)
			.toBe(true);

		const adopted = await itemCard(page, READING_ITEM)
			.locator("[data-demo-shadow-reading]")
			.evaluate((host) =>
				Array.from(host.shadowRoot?.adoptedStyleSheets ?? []).some((sheet) =>
					Array.from(sheet.cssRules).some((rule) =>
						rule.cssText.includes("::highlight(tts-sentence)"),
					),
				),
			);
		expect(adopted).toBe(true);
	});

	test("speaks native MathML in a shadow root", async ({ page }) => {
		await gotoDemo(page);
		await readAloud(page, MATH_ITEM);

		// The math is its own utterance, spoken after the text before it, once its
		// speech is generated.
		await expect
			.poll(() => spokenText(page), {
				message: "expected the shadow root's math to be spoken",
				timeout: 20_000,
			})
			.toContain("y minus 2");
		const read = await spokenText(page);
		expect(read.indexOf("y minus 2")).toBeGreaterThan(
			read.indexOf("The total is"),
		);
		expect(read).not.toContain("y - 2");
	});

	test("picks the catalog card in the language the shadow host's lang names", async ({
		page,
	}) => {
		await gotoDemo(page);
		await readAloud(page, LANGUAGE_ITEM);

		await expect
			.poll(() => spokenText(page), {
				message: "expected the es-MX catalog card to be read",
				timeout: 20_000,
			})
			.toContain("la alternativa en español");
		expect(await spokenText(page)).not.toContain("the English alternate");
	});
});

test.describe("annotation toolbar over open shadow roots", () => {
	test("opens for a selection inside a shadow root in the content region", async ({
		page,
	}) => {
		await gotoDemo(page);
		const selected = await selectText(
			page,
			"Words inside a shadow root.",
			0,
			12,
		);

		expect(selected).toBe("Words inside");
		await expect(strip(page)).toBeVisible();
	});

	test("stays closed for a selection in the card header", async ({ page }) => {
		await gotoDemo(page);
		await selectText(page, "Words inside a shadow root.", 0, 12);
		await expect(strip(page)).toBeVisible();

		const header = itemCard(page, READING_ITEM).locator(
			"[data-region='header'] :is(h1, h2, h3, h4, h5, h6)",
		);
		await header.evaluate((element) => {
			const node = element.firstChild;
			if (!node) throw new Error("Header has no text.");
			const selection = window.getSelection();
			selection?.removeAllRanges();
			selection?.setBaseAndExtent(
				node,
				0,
				node,
				Math.min(4, node.textContent?.length ?? 0),
			);
		});
		expect(
			await page.evaluate(() => window.getSelection()?.toString() ?? ""),
		).not.toBe("");
		await expect(strip(page)).toBeHidden();
	});

	test("reads a shadow selection aloud in the language its host's lang names", async ({
		page,
	}) => {
		await gotoDemo(page);
		await selectText(page, "El agua hierve", 0, 14);
		await expect(strip(page)).toBeVisible();

		await strip(page)
			.getByRole("button", { name: "Read selected text aloud" })
			.click();

		await expect
			.poll(
				async () =>
					(await spoken(page)).find((utterance) =>
						utterance.text.includes("El agua hierve"),
					)?.lang ?? null,
				{
					message: "expected the selection to be spoken as es-MX",
					timeout: 20_000,
				},
			)
			.toBe("es-MX");
	});
});
