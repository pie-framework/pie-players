import { expect, test, type Page } from "@playwright/test";

// Reproduction: from the Polly-default tts demo, select the Browser backend
// from the settings panel, preview a voice, apply it, and confirm the runtime
// switches to the browser provider.
const DEMO_PATH = "/tts-generated-ssml?mode=candidate&layout=splitpane";

async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expect(page.getByRole("link", { name: "Student" })).toBeVisible();
}

type SpeechCall = { type: string; text?: string; voice?: string | null };

/**
 * A realistic Web Speech mock: speech is never paused, speak() starts
 * immediately and fires onstart, word boundaries and end are driven
 * deterministically from the test, and cancel() reports an `interrupted`/
 * `canceled` error the way real browsers do. It intentionally does NOT model
 * the wedged "speaking with no events" state — that only happens when
 * cancel()/resume() are abused around speak(), which the implementation no
 * longer does.
 */
async function installWebSpeechMock(page: Page) {
	await page.addInitScript(() => {
		const calls: SpeechCall[] = [];
		const voices: SpeechSynthesisVoice[] = [
			{
				default: false,
				lang: "en-US",
				localService: false,
				name: "Remote Default Voice",
				voiceURI: "remote-default",
			} as SpeechSynthesisVoice,
			{
				default: true,
				lang: "en-US",
				localService: true,
				name: "Samantha",
				voiceURI: "samantha",
			} as SpeechSynthesisVoice,
			{
				default: false,
				lang: "en-US",
				localService: true,
				name: "Local English Voice",
				voiceURI: "local-english",
			} as SpeechSynthesisVoice,
		];
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
		const finishActiveUtterance = () => {
			const utterance = activeUtterance;
			activeUtterance = null;
			utterance?.onend?.({} as SpeechSynthesisEvent);
		};
		const emitBoundary = (charIndex: number) => {
			activeUtterance?.onboundary?.({
				name: "word",
				charIndex,
			} as unknown as SpeechSynthesisEvent);
		};
		Object.defineProperty(window, "SpeechSynthesisUtterance", {
			configurable: true,
			value: MockSpeechSynthesisUtterance,
		});
		Object.defineProperty(window, "speechSynthesis", {
			configurable: true,
			value: {
				getVoices: () => voices,
				cancel: () => {
					calls.push({ type: "cancel" });
					const utterance = activeUtterance;
					activeUtterance = null;
					utterance?.onerror?.({
						error: "canceled",
					} as SpeechSynthesisErrorEvent);
				},
				pause: () => calls.push({ type: "pause" }),
				resume: () => calls.push({ type: "resume" }),
				speak: (utterance: MockSpeechSynthesisUtterance) => {
					calls.push({
						type: "speak",
						text: utterance.text,
						voice: utterance.voice?.name || null,
					});
					activeUtterance = utterance;
					window.setTimeout(() => {
						utterance.onstart?.({} as SpeechSynthesisEvent);
					}, 0);
				},
				get paused() {
					return false;
				},
				get pending() {
					return false;
				},
				get speaking() {
					return activeUtterance !== null;
				},
			},
		});
		Object.defineProperty(window, "__pieTtsSpeechSynthesisCalls", {
			configurable: true,
			value: calls,
		});
		Object.defineProperty(window, "__pieTtsSpeechSynthesisFinish", {
			configurable: true,
			value: finishActiveUtterance,
		});
		Object.defineProperty(window, "__pieTtsSpeechSynthesisEmitBoundary", {
			configurable: true,
			value: emitBoundary,
		});
	});
}

function speakCalls(page: Page): Promise<SpeechCall[]> {
	return page.evaluate(
		() =>
			(
				window as unknown as { __pieTtsSpeechSynthesisCalls?: SpeechCall[] }
			).__pieTtsSpeechSynthesisCalls?.filter((call) => call.type === "speak") ??
			[],
	);
}

function hasCancel(page: Page): Promise<boolean> {
	return page.evaluate(
		() =>
			(
				window as unknown as { __pieTtsSpeechSynthesisCalls?: SpeechCall[] }
			).__pieTtsSpeechSynthesisCalls?.some((call) => call.type === "cancel") ??
			false,
	);
}

function emitBoundary(page: Page, charIndex: number): Promise<void> {
	return page.evaluate(
		(index) =>
			(
				window as unknown as {
					__pieTtsSpeechSynthesisEmitBoundary?: (charIndex: number) => void;
				}
			).__pieTtsSpeechSynthesisEmitBoundary?.(index),
		charIndex,
	);
}

function finishSpeech(page: Page): Promise<void> {
	return page.evaluate(() =>
		(
			window as unknown as { __pieTtsSpeechSynthesisFinish?: () => void }
		).__pieTtsSpeechSynthesisFinish?.(),
	);
}

test("can preview and apply Browser backend from the TTS settings panel", async ({
	page,
}) => {
	await installWebSpeechMock(page);
	await gotoDemo(page);

	await page.getByRole("button", { name: "Toggle TTS settings panel" }).click();
	const dialog = page.locator(".pie-tts-dialog");
	await expect(
		dialog.getByRole("heading", { name: "TTS settings" }),
	).toBeVisible();

	await dialog.getByRole("button", { name: "Browser", exact: true }).click();
	const previewBtn = dialog.getByRole("button", {
		name: /Preview voice|Stop preview/,
	});
	const applyBtn = dialog.getByRole("button", { name: /^Apply|Applying/ });
	await expect(dialog.locator(".pie-tts-status")).toContainText(
		/Browser TTS available/,
	);
	await expect(previewBtn).toBeEnabled();
	await expect(applyBtn).toBeEnabled();

	// Auto voice selection UI: "auto" first, ranked recommended group, then the
	// remaining voices.
	const voiceSelect = dialog.locator("#tts-browser-voice");
	await expect(voiceSelect.locator("option").first()).toContainText(
		"Best available voice (auto)",
	);
	await expect(dialog.locator(".pie-tts-browser-auto-voice")).toContainText(
		/Samantha.*en-US.*local/i,
	);
	const voiceGroups = await voiceSelect.evaluate((select) =>
		Array.from(select.querySelectorAll("optgroup")).map((group) => ({
			label: group.label,
			options: Array.from(group.querySelectorAll("option")).map(
				(option) => option.textContent || "",
			),
		})),
	);
	expect(voiceGroups.map((group) => group.label)).toEqual([
		"Recommended voices",
		"All available voices",
	]);
	expect(voiceGroups[0]?.options.join("\n")).toContain("Samantha");
	expect(voiceGroups[0]?.options.join("\n")).toContain("Local English Voice");
	expect(voiceGroups[1]?.options.join("\n")).toContain("Remote Default Voice");

	// Preview with the auto voice. Samantha is the browser default in the mock,
	// so it is left unassigned (native default playback) rather than forced onto
	// the utterance.
	await previewBtn.click();
	const previewTrack = dialog.locator(".pie-tts-preview-track");
	await expect.poll(async () => (await speakCalls(page)).length).toBe(1);
	const firstSpeak = (await speakCalls(page))[0];
	expect(firstSpeak.text).toContain("browser voice sample");
	expect(firstSpeak.voice).toBeNull();

	// onstart highlights the first word; a word boundary advances the highlight.
	await expect(previewTrack.locator(".pie-tts-preview-active")).toHaveText(
		"This",
	);
	await emitBoundary(page, 5);
	await expect(previewTrack.locator(".pie-tts-preview-active")).not.toHaveText(
		"This",
	);

	await dialog.getByRole("button", { name: "Stop preview" }).click();
	await expect(
		dialog.getByRole("button", { name: "Preview voice" }),
	).toBeVisible();
	expect(await hasCancel(page)).toBe(true);

	// Explicitly selecting a non-default voice assigns that voice to the
	// utterance.
	await voiceSelect.selectOption("Local English Voice");
	await previewBtn.click();
	await expect.poll(async () => (await speakCalls(page)).length).toBe(2);
	expect((await speakCalls(page)).at(-1)?.voice).toBe("Local English Voice");
	await finishSpeech(page);
	await expect(
		dialog.getByRole("button", { name: "Preview voice" }),
	).toBeVisible();

	// Back to auto for the applied runtime config.
	await voiceSelect.selectOption("");

	await applyBtn.click();
	await expect(dialog).toBeHidden();

	// Applying must switch the live runtime to the browser provider. Read the
	// page-lifetime coordinator from the stable demo seam rather than the TTS
	// panel element, which unmounts when the dialog closes on Apply.
	const runtimeTts = await page.evaluate(async () => {
		const coordinator = (
			window as unknown as { __pieDemoToolkitCoordinator?: any }
		).__pieDemoToolkitCoordinator;
		await coordinator?.ensureTTSReady?.(
			coordinator?.getToolConfig?.("textToSpeech"),
		);
		return {
			backend: coordinator?.getToolConfig?.("textToSpeech")?.backend ?? null,
			providerId: coordinator?.ttsService?.currentProvider?.providerId ?? null,
		};
	});
	expect(runtimeTts).toMatchObject({
		backend: "browser",
		providerId: "browser",
	});

	// ...and playing a passage now drives window.speechSynthesis instead of the
	// server audio path.
	const beforeRuntimeSpeaks = (await speakCalls(page)).length;
	const passageRegion = page.getByRole("complementary", { name: "Passages" });
	const passageInlineTts = passageRegion
		.locator("pie-tool-tts-inline:visible")
		.first();
	await expect(passageInlineTts).toBeVisible();
	await passageInlineTts.getByRole("button", { name: "Play reading" }).click();
	await expect(
		passageInlineTts.locator('[role="toolbar"][aria-label="Reading controls"]'),
	).toBeVisible();
	await expect
		.poll(async () => (await speakCalls(page)).length)
		.toBeGreaterThan(beforeRuntimeSpeaks);
	// Auto voice resolves to the browser default (Samantha) at runtime too, so it
	// is left unassigned for native default playback.
	expect((await speakCalls(page)).at(-1)?.voice).toBeNull();

	await page.getByRole("button", { name: "Toggle TTS settings panel" }).click();
	const browserTab = page
		.locator(".pie-tts-dialog")
		.getByRole("button", { name: "Browser", exact: true });
	await expect(browserTab).toHaveClass(/btn-active/);
});
