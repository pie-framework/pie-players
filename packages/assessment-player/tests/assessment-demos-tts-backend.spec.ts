import { expect, type Page, test } from "@playwright/test";

/**
 * The assessment demos speak through the text-to-speech provider their
 * coordinator registers from the packaged tool registry: Polly through the demo
 * server when its voices route answers, browser speech when it does not. The TTS
 * routes are mocked, and browser speech is faked because Chromium under
 * Playwright fires no utterance events.
 */

const DEMO_PATHS = ["/three-section-assessment", "/session-hydrate-db"];

/**
 * What a coordinator without the section player's tool providers prints, and the
 * registry provider's failed initialization.
 */
const PROVIDER_GAP_LINES = [
	"falls back to browser speech",
	"[pie-section-player] Placed tool",
	"Failed to initialize TTS via registry",
	"No tool registry was supplied",
];

const VOICES_ROUTE = /\/api\/tts\/(?:[\w-]+\/)?voices(?:\?.*)?$/;
const SYNTHESIZE_ROUTE = /\/api\/tts\/synthesize(?:\?.*)?$/;
const AUDIO_MS = 800;

/** Silence as 16-bit mono PCM. */
function silentWav(durationMs: number, sampleRate = 16_000): Buffer {
	const dataBytes = Math.round((sampleRate * durationMs) / 1000) * 2;
	const wav = Buffer.alloc(44 + dataBytes);
	wav.write("RIFF", 0, "ascii");
	wav.writeUInt32LE(36 + dataBytes, 4);
	wav.write("WAVEfmt ", 8, "ascii");
	wav.writeUInt32LE(16, 16);
	wav.writeUInt16LE(1, 20);
	wav.writeUInt16LE(1, 22);
	wav.writeUInt32LE(sampleRate, 24);
	wav.writeUInt32LE(sampleRate * 2, 28);
	wav.writeUInt16LE(2, 32);
	wav.writeUInt16LE(16, 34);
	wav.write("data", 36, "ascii");
	wav.writeUInt32LE(dataBytes, 40);
	return wav;
}

/** A synthesis of `text`: the WAV, with word and sentence marks spread across it. */
function synthesisOf(text: string) {
	const marks = (type: "word" | "sentence", pattern: RegExp) =>
		[...text.matchAll(pattern)].map((match) => {
			const start = match.index ?? 0;
			return {
				time: Math.round((start / Math.max(text.length, 1)) * AUDIO_MS),
				type,
				start,
				end: start + match[0].length,
				value: match[0],
			};
		});
	return {
		audio: silentWav(AUDIO_MS).toString("base64"),
		contentType: "audio/wav",
		speechMarks: [
			...marks("sentence", /[^\s.!?][^.!?]*[.!?]*/g),
			...marks("word", /\S+/g),
		].sort((a, b) => a.time - b.time),
		metadata: {
			providerId: "aws-polly",
			voice: "Joanna",
			duration: AUDIO_MS / 1000,
			charCount: text.length,
			cached: false,
		},
	};
}

/** Mocks the demo server's TTS routes, and returns the texts sent for synthesis. */
async function mockTtsServer(
	page: Page,
	voicesStatus: 200 | 503,
): Promise<string[]> {
	const synthesized: string[] = [];
	await page.route(VOICES_ROUTE, (route) =>
		voicesStatus === 200
			? route.fulfill({
					json: {
						voices: [
							{
								id: "Joanna",
								name: "Joanna",
								languageCode: "en-US",
								gender: "female",
							},
						],
					},
				})
			: route.fulfill({ status: 503, json: { error: "TTS not configured" } }),
	);
	await page.route(SYNTHESIZE_ROUTE, (route) => {
		const { text } = route.request().postDataJSON() as { text: string };
		synthesized.push(text);
		return route.fulfill({ json: synthesisOf(text) });
	});
	return synthesized;
}

/**
 * Records media playback and browser utterances, and fakes utterance events: an
 * utterance starts when spoken and ends shortly after.
 */
async function recordSpeech(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const played: Array<{ src: string; ended: boolean }> = [];
		const spoken: string[] = [];
		Object.assign(window, { __played: played, __spoken: spoken });

		const play = HTMLMediaElement.prototype.play;
		HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
			const entry = { src: this.src, ended: false };
			played.push(entry);
			this.addEventListener("ended", () => {
				entry.ended = true;
			});
			return play.call(this);
		};

		const synth = window.speechSynthesis;
		let current: SpeechSynthesisUtterance | null = null;
		let timer: number | undefined;
		const end = () => {
			window.clearTimeout(timer);
			const utterance = current;
			current = null;
			utterance?.onend?.(new Event("end") as SpeechSynthesisEvent);
		};
		Object.defineProperty(window, "speechSynthesis", {
			configurable: true,
			value: {
				getVoices: () => synth.getVoices(),
				speak(utterance: SpeechSynthesisUtterance) {
					end();
					current = utterance;
					spoken.push(utterance.text);
					utterance.onstart?.(new Event("start") as SpeechSynthesisEvent);
					timer = window.setTimeout(end, 300);
				},
				cancel: end,
				pause() {},
				resume() {},
				get speaking() {
					return current !== null;
				},
				get pending() {
					return false;
				},
				get paused() {
					return false;
				},
				onvoiceschanged: null,
			},
		});
	});
}

function collectConsole(page: Page): string[] {
	const lines: string[] = [];
	page.on("console", (message) => lines.push(message.text()));
	return lines;
}

async function openDemo(page: Page, path: string) {
	await page.goto(path, { waitUntil: "networkidle" });
	const player = page.locator("pie-assessment-player-default");
	await expect(player).toBeVisible();
	return player;
}

function readTtsState(page: Page) {
	return page.evaluate(() => {
		const coordinator = (
			document.querySelector("pie-assessment-player-default") as
				| (HTMLElement & { coordinator?: any })
				| null
		)?.coordinator;
		return {
			registered: Boolean(coordinator?.toolProviderRegistry?.has("tts")),
			providerId: coordinator?.ttsService?.currentProvider?.providerId ?? null,
		};
	});
}

const played = (page: Page) =>
	page.evaluate(
		() =>
			(
				window as unknown as {
					__played: Array<{ src: string; ended: boolean }>;
				}
			).__played,
	);

const spoken = (page: Page) =>
	page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);

const providerGapLines = (lines: string[]) =>
	lines.filter((line) =>
		PROVIDER_GAP_LINES.some((fragment) => line.includes(fragment)),
	);

for (const path of DEMO_PATHS) {
	test.describe(`assessment demo ${path} text-to-speech`, () => {
		test("speaks with Polly through the registry's provider when the demo server has voices", async ({
			page,
		}) => {
			const consoleLines = collectConsole(page);
			await recordSpeech(page);
			const synthesized = await mockTtsServer(page, 200);
			const player = await openDemo(page, path);
			await expect(page.getByText("TTS backend: polly")).toBeVisible();

			await player
				.getByRole("button", { name: "Play reading", exact: true })
				.first()
				.click();

			await expect.poll(() => synthesized.length).toBeGreaterThan(0);
			await expect
				.poll(async () =>
					(await played(page)).filter(
						(entry) => entry.src.startsWith("blob:") && entry.ended,
					),
				)
				.toHaveLength(1);
			expect(await readTtsState(page)).toEqual({
				registered: true,
				providerId: "server-tts",
			});
			expect(await spoken(page)).toEqual([]);
			expect(providerGapLines(consoleLines)).toEqual([]);
		});

		test("speaks with browser speech through the registry's provider when the voices probe fails", async ({
			page,
		}) => {
			const consoleLines = collectConsole(page);
			await recordSpeech(page);
			const synthesized = await mockTtsServer(page, 503);
			const player = await openDemo(page, path);
			await expect(page.getByText("TTS backend: browser")).toBeVisible();

			await player
				.getByRole("button", { name: "Play reading", exact: true })
				.first()
				.click();

			await expect
				.poll(async () => (await spoken(page)).length)
				.toBeGreaterThan(0);
			expect(await readTtsState(page)).toEqual({
				registered: true,
				providerId: "browser",
			});
			expect(synthesized).toEqual([]);
			expect(providerGapLines(consoleLines)).toEqual([]);
		});
	});
}
