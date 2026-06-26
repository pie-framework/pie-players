import { expect, test, type Page } from "@playwright/test";

/**
 * E2E coverage for the generated-SSML pipeline (PIE-623).
 *
 * The `tts-generated-ssml` demo ships the same visible content as the
 * authored-SSML demo (`tts-ssml`) but with **no** `accessibilityCatalogs`,
 * `<speak>` markup, or `data-catalog-idref` anchors. With nothing authored,
 * the assessment toolkit's generated-speech path takes over: it converts the
 * MathML to spoken text and, for SSML-capable providers, serializes that math
 * speech to SSML on the fly before the provider receives it.
 *
 * These tests assert the two halves of that contract end-to-end:
 *  1. SSML-capable provider (AWS Polly preset) → generated `<speak>` math SSML
 *     reaches the synthesis endpoint.
 *  2. Browser provider (not SSML-capable) → math is voiced as plain spoken
 *     words, never as `<speak>`/`<math>` markup read literally.
 */
const DEMO_PATH = "/tts-generated-ssml?mode=candidate&layout=splitpane";

async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expect(page.getByRole("link", { name: "Student" })).toBeVisible();
}

/**
 * Wait for the demo's page-lifetime ToolkitCoordinator to be exposed on the
 * stable `window.__pieDemoToolkitCoordinator` seam. This survives panel
 * open/close, so tests don't need to open the session panel just to reach the
 * live coordinator.
 */
async function waitForCoordinator(page: Page): Promise<void> {
	await page.waitForFunction(
		() =>
			Boolean(
				(window as unknown as { __pieDemoToolkitCoordinator?: unknown })
					.__pieDemoToolkitCoordinator,
			),
		undefined,
		{ timeout: 15_000 },
	);
}

async function forceBrowserTtsRuntime(page: Page): Promise<void> {
	await waitForCoordinator(page);
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

async function mockPollyVoices(page: Page): Promise<void> {
	await page.route("**/polly/voices**", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				voices: [
					{
						id: "Joanna",
						name: "Joanna",
						languageCode: "en-US",
						gender: "female",
					},
				],
			}),
		});
	});
}

type BrowserSpeechCall =
	| { type: "speak"; text: string; rate: number }
	| { type: "cancel" };

async function installHoldingBrowserSpeech(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const calls: BrowserSpeechCall[] = [];
		const voices = [
			{
				name: "Test Voice",
				lang: "en-US",
				default: true,
				localService: true,
				voiceURI: "test-voice",
			},
		] as SpeechSynthesisVoice[];

		class MockSpeechSynthesisUtterance {
			text: string;
			rate = 1;
			pitch = 1;
			voice: SpeechSynthesisVoice | null = null;
			onstart: ((event: SpeechSynthesisEvent) => void) | null = null;
			onboundary: ((event: SpeechSynthesisEvent) => void) | null = null;
			onend: ((event: SpeechSynthesisEvent) => void) | null = null;
			onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;
			constructor(text = "") {
				this.text = text;
			}
		}

		let activeUtterance: MockSpeechSynthesisUtterance | null = null;
		Object.defineProperty(window, "SpeechSynthesisUtterance", {
			configurable: true,
			value: MockSpeechSynthesisUtterance,
		});
		Object.defineProperty(window, "speechSynthesis", {
			configurable: true,
			value: {
				getVoices: () => voices,
				speak: (utterance: MockSpeechSynthesisUtterance) => {
					activeUtterance = utterance;
					calls.push({
						type: "speak",
						text: utterance.text,
						rate: Number(utterance.rate || 1),
					});
					window.setTimeout(() => {
						utterance.onstart?.({} as SpeechSynthesisEvent);
					}, 0);
				},
				cancel: () => {
					calls.push({ type: "cancel" });
					const utterance = activeUtterance;
					activeUtterance = null;
					utterance?.onerror?.({
						error: "canceled",
					} as SpeechSynthesisErrorEvent);
				},
				pause: () => {},
				resume: () => {},
				get speaking() {
					return activeUtterance !== null;
				},
				get paused() {
					return false;
				},
				get pending() {
					return false;
				},
			} satisfies Partial<SpeechSynthesis>,
		});
		Object.defineProperty(window, "__pieBrowserSpeechCalls", {
			configurable: true,
			value: calls,
		});
	});
}

const browserSpeechCalls = (page: Page): Promise<BrowserSpeechCall[]> =>
	page.evaluate(
		() =>
			(window as unknown as { __pieBrowserSpeechCalls?: BrowserSpeechCall[] })
				.__pieBrowserSpeechCalls || [],
	);

const browserSpeakCalls = async (page: Page) =>
	(await browserSpeechCalls(page)).filter(
		(call): call is Extract<BrowserSpeechCall, { type: "speak" }> =>
			call.type === "speak",
	);

const hasBrowserCancel = async (page: Page) =>
	(await browserSpeechCalls(page)).some((call) => call.type === "cancel");

/**
 * Replace the audio element so each synthesized chunk "plays" silently and
 * ends immediately. This lets the per-chunk playback loop advance past the
 * leading prose chunks and reach the math chunk without waiting on real audio.
 */
async function installSilentAudio(page: Page): Promise<void> {
	await page.addInitScript(() => {
		class FakeAudio {
			src: string;
			volume = 1;
			currentTime = 0;
			playbackRate = 1;
			paused = true;
			onplay: ((event: Event) => void) | null = null;
			onended: ((event: Event) => void) | null = null;
			onerror: ((event: Event) => void) | null = null;
			onpause: ((event: Event) => void) | null = null;
			constructor(src?: string) {
				this.src = src || "";
			}
			play(): Promise<void> {
				this.paused = false;
				try {
					this.onplay?.(new Event("play"));
				} catch {
					/* ignore */
				}
				window.setTimeout(() => {
					try {
						this.onended?.(new Event("ended"));
					} catch {
						/* ignore */
					}
				}, 30);
				return Promise.resolve();
			}
			pause(): void {
				this.paused = true;
				try {
					this.onpause?.(new Event("pause"));
				} catch {
					/* ignore */
				}
			}
			addEventListener(): void {}
			removeEventListener(): void {}
		}
		Object.defineProperty(window, "Audio", {
			configurable: true,
			writable: true,
			value: FakeAudio,
		});
	});
}

/**
 * Capture the text passed to the browser speech synthesizer (silently) so we
 * can assert what the browser provider was actually asked to voice.
 */
async function captureBrowserUtterances(page: Page): Promise<void> {
	await page.addInitScript(() => {
		(window as unknown as { __ttsUtterances: string[] }).__ttsUtterances = [];
		const fakeSynth: SpeechSynthesis = {
			...window.speechSynthesis,
			getVoices: () =>
				[
					{
						name: "Test Voice",
						lang: "en-US",
						default: true,
						localService: true,
						voiceURI: "test-voice",
					},
				] as unknown as SpeechSynthesisVoice[],
			speak: (utterance: SpeechSynthesisUtterance) => {
				try {
					(
						window as unknown as { __ttsUtterances: string[] }
					).__ttsUtterances.push(String(utterance.text || ""));
				} catch {
					/* ignore */
				}
				utterance.onstart?.(new Event("start") as SpeechSynthesisEvent);
				window.setTimeout(() => {
					utterance.onend?.(new Event("end") as SpeechSynthesisEvent);
				}, 30);
			},
			cancel: () => {},
			pause: () => {},
			resume: () => {},
			get speaking() {
				return false;
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
			value: fakeSynth,
		});
	});
}

/**
 * Replace the audio element with one whose `currentTime` advances in real time
 * after `play()`, so `ServerTTSProvider.startWordHighlighting` (which polls
 * `currentTime` every 50ms) actually fires word boundaries — the highlight
 * pipeline never runs otherwise. Each chunk "ends" after a fixed window, which
 * is long enough for the early formula's tokens to fire while keeping the
 * per-chunk playback loop moving.
 */
async function installAdvancingAudio(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const CHUNK_DURATION_MS = 2600;
		class FakeAudio {
			src: string;
			volume = 1;
			playbackRate = 1;
			paused = true;
			private startedAt = 0;
			private frozen = 0;
			private endTimer: number | null = null;
			onplay: ((event: Event) => void) | null = null;
			onended: ((event: Event) => void) | null = null;
			onerror: ((event: Event) => void) | null = null;
			onpause: ((event: Event) => void) | null = null;
			constructor(src?: string) {
				this.src = src || "";
			}
			get currentTime(): number {
				if (this.paused) return this.frozen;
				return (performance.now() - this.startedAt) / 1000;
			}
			set currentTime(value: number) {
				this.frozen = value;
			}
			play(): Promise<void> {
				this.paused = false;
				this.startedAt = performance.now();
				try {
					this.onplay?.(new Event("play"));
				} catch {
					/* ignore */
				}
				this.endTimer = window.setTimeout(() => {
					try {
						this.onended?.(new Event("ended"));
					} catch {
						/* ignore */
					}
				}, CHUNK_DURATION_MS);
				return Promise.resolve();
			}
			pause(): void {
				this.frozen = this.currentTime;
				this.paused = true;
				if (this.endTimer !== null) {
					window.clearTimeout(this.endTimer);
					this.endTimer = null;
				}
				try {
					this.onpause?.(new Event("pause"));
				} catch {
					/* ignore */
				}
			}
			addEventListener(): void {}
			removeEventListener(): void {}
		}
		Object.defineProperty(window, "Audio", {
			configurable: true,
			writable: true,
			value: FakeAudio,
		});
	});
}

/**
 * Mock the synthesis endpoint with realistic Polly-style word speech marks
 * derived from the exact text/SSML each chunk sends. Marks carry the spoken
 * `value` and the character offset into the request text (raw SSML for math),
 * mirroring what AWS Polly returns — so the highlight pipeline exercises the
 * real raw-SSML → spoken-text → token/word resolution path end-to-end.
 */
async function mockSynthesizeWithWordMarks(page: Page): Promise<void> {
	await page.route("**/synthesize", async (route) => {
		let text = "";
		try {
			text = JSON.parse(route.request().postData() || "{}").text || "";
		} catch {
			text = "";
		}
		const marks: Array<{
			type: "word";
			time: number;
			start: number;
			end: number;
			value: string;
		}> = [];
		let word = "";
		let wordStart = -1;
		let inTag = false;
		const pushWord = () => {
			if (word) {
				marks.push({
					type: "word",
					time: marks.length * 55,
					start: wordStart,
					end: wordStart + word.length,
					value: word,
				});
			}
			word = "";
			wordStart = -1;
		};
		for (let index = 0; index < text.length; index += 1) {
			const char = text[index];
			if (inTag) {
				if (char === ">") inTag = false;
				continue;
			}
			if (char === "<") {
				pushWord();
				inTag = true;
				continue;
			}
			if (/[A-Za-z0-9]/.test(char)) {
				if (!word) wordStart = index;
				word += char;
			} else {
				pushWord();
			}
		}
		pushWord();
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				audio: "",
				contentType: "audio/mpeg",
				speechMarks: marks,
				metadata: {
					providerId: "aws-polly",
					voice: "Joanna",
					duration: marks.length * 55,
					charCount: text.length,
					cached: false,
				},
			}),
		});
	});
}

/**
 * Wrap the live HighlightCoordinator so every highlight call is recorded
 * non-transiently. Each highlight is classified by where it lands:
 *
 *  - A per-token math highlight paints a token *inside* a rendered `<math>`
 *    element — either a CSS range over a token text node (`highlightTTSWord`,
 *    e.g. `<mi>x</mi>`) or the token element itself (`highlightTTSWordElement`,
 *    e.g. an `<msup>` superscript). We record its `visible` geometry so the
 *    test only counts highlights the student can actually see — a highlight on
 *    a clipped/assistive math node would not count.
 *  - A prose word highlight paints a CSS range over a text node *outside* any
 *    `<math>` element.
 *  - A region/expression highlight (`highlightTTSSentence`) paints a whole
 *    block; counting these separately lets us prove math is tracked per token
 *    rather than only as a single block.
 */
async function installHighlightRecorder(page: Page): Promise<void> {
	await waitForCoordinator(page);
	const installed = await page.evaluate(() => {
		const coordinator = (
			window as unknown as { __pieDemoToolkitCoordinator?: any }
		).__pieDemoToolkitCoordinator;
		const hc = coordinator?.highlightCoordinator;
		const store = {
			proseWords: [] as Array<{ text: string; visible: boolean }>,
			mathTokens: [] as Array<{ text: string; visible: boolean }>,
			sentences: [] as string[],
		};
		(window as any).__hl = store;
		if (!hc) return false;
		const insideMath = (el: any): boolean =>
			Boolean(el && typeof el.closest === "function" && el.closest("math"));
		const isVisible = (el: any): boolean => {
			try {
				const rect = el?.getBoundingClientRect?.();
				return Boolean(rect && rect.width > 0 && rect.height > 0);
			} catch {
				return false;
			}
		};
		const wrap = (name: string, record: (...args: any[]) => void) => {
			const original = hc[name];
			if (typeof original !== "function") return;
			hc[name] = function patched(...args: any[]) {
				try {
					record(...args);
				} catch {
					/* ignore */
				}
				return original.apply(hc, args);
			};
		};
		wrap("highlightTTSWord", (node: any, start: number, end: number) => {
			const text = String(node?.textContent || "")
				.slice(start, end)
				.trim();
			if (!text) return;
			const parent = node?.parentElement;
			const record = { text, visible: isVisible(parent) };
			if (insideMath(parent)) store.mathTokens.push(record);
			else store.proseWords.push(record);
		});
		wrap("highlightTTSWordElement", (el: any) => {
			const record = {
				text: String(el?.localName || "unknown"),
				visible: isVisible(el),
			};
			if (insideMath(el)) store.mathTokens.push(record);
			else store.proseWords.push(record);
		});
		wrap("highlightTTSSentence", (ranges: any[]) => {
			for (const range of ranges || []) {
				store.sentences.push(String(range?.toString?.() || ""));
			}
		});
		return true;
	});
	expect(installed, "highlight coordinator must be available to wrap").toBe(
		true,
	);
}

interface RecordedHighlight {
	text: string;
	visible: boolean;
}

interface RecordedHighlights {
	proseWords: RecordedHighlight[];
	mathTokens: RecordedHighlight[];
	sentences: string[];
}

// A token-capable formula yields many per-token highlights; require several so
// the test fails on a regression that falls back to whole-formula block
// highlighting (which produces zero per-token math highlights).
const MIN_VISIBLE_MATH_TOKENS = 3;

const visibleMathTokenCount = (recorded: RecordedHighlights): number =>
	recorded.mathTokens.filter((token) => token.visible).length;

const visibleProseWordCount = (recorded: RecordedHighlights): number =>
	recorded.proseWords.filter((word) => word.visible).length;

/**
 * Drive a passage read on a demo and assert both prose word-level and math
 * token-level highlighting actually fire on visible content. Returns the
 * recorded highlights so callers can compare behavior across demos.
 */
async function readPassageAndRecordHighlights(
	page: Page,
	demoPath: string,
): Promise<RecordedHighlights> {
	await page.goto(`${demoPath}?mode=candidate&layout=splitpane`, {
		waitUntil: "networkidle",
	});
	await expect(page.getByRole("link", { name: "Student" })).toBeVisible();

	const passageRegion = page.getByRole("complementary", { name: "Passages" });
	await expect(passageRegion.locator("p.formula math")).toBeVisible({
		timeout: 15_000,
	});

	await installHighlightRecorder(page);

	const passageInlineTts = passageRegion
		.locator("pie-tool-tts-inline:visible")
		.first();
	await expect(passageInlineTts).toBeVisible();
	await passageInlineTts.getByRole("button", { name: "Play reading" }).click();
	await expect(
		passageInlineTts.locator('[role="toolbar"][aria-label="Reading controls"]'),
	).toBeVisible();

	// Per-token math highlighting must occur on visible glyphs — not just a
	// whole-formula block. This is the behavior the generated path regressed on.
	await expect
		.poll(
			async () =>
				page.evaluate(() => {
					const store = (window as any).__hl as RecordedHighlights | undefined;
					return (store?.mathTokens ?? []).filter((token) => token.visible)
						.length;
				}),
			{
				timeout: 60_000,
				message:
					"expected per-token math highlighting on visible glyphs, not a whole-formula block",
			},
		)
		.toBeGreaterThanOrEqual(MIN_VISIBLE_MATH_TOKENS);

	// Prose word-level highlighting must also occur.
	await expect
		.poll(
			async () =>
				page.evaluate(() => {
					const store = (window as any).__hl as RecordedHighlights | undefined;
					return (store?.proseWords ?? []).filter((word) => word.visible)
						.length;
				}),
			{
				timeout: 20_000,
				message: "expected prose word-level highlighting",
			},
		)
		.toBeGreaterThan(0);

	const recorded = (await page.evaluate(
		() => (window as any).__hl,
	)) as RecordedHighlights;

	const stopButton = passageInlineTts.getByRole("button", {
		name: "Stop reading",
	});
	if (await stopButton.isEnabled().catch(() => false)) {
		await stopButton.click();
	}

	return recorded;
}

test.describe("section player TTS highlighting parity (authored vs generated SSML)", () => {
	// The generated-SSML demo (no authored catalogs) must behave the same as the
	// authored-SSML demo: prose tracks word-by-word AND math tracks token-by-token
	// for token-capable formulas. This is the coverage that was missing — the
	// earlier specs mocked empty speech marks and never ran the highlight
	// pipeline, so a generated-path regression to whole-formula block
	// highlighting went unnoticed.
	for (const demo of [
		{ name: "authored SSML (tts-ssml)", path: "/tts-ssml" },
		{
			name: "generated SSML (tts-generated-ssml)",
			path: "/tts-generated-ssml",
		},
	]) {
		test(`highlights prose words and math tokens during a passage read — ${demo.name}`, async ({
			page,
		}) => {
			test.setTimeout(120_000);
			await installAdvancingAudio(page);
			await mockPollyVoices(page);
			await mockSynthesizeWithWordMarks(page);

			const recorded = await readPassageAndRecordHighlights(page, demo.path);

			expect(
				visibleMathTokenCount(recorded),
				`visible per-token math highlights for ${demo.name}: ${JSON.stringify(
					recorded.mathTokens,
				)}`,
			).toBeGreaterThanOrEqual(MIN_VISIBLE_MATH_TOKENS);
			expect(
				visibleProseWordCount(recorded),
				`visible prose word highlights for ${demo.name}`,
			).toBeGreaterThan(0);
		});
	}
});

test.describe("section player demo tts-generated-ssml", () => {
	test("restarts generated math playback controls through browser speech synthesis", async ({
		page,
	}) => {
		test.setTimeout(120_000);
		await installHoldingBrowserSpeech(page);

		await gotoDemo(page);
		await forceBrowserTtsRuntime(page);

		const passageRegion = page.getByRole("complementary", { name: "Passages" });
		const passageInlineTts = passageRegion
			.locator("pie-tool-tts-inline:visible")
			.first();
		await expect(passageInlineTts).toBeVisible();

		await passageInlineTts
			.getByRole("button", { name: "Play reading" })
			.click();
		const passagePanel = passageInlineTts.locator(
			'[role="toolbar"][aria-label="Reading controls"]',
		);
		await expect(passagePanel).toBeVisible();
		await expect
			.poll(() => browserSpeakCalls(page).then((calls) => calls.length), {
				timeout: 45_000,
				message: "expected initial browser speech utterance",
			})
			.toBeGreaterThan(0);

		const initialSpeak = (await browserSpeakCalls(page))[0];
		expect(initialSpeak.rate).toBe(1);

		await passagePanel.getByRole("button", { name: "Fast-forward" }).click();
		await expect
			.poll(() => browserSpeakCalls(page).then((calls) => calls.length), {
				timeout: 10_000,
				message: "expected seek to trigger a fresh browser utterance",
			})
			.toBeGreaterThan(1);
		expect(await hasBrowserCancel(page)).toBe(true);
		expect((await browserSpeakCalls(page))[1].text).not.toBe(initialSpeak.text);

		await passagePanel.getByRole("button", { name: "1.25x" }).click();
		await expect
			.poll(
				() =>
					browserSpeakCalls(page).then((calls) =>
						calls.some((call) => call.rate === 1.25),
					),
				{
					timeout: 10_000,
					message: "expected speed change to restart browser speech",
				},
			)
			.toBe(true);
	});

	test("generates SSML on the fly for math and sends it to an SSML-capable provider", async ({
		page,
	}) => {
		test.setTimeout(120_000);
		await installSilentAudio(page);
		await mockPollyVoices(page);

		const synthBodies: string[] = [];
		await page.route("**/synthesize", async (route) => {
			synthBodies.push(route.request().postData() || "");
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					audio: "",
					contentType: "audio/mpeg",
					speechMarks: [],
					metadata: {
						providerId: "aws-polly",
						voice: "Joanna",
						duration: 0,
						charCount: 0,
						cached: false,
					},
				}),
			});
		});

		await gotoDemo(page);

		// Sanity: the quadratic-formula passage and its MathML render.
		const passageRegion = page.getByRole("complementary", { name: "Passages" });
		await expect(passageRegion.locator("p.formula math")).toBeVisible({
			timeout: 15_000,
		});

		// The demo defaults to the SSML-capable AWS Polly preset, so playing the
		// passage must route generated math SSML through the synthesis endpoint.
		const passageInlineTts = passageRegion
			.locator("pie-tool-tts-inline:visible")
			.first();
		await expect(passageInlineTts).toBeVisible();

		const ssmlSynthRequest = page.waitForRequest(
			(request) =>
				request.url().includes("/synthesize") &&
				request.method() === "POST" &&
				(request.postData() || "").includes("<speak"),
			{ timeout: 45_000 },
		);

		await passageInlineTts
			.getByRole("button", { name: "Play reading" })
			.click();
		const passagePanel = passageInlineTts.locator(
			'[role="toolbar"][aria-label="Reading controls"]',
		);
		await expect(passagePanel).toBeVisible();

		const ssmlRequest = await ssmlSynthRequest;
		const ssmlBody = ssmlRequest.postData() || "";
		const ssmlPayload = JSON.parse(ssmlBody) as { text?: string };
		const generatedSsml = ssmlPayload.text || "";

		// Generated math SSML reached the provider as a <speak> document...
		expect(generatedSsml).toContain("<speak");
		// ...voicing the quadratic math with SRE's own SSML character markup for
		// variables, not literal MathML or toolkit-invented text rewrites.
		expect(generatedSsml).toMatch(/squared|equals/i);
		expect(generatedSsml).toContain('interpret-as="character"');
		expect(generatedSsml).not.toContain("<math");

		// Prose chunks are sent as plain text (no SSML wrapper) — confirming that
		// only math is upgraded to SSML, not the whole passage.
		const plainBodies = synthBodies.filter((body) => !body.includes("<speak"));
		expect(plainBodies.length).toBeGreaterThan(0);

		await expect(passagePanel).toBeVisible();
	});

	test("sends plain spoken math (no SSML markup) to the browser provider", async ({
		page,
	}) => {
		test.setTimeout(120_000);
		await captureBrowserUtterances(page);
		await gotoDemo(page);
		await forceBrowserTtsRuntime(page);

		const passageRegion = page.getByRole("complementary", { name: "Passages" });
		const passageInlineTts = passageRegion
			.locator("pie-tool-tts-inline:visible")
			.first();
		await expect(passageInlineTts).toBeVisible();

		await passageInlineTts
			.getByRole("button", { name: "Play reading" })
			.click();
		const passagePanel = passageInlineTts.locator(
			'[role="toolbar"][aria-label="Reading controls"]',
		);
		await expect(passagePanel).toBeVisible();

		// The browser provider is not SSML-capable: the generated path must voice
		// math as plain spoken words rather than handing it `<speak>` markup.
		await expect
			.poll(
				async () =>
					page.evaluate(
						() =>
							(
								window as unknown as { __ttsUtterances?: string[] }
							).__ttsUtterances?.join("\n") || "",
					),
				{
					timeout: 45_000,
					message: "expected a spoken math word in a browser utterance",
				},
			)
			.toMatch(/squared|equals/i);

		const spoken = await page.evaluate(
			() =>
				(
					window as unknown as { __ttsUtterances?: string[] }
				).__ttsUtterances?.join("\n") || "",
		);
		expect(spoken).not.toContain("<speak");
		expect(spoken).not.toContain("<math");

		await expect(passagePanel).toBeVisible();
	});
});
