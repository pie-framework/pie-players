import { expect, test, type Page } from "@playwright/test";
import { expectDemoChromeReady } from "../../../test-support/demo-menu";

// Reproduction: use the Browser backend from the settings panel, preview a
// voice, apply it, and confirm the runtime speaks through the selected native
// Browser API voice.
const SERVER_DEFAULT_DEMO_PATH =
	"/tts-generated-ssml?mode=candidate&layout=splitpane";
const BROWSER_DEFAULT_DEMO_PATH =
	"/question-passage?mode=candidate&layout=splitpane";

async function gotoDemo(page: Page, path = SERVER_DEFAULT_DEMO_PATH) {
	await page.goto(path, { waitUntil: "networkidle" });
	await expectDemoChromeReady(page);
}

type SpeechCall = {
	type: string;
	text?: string;
	rate?: number;
	voice?: string | null;
	voiceURI?: string | null;
	effectiveVoice?: string | null;
	effectiveVoiceURI?: string | null;
};

/**
 * A realistic Web Speech mock: speech is never paused, speak() starts
 * immediately and fires onstart, word boundaries and end are driven
 * deterministically from the test, and cancel() reports an `interrupted`/
 * `canceled` error the way real browsers do. It intentionally does NOT model
 * the wedged "speaking with no events" state — that only happens when
 * cancel()/resume() are abused around speak(), which the implementation no
 * longer does.
 */
async function installWebSpeechMock(
	page: Page,
	options: { endBeforeStart?: boolean } = {},
) {
	await page.addInitScript(
		({ endBeforeStart }) => {
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
					voiceURI: "same-name-alternate",
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
			const effectiveVoiceFor = (
				utterance: MockSpeechSynthesisUtterance,
			): SpeechSynthesisVoice | null =>
				utterance.voice || voices.find((voice) => voice.default) || null;
			let activeUtterance: MockSpeechSynthesisUtterance | null = null;
			const finishActiveUtterance = () => {
				const utterance = activeUtterance;
				activeUtterance = null;
				if (utterance) {
					const effectiveVoice = effectiveVoiceFor(utterance);
					calls.push({
						type: "end",
						text: utterance.text,
						rate: utterance.rate,
						voice: utterance.voice?.name || null,
						voiceURI: utterance.voice?.voiceURI || null,
						effectiveVoice: effectiveVoice?.name || null,
						effectiveVoiceURI: effectiveVoice?.voiceURI || null,
					});
				}
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
						const effectiveVoice = effectiveVoiceFor(utterance);
						calls.push({
							type: "speak",
							text: utterance.text,
							rate: utterance.rate,
							voice: utterance.voice?.name || null,
							voiceURI: utterance.voice?.voiceURI || null,
							effectiveVoice: effectiveVoice?.name || null,
							effectiveVoiceURI: effectiveVoice?.voiceURI || null,
						});
						activeUtterance = utterance;
						window.setTimeout(() => {
							if (activeUtterance !== utterance) return;
							if (endBeforeStart) {
								activeUtterance = null;
								calls.push({
									type: "end",
									text: utterance.text,
									rate: utterance.rate,
									voice: utterance.voice?.name || null,
									voiceURI: utterance.voice?.voiceURI || null,
									effectiveVoice: effectiveVoice?.name || null,
									effectiveVoiceURI: effectiveVoice?.voiceURI || null,
								});
								utterance.onend?.({} as SpeechSynthesisEvent);
								return;
							}
							calls.push({
								type: "start",
								text: utterance.text,
								rate: utterance.rate,
								voice: utterance.voice?.name || null,
								voiceURI: utterance.voice?.voiceURI || null,
								effectiveVoice: effectiveVoice?.name || null,
								effectiveVoiceURI: effectiveVoice?.voiceURI || null,
							});
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
		},
		{ endBeforeStart: options.endBeforeStart === true },
	);
}

function speakCalls(page: Page): Promise<SpeechCall[]> {
	return speechCallsOfType(page, "speak");
}

function speechCallsOfType(page: Page, type: string): Promise<SpeechCall[]> {
	return page.evaluate(
		(callType) =>
			(
				window as unknown as { __pieTtsSpeechSynthesisCalls?: SpeechCall[] }
			).__pieTtsSpeechSynthesisCalls?.filter(
				(call) => call.type === callType,
			) ?? [],
		type,
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

function sentenceHighlightText(page: Page): Promise<string> {
	return page.evaluate(() => {
		const registry = (
			globalThis.CSS as unknown as {
				highlights?: { get: (name: string) => Iterable<Range> | undefined };
			}
		).highlights;
		const highlight = registry?.get("tts-sentence");
		return highlight
			? Array.from(highlight, (range) => range.toString()).join(" ")
			: "";
	});
}

test("ordinary section demos default to browser TTS without server requests", async ({
	page,
}) => {
	await installWebSpeechMock(page);
	const serverTtsRequests: string[] = [];
	const duplicateContentStyleWarnings: string[] = [];
	page.on("request", (request) => {
		const url = new URL(request.url());
		if (url.pathname.startsWith("/api/tts")) {
			serverTtsRequests.push(url.pathname);
		}
	});
	page.on("console", (message) => {
		if (message.text().includes("PIE content stylesheet is loaded twice")) {
			duplicateContentStyleWarnings.push(message.text());
		}
	});
	await gotoDemo(page, BROWSER_DEFAULT_DEMO_PATH);

	await expect
		.poll(() =>
			page.evaluate(() => {
				const coordinator = (
					window as unknown as { __pieDemoToolkitCoordinator?: any }
				).__pieDemoToolkitCoordinator;
				return coordinator?.getToolConfig?.("textToSpeech")?.backend ?? null;
			}),
		)
		.toBe("browser");

	const passageInlineTts = page
		.getByRole("complementary", { name: "Passages" })
		.locator("pie-tool-tts-inline:visible")
		.first();
	await expect(passageInlineTts).toBeVisible();
	await passageInlineTts.getByRole("button", { name: "Play reading" }).click();
	await expect.poll(async () => (await speakCalls(page)).length).toBe(1);
	await expect
		.poll(async () => (await speechCallsOfType(page, "start")).length)
		.toBe(1);
	await expect.poll(() => sentenceHighlightText(page)).not.toBe("");
	const firstHighlightedSentence = await sentenceHighlightText(page);
	expect(firstHighlightedSentence.trim().length).toBeGreaterThan(0);
	expect(await speechCallsOfType(page, "cancel")).toHaveLength(0);
	const spoken = (await speakCalls(page))[0];
	expect(spoken.text).toContain("The Renaissance");
	expect(spoken.voice).toBeNull();
	expect(spoken.voiceURI).toBeNull();
	expect(spoken.effectiveVoice).toBe("Samantha");
	expect(spoken.effectiveVoiceURI).toBe("samantha");
	await finishSpeech(page);
	await expect
		.poll(async () => (await speechCallsOfType(page, "end")).length)
		.toBeGreaterThan(0);
	await expect.poll(async () => (await speakCalls(page)).length).toBe(2);
	await expect
		.poll(async () => (await speechCallsOfType(page, "start")).length)
		.toBe(2);
	await expect.poll(() => sentenceHighlightText(page)).not.toBe("");
	await expect
		.poll(() => sentenceHighlightText(page))
		.not.toBe(firstHighlightedSentence);
	const secondHighlightedSentence = await sentenceHighlightText(page);
	const secondSpoken = (await speakCalls(page))[1];
	const secondSpokenText = secondSpoken.text?.replace(/\s+/g, " ").trim() ?? "";
	expect(secondSpokenText).not.toBe("");
	expect(secondHighlightedSentence.replace(/\s+/g, " ").trim()).toContain(
		secondSpokenText,
	);
	expect((await speechCallsOfType(page, "end"))[0]).toMatchObject({
		text: spoken.text,
		voice: null,
		voiceURI: null,
		effectiveVoice: "Samantha",
		effectiveVoiceURI: "samantha",
	});
	expect(await speechCallsOfType(page, "cancel")).toHaveLength(0);
	await passageInlineTts.getByRole("radio", { name: "Fast speed" }).click();
	await expect
		.poll(async () => (await speechCallsOfType(page, "cancel")).length)
		.toBe(1);
	await expect.poll(async () => (await speakCalls(page)).length).toBe(3);
	await expect
		.poll(async () => (await speechCallsOfType(page, "start")).length)
		.toBe(3);
	const replacementSpeak = (await speakCalls(page))[2];
	expect(replacementSpeak.rate).toBeGreaterThan(1);
	expect(replacementSpeak.text).toBe((await speakCalls(page))[1]?.text);
	await page.waitForTimeout(100);
	expect(await speakCalls(page)).toHaveLength(3);
	expect(await speechCallsOfType(page, "cancel")).toHaveLength(1);
	await expect.poll(() => sentenceHighlightText(page)).not.toBe("");
	const runtimeTts = await page.evaluate(() => {
		const coordinator = (
			window as unknown as { __pieDemoToolkitCoordinator?: any }
		).__pieDemoToolkitCoordinator;
		return {
			backend: coordinator?.getToolConfig?.("textToSpeech")?.backend ?? null,
			providerId: coordinator?.ttsService?.currentProvider?.providerId ?? null,
		};
	});
	expect(runtimeTts).toEqual({ backend: "browser", providerId: "browser" });
	expect(serverTtsRequests).toEqual([]);
	expect(duplicateContentStyleWarnings).toEqual([]);
});

test("Browser start failure clears controls and sentence highlighting", async ({
	page,
}) => {
	await installWebSpeechMock(page, { endBeforeStart: true });
	await gotoDemo(page, BROWSER_DEFAULT_DEMO_PATH);

	const passage = page.getByRole("complementary", { name: "Passages" });
	await passage.getByRole("button", { name: "Play reading" }).click();

	await expect(passage.getByRole("status")).toHaveText(
		"Unable to start reading",
	);
	await expect(
		passage.getByRole("toolbar", { name: "Reading controls" }),
	).toHaveCount(0);
	await expect(
		page.locator('[data-pie-tts-sentence-element="true"]'),
	).toHaveCount(0);
	await expect(page.locator('[data-pie-tts-word-element="true"]')).toHaveCount(
		0,
	);
	await expect.poll(() => sentenceHighlightText(page)).toBe("");
	await expect(
		passage.getByRole("button", { name: "Play reading" }),
	).toHaveCount(1);
});

test("speaks with the selected Browser voice on question-passage", async ({
	page,
}) => {
	await installWebSpeechMock(page);
	await gotoDemo(page, BROWSER_DEFAULT_DEMO_PATH);

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

	// Preview with the auto voice. Chrome's browser default stays unassigned on
	// the utterance, so the native engine selects Samantha through its default.
	await previewBtn.click();
	const previewTrack = dialog.locator(".pie-tts-preview-track");
	await expect.poll(async () => (await speakCalls(page)).length).toBe(1);
	const firstSpeak = (await speakCalls(page))[0];
	expect(firstSpeak.text).toContain("browser voice sample");
	expect(firstSpeak.voice).toBeNull();
	expect(firstSpeak.voiceURI).toBeNull();
	expect(firstSpeak.effectiveVoice).toBe("Samantha");
	expect(firstSpeak.effectiveVoiceURI).toBe("samantha");
	await expect
		.poll(async () => (await speechCallsOfType(page, "start")).length)
		.toBe(1);

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
	await voiceSelect.selectOption("local-english");
	await previewBtn.click();
	await expect.poll(async () => (await speakCalls(page)).length).toBe(2);
	expect((await speakCalls(page)).at(-1)?.voice).toBe("Local English Voice");
	expect((await speakCalls(page)).at(-1)?.voiceURI).toBe("local-english");
	await finishSpeech(page);
	await expect
		.poll(async () => (await speechCallsOfType(page, "end")).length)
		.toBeGreaterThan(0);
	expect((await speechCallsOfType(page, "end")).at(-1)?.voice).toBe(
		"Local English Voice",
	);
	expect((await speechCallsOfType(page, "end")).at(-1)?.voiceURI).toBe(
		"local-english",
	);
	await expect(
		dialog.getByRole("button", { name: "Preview voice" }),
	).toBeVisible();

	await applyBtn.click();
	await expect(dialog).toBeHidden();

	// Applying must switch the live runtime to the browser provider. Read the
	// page-lifetime coordinator from the stable demo seam rather than the TTS
	// panel element, which unmounts when the dialog closes on Apply.
	await expect
		.poll(() =>
			page.evaluate(() => {
				const coordinator = (
					window as unknown as { __pieDemoToolkitCoordinator?: any }
				).__pieDemoToolkitCoordinator;
				return {
					backend:
						coordinator?.getToolConfig?.("textToSpeech")?.backend ?? null,
					defaultVoice:
						coordinator?.getToolConfig?.("textToSpeech")?.defaultVoice ?? null,
					providerId:
						coordinator?.ttsService?.currentProvider?.providerId ?? null,
				};
			}),
		)
		.toMatchObject({
			backend: "browser",
			defaultVoice: "local-english",
			providerId: "browser",
		});

	// ...and playing a passage now drives window.speechSynthesis instead of the
	// server audio path.
	const beforeRuntimeSpeaks = (await speakCalls(page)).length;
	const beforeRuntimeStarts = (await speechCallsOfType(page, "start")).length;
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
	const runtimeSpeak = (await speakCalls(page)).at(-1);
	expect(runtimeSpeak?.text).toContain("The Renaissance");
	expect(runtimeSpeak?.voice).toBe("Local English Voice");
	expect(runtimeSpeak?.voiceURI).toBe("local-english");
	await expect
		.poll(async () => (await speechCallsOfType(page, "start")).length)
		.toBeGreaterThan(beforeRuntimeStarts);
	const beforeRuntimeEnds = (await speechCallsOfType(page, "end")).length;
	await finishSpeech(page);
	await expect
		.poll(async () => (await speechCallsOfType(page, "end")).length)
		.toBeGreaterThan(beforeRuntimeEnds);
	expect((await speechCallsOfType(page, "end")).at(-1)).toMatchObject({
		text: runtimeSpeak?.text,
		voice: "Local English Voice",
		voiceURI: "local-english",
	});

	await page.getByRole("button", { name: "Toggle TTS settings panel" }).click();
	const browserTab = page
		.locator(".pie-tts-dialog")
		.getByRole("button", { name: "Browser", exact: true });
	await expect(browserTab).toHaveClass(/btn-active/);

	// The panel persists settings, so a new coordinator created on reload must
	// hydrate Browser and the selected voice before playback instead of merely
	// showing the persisted selection in the panel.
	await page.reload({ waitUntil: "networkidle" });
	await expect
		.poll(() =>
			page.evaluate(() => {
				const coordinator = (
					window as unknown as { __pieDemoToolkitCoordinator?: any }
				).__pieDemoToolkitCoordinator;
				return {
					backend:
						coordinator?.getToolConfig?.("textToSpeech")?.backend ?? null,
					provider:
						coordinator?.getToolConfig?.("textToSpeech")?.provider ?? null,
					serverProvider:
						coordinator?.getToolConfig?.("textToSpeech")?.serverProvider ??
						null,
					apiEndpoint:
						coordinator?.getToolConfig?.("textToSpeech")?.apiEndpoint ?? null,
					defaultVoice:
						coordinator?.getToolConfig?.("textToSpeech")?.defaultVoice ?? null,
					providerId:
						coordinator?.ttsService?.currentProvider?.providerId ?? null,
				};
			}),
		)
		.toEqual({
			backend: "browser",
			provider: null,
			serverProvider: null,
			apiEndpoint: null,
			defaultVoice: "local-english",
			providerId: "browser",
		});

	const reloadedDialog = page.locator(".pie-tts-dialog");
	if (await reloadedDialog.isVisible()) {
		await reloadedDialog
			.getByRole("button", { name: "Close", exact: true })
			.click();
	}
	const reloadedPassageTts = page
		.getByRole("complementary", { name: "Passages" })
		.locator("pie-tool-tts-inline:visible")
		.first();
	await reloadedPassageTts
		.getByRole("button", { name: "Play reading" })
		.click();
	await expect
		.poll(async () => (await speakCalls(page)).length)
		.toBeGreaterThan(0);
	const reloadedSpeak = (await speakCalls(page))[0];
	expect(reloadedSpeak.text).toContain("The Renaissance");
	expect(reloadedSpeak.voice).toBe("Local English Voice");
	expect(reloadedSpeak.voiceURI).toBe("local-english");
	await expect
		.poll(async () => (await speechCallsOfType(page, "start")).length)
		.toBeGreaterThan(0);
	await finishSpeech(page);

	// Browser voice identifiers support documented display names as well as
	// unique URIs. Once voices load, the panel maps a recognized name to its
	// URI-valued option and persists that exact identity when it is applied.
	await page.evaluate(() => {
		let settingsKey: string | null = null;
		for (let index = 0; index < window.localStorage.length; index += 1) {
			const key = window.localStorage.key(index);
			if (
				key?.startsWith("pie:debug-panels:v1:") &&
				key.endsWith(":tts-settings")
			) {
				settingsKey = key;
				break;
			}
		}
		if (!settingsKey) throw new Error("Expected persisted TTS settings");
		const stored = JSON.parse(window.localStorage.getItem(settingsKey) || "{}");
		stored.defaultVoice = "Samantha";
		window.localStorage.setItem(settingsKey, JSON.stringify(stored));
	});
	await page.reload({ waitUntil: "networkidle" });
	await expectDemoChromeReady(page);
	await page.getByRole("button", { name: "Toggle TTS settings panel" }).click();
	const namedVoiceSettingsDialog = page.locator(".pie-tts-dialog");
	const namedVoiceSelect =
		namedVoiceSettingsDialog.locator("#tts-browser-voice");
	await expect(namedVoiceSelect).toHaveValue("samantha");
	await namedVoiceSettingsDialog
		.getByRole("button", { name: /^Apply|Applying/ })
		.click();
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					(
						window as unknown as { __pieDemoToolkitCoordinator?: any }
					).__pieDemoToolkitCoordinator?.getToolConfig?.("textToSpeech")
						?.defaultVoice ?? null,
			),
		)
		.toBe("samantha");
});

test("Browser settings replace server-only source configuration", async ({
	page,
}) => {
	await installWebSpeechMock(page);
	await gotoDemo(page, SERVER_DEFAULT_DEMO_PATH);

	await page.getByRole("button", { name: "Toggle TTS settings panel" }).click();
	const dialog = page.locator(".pie-tts-dialog");
	await dialog.getByRole("button", { name: "Browser", exact: true }).click();
	const applyButton = dialog.getByRole("button", { name: /^Apply|Applying/ });
	await expect(applyButton).toBeEnabled();
	await applyButton.click();

	await expect
		.poll(() =>
			page.evaluate(() => {
				const coordinator = (
					window as unknown as { __pieDemoToolkitCoordinator?: any }
				).__pieDemoToolkitCoordinator;
				const config = coordinator?.getToolConfig?.("textToSpeech");
				return {
					backend: config?.backend ?? null,
					provider: config?.provider ?? null,
					serverProvider: config?.serverProvider ?? null,
					apiEndpoint: config?.apiEndpoint ?? null,
					providerId:
						coordinator?.ttsService?.currentProvider?.providerId ?? null,
				};
			}),
		)
		.toEqual({
			backend: "browser",
			provider: null,
			serverProvider: null,
			apiEndpoint: null,
			providerId: "browser",
		});
});
