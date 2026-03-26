import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const DEMO_PATH = "/tts-ssml?mode=candidate&layout=splitpane";
const KNOWN_A11Y_BASELINE_DEBT = new Set(["aria-allowed-attr", "aria-roles", "tabindex"]);
// Keep playback windows short to avoid reading long passages in CI.
const TTS_PREVIEW_MS = 250;

async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expect(page.getByRole("link", { name: "Student" })).toBeVisible();
}

async function openSessionPanel(page: Page) {
	const toggle = page.getByRole("button", { name: "Toggle session panel" });
	const panel = page.locator("pie-section-player-tools-session-debugger");
	const heading = panel.getByRole("heading", { name: "Session Data" });
	if (!(await heading.isVisible())) {
		await toggle.click();
	}
	await expect(heading).toBeVisible();
	return panel;
}

async function readSessionSnapshot(
	sessionPanel: ReturnType<Page["locator"]>,
): Promise<{ itemSessions?: Record<string, unknown> }> {
	const snapshotPre = sessionPanel.locator("pre").first();
	await expect(snapshotPre).toBeVisible();
	let snapshot: { itemSessions?: Record<string, unknown> } | null = null;
	await expect
		.poll(
			async () => {
				const text = (await snapshotPre.textContent()) || "";
				try {
					snapshot = JSON.parse(text) as { itemSessions?: Record<string, unknown> };
					return true;
				} catch {
					snapshot = null;
					return false;
				}
			},
			{
				message: "Session snapshot did not become valid JSON in time",
				timeout: 10_000,
			},
		)
		.toBe(true);
	return snapshot || {};
}

async function forceBrowserTtsRuntime(page: Page): Promise<void> {
	await page.locator("pie-section-player-tools-session-debugger").evaluate(async (element) => {
		const coordinator = (element as any).toolkitCoordinator;
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

async function suppressAudibleBrowserTts(page: Page): Promise<void> {
	await page.addInitScript(() => {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
		const originalSynth = window.speechSynthesis;
		let activeUtterance: SpeechSynthesisUtterance | null = null;
		let playbackTimer: number | null = null;
		let speaking = false;
		let paused = false;
		const clearPlayback = () => {
			if (playbackTimer !== null) {
				window.clearTimeout(playbackTimer);
				playbackTimer = null;
			}
			activeUtterance = null;
			speaking = false;
			paused = false;
		};
		const dispatchSafe = (callback: ((event: SpeechSynthesisEvent) => void) | null | undefined) => {
			if (!callback) return;
			callback(new Event("speech") as SpeechSynthesisEvent);
		};
		const fakeSynth: SpeechSynthesis = {
			...originalSynth,
			getVoices: () => originalSynth.getVoices(),
			speak: (utterance: SpeechSynthesisUtterance) => {
				clearPlayback();
				activeUtterance = utterance;
				speaking = true;
				paused = false;
				dispatchSafe(utterance.onstart);
				// Keep "playing" long enough for control assertions, but remain silent.
				playbackTimer = window.setTimeout(() => {
					if (!activeUtterance) return;
					dispatchSafe(activeUtterance.onend);
					clearPlayback();
				}, 4000);
			},
			cancel: () => {
				if (activeUtterance) {
					dispatchSafe(activeUtterance.onend);
				}
				clearPlayback();
			},
			pause: () => {
				if (!speaking) return;
				paused = true;
			},
			resume: () => {
				if (!speaking) return;
				paused = false;
			},
			get speaking() {
				return speaking;
			},
			get paused() {
				return paused;
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

async function selectPassageText(page: Page): Promise<void> {
	await page.locator("pie-passage-shell [data-region='content'] p").first().evaluate((node) => {
		const textNode = node.firstChild;
		if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
			throw new Error("Passage paragraph is missing direct text node for selection.");
		}
		const text = textNode.textContent || "";
		const start = Math.min(5, Math.max(0, text.length - 2));
		const end = Math.min(start + 40, text.length);
		const selection = window.getSelection();
		if (!selection) {
			throw new Error("Selection API unavailable.");
		}
		const range = document.createRange();
		range.setStart(textNode, start);
		range.setEnd(textNode, end);
		selection.removeAllRanges();
		selection.addRange(range);
		document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
	});
}

test.describe("section player demo tts-ssml", () => {
	test("covers all four TTS layout modes end-to-end", async ({ page }) => {
		await suppressAudibleBrowserTts(page);
		await gotoDemo(page);
		await openSessionPanel(page);
		await forceBrowserTtsRuntime(page);

		const modes: Array<{
			mode: "reserved-row" | "expanding-row" | "floating-overlay" | "left-aligned";
			expectReserveBeforePlay: boolean;
			expectActiveExpandOnPlay: boolean;
			expectPanelPositionOnPlay: "absolute" | "static";
			expectContainerDirectionOnPlay?: "row";
			expectPanelBeforeTriggerOnPlay?: boolean;
			expectPanelLeftOfTriggerOnPlay?: boolean;
		}> = [
			{
				mode: "reserved-row",
				expectReserveBeforePlay: true,
				expectActiveExpandOnPlay: false,
				expectPanelPositionOnPlay: "absolute",
			},
			{
				mode: "expanding-row",
				expectReserveBeforePlay: false,
				expectActiveExpandOnPlay: true,
				expectPanelPositionOnPlay: "absolute",
			},
			{
				mode: "floating-overlay",
				expectReserveBeforePlay: false,
				expectActiveExpandOnPlay: false,
				expectPanelPositionOnPlay: "absolute",
			},
			{
				mode: "left-aligned",
				expectReserveBeforePlay: false,
				expectActiveExpandOnPlay: false,
				expectPanelPositionOnPlay: "static",
				expectContainerDirectionOnPlay: "row",
				expectPanelBeforeTriggerOnPlay: true,
				expectPanelLeftOfTriggerOnPlay: true,
			},
		];

		const readItemToolbarSnapshot = async () =>
			page.evaluate(() => {
				const collectPieItemToolbars = (): HTMLElement[] => {
					const collected: HTMLElement[] = [];
					const visitNode = (root: ParentNode) => {
						const localToolbars = Array.from(
							root.querySelectorAll("pie-item-toolbar"),
						) as HTMLElement[];
						collected.push(...localToolbars);
						const allElements = Array.from(root.querySelectorAll("*")) as HTMLElement[];
						for (const element of allElements) {
							if (element.shadowRoot) visitNode(element.shadowRoot);
						}
					};
					visitNode(document);
					return collected;
				};
				const itemToolbar = collectPieItemToolbars().find((toolbar) => {
					const level =
						toolbar.shadowRoot
							?.querySelector(".item-toolbar")
							?.getAttribute("data-level") || null;
					return level === "item";
				});
				if (!itemToolbar) {
					return {
						found: false,
						reserveClass: false,
						activeClass: false,
						panelPosition: null as string | null,
						containerDirection: null as string | null,
					};
				}
				const root = itemToolbar.shadowRoot;
				const controlsRow = root?.querySelector(
					".item-toolbar__controls-row",
				) as HTMLElement | null;
				const ttsInline = root?.querySelector(
					"pie-tool-tts-inline",
				) as HTMLElement | null;
				const ttsInlineRoot = ttsInline?.shadowRoot;
				const panel = ttsInlineRoot?.querySelector(
					".pie-tool-tts-inline__panel",
				) as HTMLElement | null;
				const container = ttsInlineRoot?.querySelector(
					".pie-tool-tts-inline",
				) as HTMLElement | null;
				return {
					found: true,
					reserveClass:
						controlsRow?.classList.contains("item-toolbar__controls-row--reserve") ===
						true,
					activeClass:
						controlsRow?.classList.contains("item-toolbar__controls-row--active") ===
						true,
					panelPosition: panel ? window.getComputedStyle(panel).position : null,
					containerDirection: container
						? window.getComputedStyle(container).flexDirection
						: null,
					panelBeforeTrigger:
						(() => {
							if (!panel || !container) return null;
							const trigger = container.querySelector(
								".pie-tool-tts-inline__trigger",
							) as HTMLElement | null;
							if (!trigger) return null;
							return Boolean(
								panel.compareDocumentPosition(trigger) &
									Node.DOCUMENT_POSITION_FOLLOWING,
							);
						})(),
					panelLeftOfTrigger: (() => {
						if (!panel || !container) return null;
						const trigger = container.querySelector(
							".pie-tool-tts-inline__trigger",
						) as HTMLElement | null;
						if (!trigger) return null;
						return panel.getBoundingClientRect().left < trigger.getBoundingClientRect().left;
					})(),
				};
			});

		const firstInlineTts = page
			.locator('pie-item-shell[data-pie-shell-root="item"] pie-tool-tts-inline:visible')
			.first();
		await expect(firstInlineTts).toBeVisible();

		for (const layout of modes) {
			await page.getByRole("button", { name: "Toggle TTS settings panel" }).click();
			const ttsDialog = page.locator(".pie-tts-dialog");
			await expect(ttsDialog.getByRole("heading", { name: "TTS settings" })).toBeVisible();
			await ttsDialog.locator("#tts-layout-mode").selectOption(layout.mode);
			await ttsDialog.getByRole("button", { name: "Apply" }).click();
			await expect(ttsDialog).toHaveCount(0);

			await expect
				.poll(async () => {
					return await page
						.locator("pie-section-player-tools-session-debugger")
						.evaluate((element) => {
							const coordinator = (element as any).toolkitCoordinator;
							return coordinator?.getToolConfig?.("textToSpeech")?.layoutMode || null;
						});
				})
				.toBe(layout.mode);

			const beforePlay = await readItemToolbarSnapshot();
			expect(beforePlay.found).toBe(true);
			expect(beforePlay.reserveClass).toBe(layout.expectReserveBeforePlay);
			expect(beforePlay.activeClass).toBe(false);

			await firstInlineTts.getByRole("button", { name: "Play reading" }).click();
			const panel = firstInlineTts.locator('[role="toolbar"][aria-label="Reading controls"]');
			await expect(panel).toBeVisible();

			const whilePlaying = await readItemToolbarSnapshot();
			expect(whilePlaying.panelPosition).toBe(layout.expectPanelPositionOnPlay);
			expect(whilePlaying.activeClass).toBe(layout.expectActiveExpandOnPlay);
			if (layout.expectPanelBeforeTriggerOnPlay !== undefined) {
				expect(whilePlaying.panelBeforeTrigger).toBe(layout.expectPanelBeforeTriggerOnPlay);
			}
			if (layout.expectPanelLeftOfTriggerOnPlay !== undefined) {
				expect(whilePlaying.panelLeftOfTrigger).toBe(layout.expectPanelLeftOfTriggerOnPlay);
			}
			if (layout.expectContainerDirectionOnPlay) {
				expect(whilePlaying.containerDirection).toBe(layout.expectContainerDirectionOnPlay);
			}
			const triggerA11y = await firstInlineTts.evaluate((host) => {
				const root = host.shadowRoot;
				const trigger = root?.querySelector(
					".pie-tool-tts-inline__trigger",
				) as HTMLButtonElement | null;
				const panelEl = root?.querySelector(
					".pie-tool-tts-inline__panel",
				) as HTMLElement | null;
				return {
					expanded: trigger?.getAttribute("aria-expanded") || null,
					controlsId: trigger?.getAttribute("aria-controls") || null,
					panelId: panelEl?.id || null,
				};
			});
			expect(triggerA11y.expanded).toBe("true");
			expect(triggerA11y.controlsId).toBeTruthy();
			expect(triggerA11y.controlsId).toBe(triggerA11y.panelId);

			const rewindButton = panel.getByRole("button", { name: "Rewind" });
			await rewindButton.focus();
			await page.keyboard.press("ArrowRight");
			await expect(panel.getByRole("button", { name: "Fast-forward" })).toBeFocused();

			await panel.getByRole("button", { name: "Stop reading" }).click();
			await expect(panel).toHaveCount(0);
			const postStopExpanded = await firstInlineTts.evaluate((host) => {
				const trigger = host.shadowRoot?.querySelector(
					".pie-tool-tts-inline__trigger",
				) as HTMLButtonElement | null;
				return trigger?.getAttribute("aria-expanded") || null;
			});
			expect(postStopExpanded).toBe("false");
		}
	});

	test("removes header controls-row reservation when layout mode is expanding-row", async ({
		page,
	}) => {
		await gotoDemo(page);
		await openSessionPanel(page);

		const ttsSettingsToggle = page.getByRole("button", {
			name: "Toggle TTS settings panel",
		});
		await ttsSettingsToggle.click();
		const ttsDialog = page.locator(".pie-tts-dialog");
		await expect(ttsDialog.getByRole("heading", { name: "TTS settings" })).toBeVisible();

		const layoutModeSelect = ttsDialog.locator("#tts-layout-mode");
		await expect(layoutModeSelect).toBeVisible();
		await layoutModeSelect.selectOption("expanding-row");
		await expect(ttsDialog.getByText("Item header row reservation: Disabled")).toBeVisible();
		await ttsDialog.getByRole("button", { name: "Apply" }).click();
		await expect(ttsDialog).toHaveCount(0);

		const reservationState = await page.evaluate(() => {
			const collectPieItemToolbars = (): HTMLElement[] => {
				const collected: HTMLElement[] = [];
				const visitNode = (root: ParentNode) => {
					const localToolbars = Array.from(
						root.querySelectorAll("pie-item-toolbar"),
					) as HTMLElement[];
					collected.push(...localToolbars);
					const allElements = Array.from(root.querySelectorAll("*")) as HTMLElement[];
					for (const element of allElements) {
						if (element.shadowRoot) {
							visitNode(element.shadowRoot);
						}
					}
				};
				visitNode(document);
				return collected;
			};
			const toolbars = collectPieItemToolbars();
			const resolveLevel = (toolbar: HTMLElement): string | null =>
				toolbar.shadowRoot
					?.querySelector(".item-toolbar")
					?.getAttribute("data-level") || null;
			const itemToolbars = toolbars.filter((toolbar) => resolveLevel(toolbar) === "item");
			const passageToolbars = toolbars.filter(
				(toolbar) => resolveLevel(toolbar) === "passage",
			);
			const hasReservedControlsRow = (toolbar: HTMLElement): boolean => {
				const controlsRow = toolbar.shadowRoot?.querySelector(".item-toolbar__controls-row");
				return controlsRow?.classList.contains("item-toolbar__controls-row--reserve") === true;
			};
			return {
				itemToolbarCount: itemToolbars.length,
				passageToolbarCount: passageToolbars.length,
				itemReservedFlags: itemToolbars.map(hasReservedControlsRow),
				passageReservedFlags: passageToolbars.map(hasReservedControlsRow),
			};
		});

		expect(reservationState.itemToolbarCount).toBeGreaterThan(0);
		expect(reservationState.passageToolbarCount).toBeGreaterThan(0);
		expect(reservationState.itemReservedFlags.every((flag) => flag === false)).toBe(true);
		expect(reservationState.passageReservedFlags.every((flag) => flag === false)).toBe(
			true,
		);
	});

	test("covers passage, interactions, mode switching, and tools", async ({ page }) => {
		test.setTimeout(180_000);
		await suppressAudibleBrowserTts(page);

		await gotoDemo(page);

		const passageRegion = page.getByRole("complementary", { name: "Passages" });
		const itemsRegion = page.getByRole("main", { name: "Items" });
		const itemShells = page.locator('pie-item-shell[data-pie-shell-root="item"]');
		const q1 = itemShells.nth(0);
		const q2 = itemShells.nth(1);
		const q3 = itemShells.nth(2);

		// Passage is rendered and visible.
		await expect(passageRegion).toBeVisible();
		// Heading semantics can arrive a tick later than text content during hydration;
		// assert on visible title text to avoid role-timing flakes.
		await expect(
			passageRegion.getByText("Understanding Quadratic Equations").first(),
		).toBeVisible({ timeout: 15_000 });
		await expect(passageRegion.getByText("ax² + bx + c = 0")).toBeVisible();
		await expect(passageRegion.getByText("x = (-b ± √(b² - 4ac)) / 2a")).toBeVisible();

		// Three questions are rendered.
		await expect(itemsRegion).toBeVisible();
		await expect(itemShells).toHaveCount(3);

		// Session panel shows and updates dynamically.
		const sessionPanel = await openSessionPanel(page);

		// Q1 mouse interaction (intentionally incorrect choice for scorer visibility checks).
		await q1
			.getByRole("radio", {
				name: /^A\.\s+The quadratic formula, because it works for all equations/i,
			})
			.click();

		// Q2 keyboard interaction.
		// Use role-only targeting here because math/markup rendering can subtly
		// change accessible label text timing and whitespace across runs.
		await q2.scrollIntoViewIfNeeded();
		const q2Radios = q2.getByRole("radio");
		await expect(q2Radios).toHaveCount(4);
		const q2FirstRadio = q2Radios.first();
		await expect(q2FirstRadio).toBeVisible({ timeout: 10_000 });
		await q2FirstRadio.focus();
		await page.keyboard.press("ArrowDown");
		await page.keyboard.press("Space");

		// Q3 text interaction.
		const q3TextInput = q3.getByRole("textbox", { name: "Answer" });
		await expect(q3TextInput).toBeVisible();
		await q3TextInput.fill(
			"Factoring, completing the square, and the quadratic formula can solve quadratic equations.",
		);
		await expect(q3TextInput).toContainText(/quadratic formula/i);
		await q3.getByRole("button", { name: "Done", exact: true }).click();

		// Session panel reflects interactions.
		const snapshotCandidate = await readSessionSnapshot(sessionPanel);
		expect(Object.keys(snapshotCandidate.itemSessions || {}).length).toBeGreaterThanOrEqual(2);

		// Keep core interaction checks independent from external provider credentials.
		await forceBrowserTtsRuntime(page);

		// TTS controls exist for passage and items (toolbar button or inline controls bar).
		const passageInlineTts = passageRegion.locator("pie-tool-tts-inline:visible");
		const itemInlineTts = q1.locator("pie-tool-tts-inline:visible");
		const hasInlineTts = (await passageInlineTts.count()) > 0;
		if (hasInlineTts) {
			await expect(passageInlineTts.first()).toBeVisible();
			await expect(itemInlineTts.first()).toBeVisible();
			const itemCalculatorButton = q1.getByRole("button", {
				name: /open .* calculator/i,
			});
			await expect(itemCalculatorButton).toBeVisible();
			const itemPromptAnchor = q1.getByRole("radio").first();
			await expect(itemPromptAnchor).toBeVisible();
			const calcTopBefore = await itemCalculatorButton.evaluate((element) =>
				element.getBoundingClientRect().top,
			);
			const promptTopBefore = await itemPromptAnchor.evaluate((element) =>
				element.getBoundingClientRect().top,
			);

			// Inline bar flow: play shows controls, pause/resume keeps controls, stop hides controls.
			const passageTrigger = passageInlineTts.getByRole("button", { name: "Play reading" }).first();
			await passageTrigger.click();
			const passagePanel = passageInlineTts.locator(
				'[role="toolbar"][aria-label="Reading controls"]',
			);
			await expect(passagePanel).toBeVisible();
			const passageSpeedSlow = passagePanel.getByRole("button", { name: "Speed 0.8x" });
			const passageSpeedFast = passagePanel.getByRole("button", { name: "Speed 1.25x" });
			await expect(passageSpeedSlow).toHaveAttribute("aria-pressed", "false");
			await expect(passageSpeedFast).toHaveAttribute("aria-pressed", "false");
			await passageSpeedSlow.evaluate((element) => (element as HTMLButtonElement).click());
			await expect(passageSpeedSlow).toHaveAttribute("aria-pressed", "true");
			await expect(passageSpeedFast).toHaveAttribute("aria-pressed", "false");
			const calcTopWhileVisible = await itemCalculatorButton.evaluate((element) =>
				element.getBoundingClientRect().top,
			);
			const promptTopWhileVisible = await itemPromptAnchor.evaluate((element) =>
				element.getBoundingClientRect().top,
			);
			expect(Math.abs(calcTopWhileVisible - calcTopBefore)).toBeLessThanOrEqual(2);
			expect(Math.abs(promptTopWhileVisible - promptTopBefore)).toBeLessThanOrEqual(2);
			await passageSpeedFast.evaluate((element) => (element as HTMLButtonElement).click());
			await expect(passageSpeedSlow).toHaveAttribute("aria-pressed", "false");
			await expect(passageSpeedFast).toHaveAttribute("aria-pressed", "true");
			await passageSpeedFast.evaluate((element) => (element as HTMLButtonElement).click());
			await expect(passageSpeedSlow).toHaveAttribute("aria-pressed", "false");
			await expect(passageSpeedFast).toHaveAttribute("aria-pressed", "false");
			await page.waitForTimeout(TTS_PREVIEW_MS);
			await expect(passagePanel).toBeVisible();
			await passagePanel.getByRole("button", { name: "Stop reading" }).click();
			await expect(passagePanel).toHaveCount(0);
			const calcTopAfterStop = await itemCalculatorButton.evaluate((element) =>
				element.getBoundingClientRect().top,
			);
			const promptTopAfterStop = await itemPromptAnchor.evaluate((element) =>
				element.getBoundingClientRect().top,
			);
			expect(Math.abs(calcTopAfterStop - calcTopBefore)).toBeLessThanOrEqual(2);
			expect(Math.abs(promptTopAfterStop - promptTopBefore)).toBeLessThanOrEqual(2);

			// Cross-instance inline flow: switching to another TTS trigger should close the current one first.
			const itemTrigger = itemInlineTts.getByRole("button", { name: "Play reading" }).first();
			const itemPanel = itemInlineTts.locator('[role="toolbar"][aria-label="Reading controls"]');
			await passageTrigger.click();
			await expect(passagePanel).toBeVisible();
			await page.waitForTimeout(TTS_PREVIEW_MS);
			await itemTrigger.click();
			await expect(itemPanel).toBeVisible({ timeout: 15_000 });
			await expect(passagePanel).toHaveCount(0);

			// Paused-owner handoff: paused session should also be closed before switching.
			await page.waitForTimeout(TTS_PREVIEW_MS);
			const itemPauseButton = itemInlineTts.getByRole("button", { name: "Pause reading" });
			const itemResumeButton = itemInlineTts.getByRole("button", { name: "Resume reading" });
			const hasPauseOrResumeControl = await itemInlineTts
				.getByRole("button", { name: /Pause reading|Resume reading/ })
				.isVisible({ timeout: 5_000 })
				.catch(() => false);
			if (hasPauseOrResumeControl) {
				if (await itemPauseButton.isVisible()) {
					await itemPauseButton.click();
					await passageTrigger.click();
					await expect(passagePanel).toBeVisible({ timeout: 15_000 });
					await expect(itemPanel).toHaveCount(0);
				} else if (await itemResumeButton.isVisible()) {
					await passageTrigger.click();
					await expect(passagePanel).toBeVisible({ timeout: 15_000 });
					await expect(itemPanel).toHaveCount(0);
				}
				const passagePauseOrResume = passageInlineTts.getByRole("button", {
					name: /Pause reading|Resume reading/,
				});
				await expect(passagePauseOrResume).toBeVisible({ timeout: 15_000 });
			}
			await passagePanel.getByRole("button", { name: "Stop reading" }).click();
			await expect(passagePanel).toHaveCount(0);

			// Keyboard operability inside inline controls bar.
			await passageTrigger.click();
			await expect(passagePanel).toBeVisible();
			const pauseOrResume = passagePanel.getByRole("button", {
				name: "Rewind",
			});
			await expect(pauseOrResume).toBeVisible({ timeout: 15_000 });
			await pauseOrResume.focus();
			await page.keyboard.press("ArrowDown");
			await expect(passagePanel.getByRole("button", { name: "Fast-forward" })).toBeFocused();
			await page.keyboard.press("ArrowDown");
			await expect(passagePanel.getByRole("button", { name: "Stop reading" })).toBeFocused();
			await passagePanel.getByRole("button", { name: "Stop reading" }).click();
			await expect(passagePanel).toHaveCount(0);
		} else {
			const passageTtsButton = passageRegion
				.getByRole("button", { name: "Read aloud" })
				.first();
			await expect(passageTtsButton).toBeVisible();
			const itemTtsButton = q1.getByRole("button", { name: "Read aloud" });
			await expect(itemTtsButton).toBeVisible();
			await passageTtsButton.click();
			const ttsStopButton = passageRegion.getByRole("button", { name: "Stop reading" });
			await expect(ttsStopButton).toBeVisible({ timeout: 15_000 });
			await ttsStopButton.click();
			await itemTtsButton.click();
			const itemTtsStopButton = q1.getByRole("button", { name: "Stop reading" });
			await expect(itemTtsStopButton).toBeVisible({ timeout: 15_000 });
			await itemTtsStopButton.click();
		}

		// TTS settings updates should apply to the active browser-backed runtime config.
		const ttsSettingsToggle = page.getByRole("button", {
			name: "Toggle TTS settings panel",
		});
		await ttsSettingsToggle.click();
		const ttsDialog = page.locator(".pie-tts-dialog");
		await expect(ttsDialog.getByRole("heading", { name: "TTS settings" })).toBeVisible();
		await ttsDialog.getByRole("button", { name: "Close TTS settings" }).focus();

		// Focus remains trapped within dialog while open.
		for (let i = 0; i < 4; i += 1) {
			await page.keyboard.press("Tab");
			await expect
				.poll(async () => {
					return await page.evaluate(() => {
						const dialog = document.querySelector(".pie-tts-dialog");
						const active = document.activeElement;
						return Boolean(dialog && active && dialog.contains(active));
					});
				})
				.toBe(true);
		}

		// Endpoint defaults + normalization path for server-backed tabs.
		await ttsDialog.getByRole("button", { name: "Polly" }).click();
		const pollyEndpointInput = ttsDialog.locator("#tts-polly-endpoint");
		await expect(pollyEndpointInput).toHaveValue("/api/tts");
		await pollyEndpointInput.evaluate((node) => {
			const input = node as HTMLInputElement;
			input.value = "/api/tts/synthesize";
			input.dispatchEvent(new Event("input", { bubbles: true }));
			input.dispatchEvent(new Event("change", { bubbles: true }));
		});
		const pollyCheckNormalizedResponse = page.waitForResponse(
			(response) =>
				response.url().includes("/polly/voices") &&
				response.request().method() === "GET",
		);
		await ttsDialog.getByRole("button", { name: "Recheck" }).click();
		await pollyCheckNormalizedResponse;
		await pollyEndpointInput.evaluate((node) => {
			const input = node as HTMLInputElement;
			input.value = "";
			input.dispatchEvent(new Event("input", { bubbles: true }));
			input.dispatchEvent(new Event("change", { bubbles: true }));
		});
		const pollyCheckFallbackResponse = page.waitForResponse(
			(response) =>
				response.url().includes("/polly/voices") &&
				response.request().method() === "GET",
		);
		await ttsDialog.getByRole("button", { name: "Recheck" }).click();
		await pollyCheckFallbackResponse;
		await expect(ttsDialog.locator("#tts-polly-rate")).toHaveCount(0);

		await ttsDialog.getByRole("button", { name: "Google" }).click();
		await expect(ttsDialog.locator("#tts-google-endpoint")).toHaveValue("/api/tts");
		await expect(ttsDialog.locator("#tts-google-rate")).toHaveCount(0);

		await ttsDialog.getByRole("button", { name: "Browser" }).click();
		await expect(ttsDialog.locator("#tts-browser-rate")).toHaveCount(0);
		await expect(ttsDialog.locator("#tts-browser-pitch")).toHaveCount(0);
		const layoutModeSelect = ttsDialog.locator("#tts-layout-mode");
		await expect(layoutModeSelect).toBeVisible();
		await layoutModeSelect.selectOption("floating-overlay");
		await expect(ttsDialog.getByText("Item header row reservation: Disabled")).toBeVisible();
		await ttsDialog.getByRole("button", { name: "Apply" }).click();
		await expect(ttsDialog).toHaveCount(0);

		const ttsRuntimeSnapshot = await page
			.locator("pie-section-player-tools-session-debugger")
			.evaluate((element) => {
				const coordinator = (element as any).toolkitCoordinator;
				const toolConfig = coordinator?.getToolConfig?.("textToSpeech") || null;
				const serviceConfig = (coordinator?.ttsService as any)?.ttsConfig || null;
				return { toolConfig, serviceConfig };
			});
		expect(ttsRuntimeSnapshot.toolConfig?.backend).toBe("browser");
		expect(ttsRuntimeSnapshot.toolConfig?.layoutMode).toBe("floating-overlay");
		expect(ttsRuntimeSnapshot.toolConfig).toBeTruthy();
		expect(ttsRuntimeSnapshot.serviceConfig).toBeTruthy();

		// Calculator is available in items, not in passage.
		await expect(passageRegion.getByRole("button", { name: /calculator/i })).toHaveCount(0);
		const itemCalculatorButton = q1.getByRole("button", { name: /open .* calculator/i });
		await expect(itemCalculatorButton).toBeVisible();

		// Calculator opens and renders a real Desmos surface (not just a shell/loading state).
		const desmosAuthResponse = page.waitForResponse(
			(response) =>
				response.url().includes("/api/tools/desmos/auth") &&
				response.request().method() === "GET",
		);
		await itemCalculatorButton.click();
		await desmosAuthResponse;
		const calculatorHost = page.locator("pie-tool-calculator .pie-tool-calculator").last();
		await expect(calculatorHost).toBeVisible({ timeout: 20_000 });
		const calculatorSurface = calculatorHost.locator(
			[
				".pie-tool-calculator__container .dcg-container",
				".pie-tool-calculator__container .dcg-calculator-api-container",
				".pie-tool-calculator__container iframe",
				".pie-tool-calculator__container canvas",
			].join(","),
		);
		await expect(calculatorSurface.first()).toBeVisible({ timeout: 20_000 });
		await expect(calculatorHost.getByText(/failed to initialize/i)).toHaveCount(0);
		await expect(calculatorHost.locator(".pie-tool-calculator__loading")).toHaveCount(0);
		const calculatorShell = page.locator('[data-pie-tool-shell="calculator"]').first();
		const calculatorCloseButton = calculatorShell.getByRole("button", { name: "Close tool" });
		if (await calculatorCloseButton.isVisible()) {
			await calculatorCloseButton.click();
			await expect(calculatorShell).not.toBeVisible();
		}

		// Answer eliminator is item-level and should render elimination controls when toggled on.
		const answerEliminatorButton = q1.getByRole("button", {
			name: /answer eliminator|strike through choices/i,
		});
		await expect(answerEliminatorButton).toBeVisible();
		await answerEliminatorButton.click();
		await expect(answerEliminatorButton).toHaveAttribute("aria-pressed", "true");
		await expect(
			q1.getByRole("button", { name: /toggle elimination for/i }).first(),
		).toBeVisible();

		// Annotation toolbar should be enabled in demo placement and appear on text selection.
		await expect(page.locator("pie-tool-annotation-toolbar")).toHaveCount(1);
		const annotationToolbar = page.locator(
			"pie-tool-annotation-toolbar [role='toolbar'][aria-label='Text annotation toolbar']",
		);
		await expect(annotationToolbar).toHaveCount(0);
		await selectPassageText(page);
		await expect(annotationToolbar).toBeVisible({ timeout: 10_000 });
		await expect(
			annotationToolbar.getByRole("button", { name: "Yellow highlight" }),
		).toBeVisible();

		// Switch to scorer mode and confirm evaluate-mode rendering path.
		await page.getByRole("link", { name: "Scorer" }).click();
		await expect(page).toHaveURL(/mode=scorer/);
		await expect(itemShells).toHaveCount(3);

		// In scorer mode, answers are review-only and include the expected canonical correct option.
		await expect(
			q1.getByRole("radio", {
				name: /^B\.\s+Factoring, because this equation factors easily/i,
			}),
		).toBeVisible();
		await expect(
			q1.locator('input[type="radio"]').first(),
		).toBeDisabled();
		await expect(
			q1.getByRole("radio", {
				name: /^A\.\s+The quadratic formula, because it works for all equations/i,
			}),
		).toHaveAttribute("checked", "");
		const snapshotScorer = await readSessionSnapshot(await openSessionPanel(page));
		expect(Object.keys(snapshotScorer.itemSessions || {})).toEqual(
			expect.arrayContaining(Object.keys(snapshotCandidate.itemSessions || {})),
		);

		// Switch back to student mode and verify session state is carried.
		await page.getByRole("link", { name: "Student" }).click();
		await expect(page).toHaveURL(/mode=candidate/);
		await expect(itemShells).toHaveCount(3);
		await expect(
			q1.getByRole("radio", {
				name: /^A\.\s+The quadratic formula, because it works for all equations/i,
			}),
		).toHaveAttribute("checked", "");
		await expect(
			q1.getByRole("radio", {
				name: /^A\.\s+The quadratic formula, because it works for all equations/i,
			}),
		).toBeVisible();

		// Baseline keyboard operability and focus visibility.
		await page.keyboard.press("Tab");
		await expect(page.locator(":focus")).toBeVisible();
		await page.keyboard.press("Tab");
		await page.keyboard.press("Enter");
	});

	test("applies Polly backend and routes playback through server synthesis", async ({
		page,
	}) => {
		await gotoDemo(page);
		await openSessionPanel(page);

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

		await page.route("**/synthesize", async (route) => {
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
						charCount: 12,
						cached: false,
					},
				}),
			});
		});

		const ttsSettingsToggle = page.getByRole("button", {
			name: "Toggle TTS settings panel",
		});
		await ttsSettingsToggle.click();
		const ttsDialog = page.locator(".pie-tts-dialog");
		await expect(ttsDialog.getByRole("heading", { name: "TTS settings" })).toBeVisible();
		await ttsDialog.getByRole("button", { name: "Polly" }).click();
		await ttsDialog.getByRole("button", { name: "Recheck" }).click();
		await expect(
			ttsDialog.getByText(/AWS Polly available/i),
		).toBeVisible({ timeout: 10_000 });
		await ttsDialog.getByRole("button", { name: "Apply" }).click();
		await expect(ttsDialog).toHaveCount(0);

		const providerSnapshot = await page
			.locator("pie-section-player-tools-session-debugger")
			.evaluate((element) => {
				const coordinator = (element as any).toolkitCoordinator;
				return {
					backend: coordinator?.getToolConfig?.("textToSpeech")?.backend || null,
					providerId: coordinator?.ttsService?.currentProvider?.providerId || null,
				};
			});
		expect(providerSnapshot.backend).toBe("polly");
		expect(providerSnapshot.providerId).toBe("server-tts");

		const passageInlineTts = page
			.getByRole("complementary", { name: "Passages" })
			.locator("pie-tool-tts-inline:visible")
			.first();
		await expect(passageInlineTts).toBeVisible();
		const synthRequest = page.waitForRequest(
			(request) =>
				request.url().includes("/synthesize") &&
				request.method() === "POST",
		);
		await passageInlineTts.getByRole("button", { name: "Play reading" }).click();
		const passagePanel = passageInlineTts.locator(
			'[role="toolbar"][aria-label="Reading controls"]',
		);
		await expect(passagePanel).toBeVisible();
		await synthRequest;
		await page.waitForTimeout(TTS_PREVIEW_MS);
		const stopButton = passagePanel.getByRole("button", { name: "Stop reading" });
		if (await stopButton.isEnabled()) {
			await stopButton.click();
			await expect(passagePanel).toHaveCount(0);
		}
	});

	test("applies ordered inline speed options and supports no speed buttons", async ({
		page,
	}) => {
		await suppressAudibleBrowserTts(page);
		await gotoDemo(page);
		await openSessionPanel(page);
		await forceBrowserTtsRuntime(page);

		const passageInlineTts = page
			.getByRole("complementary", { name: "Passages" })
			.locator("pie-tool-tts-inline:visible")
			.first();
		await expect(passageInlineTts).toBeVisible();

		await page.locator("pie-section-player-tools-session-debugger").evaluate(async (element) => {
			const coordinator = (element as any).toolkitCoordinator;
			if (!coordinator?.updateToolConfig) return;
			coordinator.updateToolConfig("textToSpeech", {
				enabled: true,
				backend: "browser",
				speedOptions: [2, 1.25, 1.5, 2, 1],
			});
			await coordinator?.ensureTTSReady?.(
				coordinator?.getToolConfig?.("textToSpeech"),
			);
		});
		await passageInlineTts.getByRole("button", { name: "Play reading" }).click();
		const passagePanel = passageInlineTts.locator(
			'[role="toolbar"][aria-label="Reading controls"]',
		);
		await expect(passagePanel).toBeVisible();
		const speedButtons = passagePanel.locator(".pie-tool-tts-inline__control--speed");
		await expect(speedButtons).toHaveCount(3);
		await expect(speedButtons.nth(0)).toContainText("2x");
		await expect(speedButtons.nth(1)).toContainText("1.25x");
		await expect(speedButtons.nth(2)).toContainText("1.5x");
		await passagePanel.getByRole("button", { name: "Stop reading" }).click();
		await expect(passagePanel).toHaveCount(0);

		await page.locator("pie-section-player-tools-session-debugger").evaluate(async (element) => {
			const coordinator = (element as any).toolkitCoordinator;
			if (!coordinator?.updateToolConfig) return;
			coordinator.updateToolConfig("textToSpeech", {
				enabled: true,
				backend: "browser",
				speedOptions: [],
			});
			await coordinator?.ensureTTSReady?.(
				coordinator?.getToolConfig?.("textToSpeech"),
			);
		});
		await passageInlineTts.getByRole("button", { name: "Play reading" }).click();
		await expect(passagePanel).toBeVisible();
		await expect(passagePanel.locator(".pie-tool-tts-inline__control--speed")).toHaveCount(0);
		await expect(passagePanel.getByRole("button", { name: "Rewind" })).toBeVisible();
		await expect(passagePanel.getByRole("button", { name: "Fast-forward" })).toBeVisible();
		await expect(passagePanel.getByRole("button", { name: "Stop reading" })).toBeVisible();
		await passagePanel.getByRole("button", { name: "Stop reading" }).click();
		await expect(passagePanel).toHaveCount(0);
	});

	test("clears preview word highlight after browser preview ends", async ({ page }) => {
		await page.addInitScript(() => {
			const synth: SpeechSynthesis = {
				...window.speechSynthesis,
				getVoices: () =>
					[
						{
							name: "Preview Voice",
							lang: "en-US",
							default: true,
							localService: true,
							voiceURI: "preview-voice",
						},
					] as unknown as SpeechSynthesisVoice[],
				speak: (utterance: SpeechSynthesisUtterance) => {
					window.setTimeout(() => {
						const boundary = { name: "word", charIndex: 0 } as Event;
						utterance.onboundary?.(boundary as SpeechSynthesisEvent);
					}, 80);
					window.setTimeout(() => {
						const endEvent = new Event("end");
						utterance.onend?.(endEvent as SpeechSynthesisEvent);
					}, 220);
				},
				cancel: () => {},
			};
			Object.defineProperty(window, "speechSynthesis", {
				configurable: true,
				value: synth,
			});
		});

		await gotoDemo(page);
		await page.getByRole("button", { name: "Toggle TTS settings panel" }).click();
		const ttsDialog = page.locator(".pie-tts-dialog");
		await expect(ttsDialog.getByRole("heading", { name: "TTS settings" })).toBeVisible();
		await ttsDialog.getByRole("button", { name: "Browser" }).click();
		await ttsDialog.locator("#tts-preview-text").fill("Preview highlight should clear");

		const previewTrack = ttsDialog.locator(".pie-tts-preview-track");
		await ttsDialog.getByRole("button", { name: "Preview voice" }).click();
		await expect(previewTrack.locator(".pie-tts-preview-active")).toHaveCount(1);
		await expect(ttsDialog.getByRole("button", { name: "Preview voice" })).toBeVisible();
		await expect(previewTrack.locator(".pie-tts-preview-active")).toHaveCount(0);
	});

	test("keeps baseline a11y regressions in check", async ({ page }) => {
		await gotoDemo(page);

		// Baseline automated a11y scan (fail on serious / critical issues).
		const axeResults = await new AxeBuilder({ page })
			.disableRules(["region"])
			.analyze();
		const seriousOrCritical = axeResults.violations.filter((violation) =>
			["serious", "critical"].includes(violation.impact || ""),
		);
		const unexpectedSeriousOrCritical = seriousOrCritical.filter(
			(violation) => !KNOWN_A11Y_BASELINE_DEBT.has(violation.id),
		);
		expect(
			unexpectedSeriousOrCritical,
			`Unexpected axe serious/critical violations: ${JSON.stringify(
				unexpectedSeriousOrCritical,
				null,
				2,
			)}\nKnown route-specific issues (baseline allowlist): ${JSON.stringify(
				seriousOrCritical,
				null,
				2,
			)}`,
		).toEqual([]);
	});
});
