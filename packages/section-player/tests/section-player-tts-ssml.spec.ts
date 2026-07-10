import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const DEMO_PATH = "/tts-ssml?mode=candidate&layout=splitpane";
const KNOWN_A11Y_BASELINE_DEBT = new Set([
	"aria-allowed-attr",
	"aria-roles",
	"tabindex",
]);
// Keep playback windows short to avoid reading long passages in CI.
const TTS_PREVIEW_MS = 250;

function isKnownA11yBaselineDebt(violation: {
	id: string;
	nodes?: Array<{ html?: string }>;
}): boolean {
	if (KNOWN_A11Y_BASELINE_DEBT.has(violation.id)) {
		return true;
	}
	if (violation.id === "aria-input-field-name") {
		return (violation.nodes || []).every((node) =>
			String(node.html || "").includes("ProseMirror"),
		);
	}
	if (violation.id === "button-name") {
		return (violation.nodes || []).every((node) => {
			const html = String(node.html || "");
			return (
				html.includes('class="button"') &&
				(html.includes("MuiSvgIcon") ||
					html === '<button class="button">' ||
					html === '<button disabled="" class="button">')
			) || (
				// PIE-708 tracks the upstream editor toolbar buttons with no accessible name.
				html.startsWith('<button class="toolbarButton"') ||
				html.startsWith('<button disabled="" class="toolbarButton"')
			);
		});
	}
	return false;
}

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
					snapshot = JSON.parse(text) as {
						itemSessions?: Record<string, unknown>;
					};
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
	const updatedViaDemoHandle = await page.evaluate(async () => {
		const coordinator = (
			window as unknown as { __pieDemoToolkitCoordinator?: any }
		).__pieDemoToolkitCoordinator;
		if (!coordinator?.updateToolConfig) return false;
		coordinator.updateToolConfig("textToSpeech", {
			enabled: true,
			backend: "browser",
			transportMode: "pie",
		});
		await coordinator?.ensureTTSReady?.(
			coordinator?.getToolConfig?.("textToSpeech"),
		);
		return true;
	});
	if (updatedViaDemoHandle) return;

	await page
		.locator("pie-section-player-tools-session-debugger")
		.evaluate(async (element) => {
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

async function requestTtsControlHandoff(page: Page): Promise<boolean> {
	return await page
		.locator("pie-section-player-tools-session-debugger")
		.evaluate((element) => {
			const coordinator = (element as any).toolkitCoordinator;
			const handoff = coordinator?.ttsService?.requestControlHandoff;
			if (typeof handoff !== "function") return false;
			handoff.call(coordinator.ttsService);
			return true;
		});
}

async function suppressAudibleBrowserTts(page: Page): Promise<void> {
	await page.addInitScript(() => {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
		(
			window as unknown as {
				__pieTtsSpeaks: Array<{ text: string; rate: number }>;
			}
		).__pieTtsSpeaks = [];
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
		const dispatchSafe = (
			callback: ((event: SpeechSynthesisEvent) => void) | null | undefined,
		) => {
			if (!callback) return;
			callback(new Event("speech") as SpeechSynthesisEvent);
		};
		const fakeSynth: SpeechSynthesis = {
			...originalSynth,
			getVoices: () => originalSynth.getVoices(),
			speak: (utterance: SpeechSynthesisUtterance) => {
				clearPlayback();
				activeUtterance = utterance;
				(
					window as unknown as {
						__pieTtsSpeaks: Array<{ text: string; rate: number }>;
					}
				).__pieTtsSpeaks.push({
					text: String(utterance.text || ""),
					rate: Number(utterance.rate || 1),
				});
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

async function readBrowserTtsSpeaks(
	page: Page,
): Promise<Array<{ text: string; rate: number }>> {
	return await page.evaluate(
		() =>
			(
				window as unknown as {
					__pieTtsSpeaks?: Array<{ text: string; rate: number }>;
				}
			).__pieTtsSpeaks || [],
	);
}

async function mockPollyVoicesAvailability(page: Page): Promise<void> {
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

async function mockDesmosCalculatorScript(page: Page): Promise<void> {
	await page.route("https://www.desmos.com/api/**/calculator.js**", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/javascript",
			body: `
				(() => {
					const createCalculator = (container) => {
						const surface = document.createElement("div");
						surface.className = "dcg-container dcg-calculator-api-container";
						surface.style.width = "100%";
						surface.style.height = "100%";
						surface.style.minHeight = "220px";
						surface.tabIndex = 0;
						container.replaceChildren(surface);
						return {
							destroy() { container.replaceChildren(); },
							resize() {},
							setBlank() {},
							getState() { return {}; },
							setState() {},
							setExpression() {},
							removeExpression() {},
							HelperExpression() { return { numericValue: 0 }; },
							focusFirstExpression() { surface.focus(); }
						};
					};
					window.Desmos = {
						GraphingCalculator: createCalculator,
						ScientificCalculator: createCalculator,
						FourFunctionCalculator: createCalculator
					};
				})();
			`,
		});
	});
}

async function selectPassageText(page: Page): Promise<void> {
	await page
		.locator("pie-passage-shell [data-region='content'] p")
		.first()
		.evaluate((node) => {
			const textNode = node.firstChild;
			if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
				throw new Error(
					"Passage paragraph is missing direct text node for selection.",
				);
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
	test("uses a region-scope TTS highlight resolver from inline TTS", async ({
		page,
	}) => {
		await suppressAudibleBrowserTts(page);
		await gotoDemo(page);
		await openSessionPanel(page);
		await forceBrowserTtsRuntime(page);

		const firstItemShell = page
			.locator('pie-item-shell[data-pie-shell-root="item"]')
			.first();
		await expect(firstItemShell).toBeVisible();
		await firstItemShell.evaluate((shell) => {
			const host = shell as HTMLElement & {
				ttsHighlightTargetResolver?: {
					resolveSentenceRanges?: () => HTMLElement[];
				};
			};
			const target = document.createElement("section");
			target.setAttribute("data-pie-test-tts-resolver-target", "true");
			target.textContent = "Resolver-visible sentence target";
			host.appendChild(target);
			host.ttsHighlightTargetResolver = {
				resolveSentenceRanges: () => [target],
			};
		});

		const firstInlineTts = firstItemShell.locator("pie-tool-tts-inline:visible");
		await expect(firstInlineTts).toBeVisible();
		await firstInlineTts.getByRole("button", { name: "Play reading" }).click();

		await expect
			.poll(
				async () =>
					firstItemShell.evaluate((shell) => {
						const target = shell.querySelector(
							"[data-pie-test-tts-resolver-target]",
						);
						return target?.getAttribute("data-pie-tts-sentence-element");
					}),
				{
					timeout: 10_000,
					message:
						"expected inline TTS to paint the host resolver's visible element target",
				},
			)
			.toBe("true");

		const stopButton = firstInlineTts.getByRole("button", {
			name: "Stop reading",
		});
		if (await stopButton.isEnabled().catch(() => false)) {
			await stopButton.click();
		}
	});

	test("covers all four TTS layout modes end-to-end", async ({ page }) => {
		await suppressAudibleBrowserTts(page);
		await gotoDemo(page);
		await openSessionPanel(page);
		await forceBrowserTtsRuntime(page);

		const modes: Array<{
			mode:
				| "reserved-row"
				| "expanding-row"
				| "floating-overlay"
				| "left-aligned";
			expectReserveBeforePlay: boolean;
			expectActiveExpandOnPlay: boolean;
			expectPanelPositionOnPlay: "absolute" | "static" | "fixed";
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
				// Fixed so the panel escapes overflow-clipping ancestors and
				// stacks above the page header (top-layer z-index).
				expectPanelPositionOnPlay: "fixed",
				expectPanelBeforeTriggerOnPlay: false,
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
						const allElements = Array.from(
							root.querySelectorAll("*"),
						) as HTMLElement[];
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
						controlsRow?.classList.contains(
							"item-toolbar__controls-row--reserve",
						) === true,
					activeClass:
						controlsRow?.classList.contains(
							"item-toolbar__controls-row--active",
						) === true,
					panelPosition: panel ? window.getComputedStyle(panel).position : null,
					containerDirection: container
						? window.getComputedStyle(container).flexDirection
						: null,
					panelBeforeTrigger: (() => {
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
						return (
							panel.getBoundingClientRect().left <
							trigger.getBoundingClientRect().left
						);
					})(),
				};
			});

		const firstInlineTts = page
			.locator(
				'pie-item-shell[data-pie-shell-root="item"] pie-tool-tts-inline:visible',
			)
			.first();
		await expect(firstInlineTts).toBeVisible();

		for (const layout of modes) {
			await page
				.getByRole("button", { name: "Toggle TTS settings panel" })
				.click();
			const ttsDialog = page.locator(".pie-tts-dialog");
			await expect(
				ttsDialog.getByRole("heading", { name: "TTS settings" }),
			).toBeVisible();
			await ttsDialog.locator("#tts-layout-mode").selectOption(layout.mode);
			await ttsDialog.getByRole("button", { name: "Apply" }).click();
			await expect(ttsDialog).toHaveCount(0);

			await expect
				.poll(async () => {
					return await page
						.locator("pie-section-player-tools-session-debugger")
						.evaluate((element) => {
							const coordinator = (element as any).toolkitCoordinator;
							return (
								coordinator?.getToolConfig?.("textToSpeech")?.layoutMode || null
							);
						});
				})
				.toBe(layout.mode);

			const beforePlay = await readItemToolbarSnapshot();
			expect(beforePlay.found).toBe(true);
			expect(beforePlay.reserveClass).toBe(layout.expectReserveBeforePlay);
			expect(beforePlay.activeClass).toBe(false);

			await firstInlineTts
				.getByRole("button", { name: "Play reading" })
				.click();
			const panel = firstInlineTts.locator(
				'[role="toolbar"][aria-label="Reading controls"]',
			);
			await expect(panel).toBeVisible();

			const whilePlaying = await readItemToolbarSnapshot();
			expect(whilePlaying.panelPosition).toBe(layout.expectPanelPositionOnPlay);
			expect(whilePlaying.activeClass).toBe(layout.expectActiveExpandOnPlay);
			if (layout.expectPanelBeforeTriggerOnPlay !== undefined) {
				expect(whilePlaying.panelBeforeTrigger).toBe(
					layout.expectPanelBeforeTriggerOnPlay,
				);
			}
			if (layout.expectPanelLeftOfTriggerOnPlay !== undefined) {
				expect(whilePlaying.panelLeftOfTrigger).toBe(
					layout.expectPanelLeftOfTriggerOnPlay,
				);
			}
			if (layout.expectContainerDirectionOnPlay) {
				expect(whilePlaying.containerDirection).toBe(
					layout.expectContainerDirectionOnPlay,
				);
			}
			if (layout.mode === "expanding-row") {
				const beforeSpeedSpeaks = await readBrowserTtsSpeaks(page);
				await panel
					.getByRole("radio", { name: /^(Fast speed|Speed 1\.25x)$/ })
					.click();
				await expect
					.poll(async () => (await readBrowserTtsSpeaks(page)).length)
					.toBeGreaterThan(beforeSpeedSpeaks.length);
				const afterSpeedSpeaks = await readBrowserTtsSpeaks(page);
				expect(afterSpeedSpeaks.at(-1)?.rate).toBe(1.25);
			}
			const triggerA11y = await firstInlineTts.evaluate((host) => {
				const root = host.shadowRoot;
				// The trigger is an <nds-icon-button> host; its disclosure ARIA lives
				// on the inner focusable <button> the component renders.
				const trigger = root?.querySelector(
					".pie-tool-tts-inline__trigger button",
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
			await expect(
				panel.getByRole("button", { name: "Fast-forward" }),
			).toBeFocused();

			await panel.getByRole("button", { name: "Stop reading" }).click();
			await expect(panel).toHaveCount(0);
			const postStopExpanded = await firstInlineTts.evaluate((host) => {
				const trigger = host.shadowRoot?.querySelector(
					".pie-tool-tts-inline__trigger button",
				) as HTMLButtonElement | null;
				return trigger?.getAttribute("aria-expanded") || null;
			});
			expect(postStopExpanded).toBe("false");
		}
	});

	test("overlays left-aligned TTS controls over the header label with inline speed radios", async ({
		page,
	}) => {
		await suppressAudibleBrowserTts(page);
		await page.setViewportSize({ width: 1320, height: 900 });
		await gotoDemo(page);
		await openSessionPanel(page);
		await forceBrowserTtsRuntime(page);

		const firstInlineTts = page
			.locator(
				'pie-item-shell[data-pie-shell-root="item"] pie-tool-tts-inline:visible',
			)
			.first();
		await expect(firstInlineTts).toBeVisible();
		await firstInlineTts.getByRole("button", { name: "Play reading" }).click();

		const panel = firstInlineTts.getByRole("toolbar", {
			name: "Reading controls",
		});
		await expect(panel).toBeVisible();

		const overlayGeometry = await page.evaluate(() => {
			const toolbars = Array.from(
				document.querySelectorAll("pie-item-toolbar"),
			) as HTMLElement[];
			const toolbar = toolbars.find((candidate) =>
				Boolean(candidate.shadowRoot?.querySelector("pie-tool-tts-inline[data-active='true']")),
			) || null;
			const header = toolbar?.closest(
				".pie-section-player-content-card-header",
			) as HTMLElement | null;
			const card = header?.closest(
				".pie-section-player-content-card",
			) as HTMLElement | null;
			const heading = header?.querySelector("h2") as HTMLElement | null;
			const ttsInline = toolbar?.shadowRoot?.querySelector(
				"pie-tool-tts-inline",
			) as HTMLElement | null;
			const ttsRoot = ttsInline?.shadowRoot;
			const ttsPanel = ttsRoot?.querySelector(
				".pie-tool-tts-inline__panel",
			) as HTMLElement | null;
			const trigger = ttsRoot?.querySelector(
				".pie-tool-tts-inline__trigger",
			) as HTMLElement | null;
			if (!card || !header || !heading || !ttsPanel || !trigger) {
				return {
					found: false,
					panelPosition: null,
					panelWithinCardInlineBounds: false,
					panelLeftClearOfHeading: false,
					triggerRightAligned: false,
				};
			}
			const cardRect = card.getBoundingClientRect();
			const headingRect = heading.getBoundingClientRect();
			const panelRect = ttsPanel.getBoundingClientRect();
			const triggerRect = trigger.getBoundingClientRect();
			return {
				found: true,
				panelPosition: window.getComputedStyle(ttsPanel).position,
				panelWithinCardInlineBounds:
					panelRect.left >= cardRect.left &&
					panelRect.right <= cardRect.right,
				panelLeftClearOfHeading:
					panelRect.left >= headingRect.right,
				triggerRightAligned: triggerRect.right <= cardRect.right,
			};
		});
		expect(overlayGeometry.found).toBe(true);
		// position: fixed lets the panel escape overflow-clipping ancestors
		// and stack above the page header via a top-layer z-index.
		expect(overlayGeometry.panelPosition).toBe("fixed");
		// With a protected heading, the panel sits to the right of the
		// heading (never on top of it) and stays inside the card boundary.
		expect(overlayGeometry.panelLeftClearOfHeading).toBe(true);
		expect(overlayGeometry.panelWithinCardInlineBounds).toBe(true);
		expect(overlayGeometry.triggerRightAligned).toBe(true);

		await page.keyboard.press("Tab");
		await expect(panel.getByRole("radio", { name: "Slow speed" })).toBeFocused();

		await panel.getByRole("button", { name: "Stop reading" }).click();
		await expect(panel).toHaveCount(0);
	});

	test("collapses left-aligned speed controls into a dropdown (media stays inline) when the heading crowds the panel", async ({
		page,
	}) => {
		// The compact-mode toggle is boundary-driven: the panel collapses
		// once the space between the trigger and the protected heading would
		// no longer fit its natural width. This test forces that condition
		// at a wide viewport (well above the fallback 839px media query) by
		// stretching the heading so the remaining header space is narrow.
		await suppressAudibleBrowserTts(page);
		await page.setViewportSize({ width: 1320, height: 900 });
		await gotoDemo(page);
		await openSessionPanel(page);
		await forceBrowserTtsRuntime(page);

		const firstInlineTts = page
			.locator(
				'pie-item-shell[data-pie-shell-root="item"] pie-tool-tts-inline:visible',
			)
			.first();
		await expect(firstInlineTts).toBeVisible();

		// Inflate the protected heading so its right edge sits close to the
		// trigger. This has to happen after mount (so the h2 exists) and
		// before the play button opens the panel (measurement is captured
		// then and re-run on ResizeObserver).
		await page.evaluate(() => {
			const heading = document.querySelector(
				"pie-section-player-item-card .pie-section-player-content-card-header h2[data-pie-tool-overlay-protect]",
			) as HTMLElement | null;
			if (!heading) throw new Error("protected heading not found");
			heading.style.setProperty("min-width", "calc(100% - 4rem)");
		});

		await firstInlineTts.getByRole("button", { name: "Play reading" }).click();

		const panel = firstInlineTts.getByRole("toolbar", {
			name: "Reading controls",
		});
		await expect(panel).toBeVisible();

		// Media controls (rewind / fast-forward / stop) now STAY inline when the
		// overlay is compact — none should be hidden.
		const secondaryVisible = await firstInlineTts.evaluate((host) => {
			const root = host.shadowRoot;
			return Array.from(
				root?.querySelectorAll(".pie-tool-tts-inline__control--secondary") ||
					[],
			).filter(
				(el) => window.getComputedStyle(el as HTMLElement).display !== "none",
			).length;
		});
		expect(secondaryVisible).toBe(3);
		await expect(panel.getByRole("button", { name: "Rewind" })).toBeVisible();
		await expect(
			panel.getByRole("button", { name: "Fast-forward" }),
		).toBeVisible();
		await expect(
			panel.getByRole("button", { name: "Stop reading" }),
		).toBeVisible();

		// The speed radios collapse into a current-speed button that opens a
		// dropdown of the speed options.
		const speedButton = panel.getByRole("button", {
			name: /^Playback speed:/,
		});
		await expect(speedButton).toBeVisible();
		await speedButton.click();
		const speedMenu = firstInlineTts.getByRole("menu", {
			name: "Playback speed",
		});
		await expect(speedMenu).toBeVisible();
		await expect(
			speedMenu.getByRole("menuitemradio", { name: "Normal" }),
		).toBeVisible();

		await page.keyboard.press("Escape");
		await expect(speedMenu).toHaveCount(0);
		await expect(speedButton).toBeFocused();
	});

	test("removes header controls-row reservation when layout mode is expanding-row", async ({
		page,
	}) => {
		await gotoDemo(page);
		await openSessionPanel(page);
		await forceBrowserTtsRuntime(page);

		const ttsSettingsToggle = page.getByRole("button", {
			name: "Toggle TTS settings panel",
		});
		await ttsSettingsToggle.click();
		const ttsDialog = page.locator(".pie-tts-dialog");
		await expect(
			ttsDialog.getByRole("heading", { name: "TTS settings" }),
		).toBeVisible();

		const layoutModeSelect = ttsDialog.locator("#tts-layout-mode");
		await expect(layoutModeSelect).toBeVisible();
		await layoutModeSelect.selectOption("expanding-row");
		await expect(
			ttsDialog.getByText("Item header row reservation: Disabled"),
		).toBeVisible();
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
					const allElements = Array.from(
						root.querySelectorAll("*"),
					) as HTMLElement[];
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
			const itemToolbars = toolbars.filter(
				(toolbar) => resolveLevel(toolbar) === "item",
			);
			const passageToolbars = toolbars.filter(
				(toolbar) => resolveLevel(toolbar) === "passage",
			);
			const hasReservedControlsRow = (toolbar: HTMLElement): boolean => {
				const controlsRow = toolbar.shadowRoot?.querySelector(
					".item-toolbar__controls-row",
				);
				return (
					controlsRow?.classList.contains(
						"item-toolbar__controls-row--reserve",
					) === true
				);
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
		expect(
			reservationState.itemReservedFlags.every((flag) => flag === false),
		).toBe(true);
		expect(
			reservationState.passageReservedFlags.every((flag) => flag === false),
		).toBe(true);
	});

	test("covers passage, interactions, mode switching, and tools", async ({
		page,
	}) => {
		test.setTimeout(180_000);
		await suppressAudibleBrowserTts(page);
		await mockDesmosCalculatorScript(page);
		await mockPollyVoicesAvailability(page);

		await gotoDemo(page);

		const passageRegion = page.getByRole("complementary", { name: "Passages" });
		const itemsRegion = page.getByRole("main", { name: "Items" });
		const itemShells = page.locator(
			'pie-item-shell[data-pie-shell-root="item"]',
		);
		const q1 = itemShells.nth(0);
		const q2 = itemShells.nth(1);

		// Passage is rendered and visible.
		await expect(passageRegion).toBeVisible();
		await expect(
			passageRegion.getByText("The Quadratic Formula").first(),
		).toBeVisible({ timeout: 15_000 });
		await expect(passageRegion.locator("math").first()).toBeVisible();
		await expect(passageRegion.locator("p.formula math")).toBeVisible();

		// Two questions are rendered.
		await expect(itemsRegion).toBeVisible();
		await expect(itemShells).toHaveCount(2);

		// Session panel shows and updates dynamically.
		const sessionPanel = await openSessionPanel(page);

		// Q1 mouse interaction (intentionally incorrect choice for scorer visibility checks).
		// Use role-only targeting because math/markup rendering can subtly change
		// accessible label text timing and whitespace across runs.
		const q1Radios = q1.getByRole("radio");
		await expect(q1Radios).toHaveCount(4);
		await q1Radios.first().click();

		// Q2 text interaction.
		await q2.scrollIntoViewIfNeeded();
		const q2TextInput = q2.getByRole("textbox").first();
		await expect(q2TextInput).toBeVisible({ timeout: 10_000 });
		await q2TextInput.fill(
			"The PTA request is time-sensitive because the April deadline affects planning for the next event.",
		);
		await expect(q2TextInput).toContainText(/PTA request/i);
		await q2.getByRole("button", { name: "Done", exact: true }).click();

		// Session panel reflects interactions.
		const snapshotCandidate = await readSessionSnapshot(sessionPanel);
		expect(
			Object.keys(snapshotCandidate.itemSessions || {}).length,
		).toBeGreaterThanOrEqual(1);

		// Keep core interaction checks independent from external provider credentials.
		await forceBrowserTtsRuntime(page);

		// TTS controls exist for passage and items (toolbar button or inline controls bar).
		const passageInlineTts = passageRegion.locator(
			"pie-tool-tts-inline:visible",
		);
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
			const calcTopBefore = await itemCalculatorButton.evaluate(
				(element) => element.getBoundingClientRect().top,
			);
			const promptTopBefore = await itemPromptAnchor.evaluate(
				(element) => element.getBoundingClientRect().top,
			);

			// Inline bar flow: play shows controls, pause/resume keeps controls, stop hides controls.
			const passageTrigger = passageInlineTts
				.getByRole("button", { name: "Play reading" })
				.first();
			await passageTrigger.click();
			const passagePanel = passageInlineTts.locator(
				'[role="toolbar"][aria-label="Reading controls"]',
			);
			await expect(passagePanel).toBeVisible();
			const passageSpeedGroup = passagePanel.getByRole("radiogroup", {
				name: "Playback speed",
			});
			await expect(passageSpeedGroup).toBeVisible();
			const passageSpeedSlow = passageSpeedGroup.getByRole("radio", {
				name: "Slow speed",
			});
			const passageSpeedNormal = passageSpeedGroup.getByRole("radio", {
				name: "Normal speed",
			});
			const passageSpeedFast = passageSpeedGroup.getByRole("radio", {
				name: "Fast speed",
			});
			await expect(passageSpeedSlow).toHaveAttribute("aria-checked", "false");
			await expect(passageSpeedNormal).toHaveAttribute("aria-checked", "true");
			await expect(passageSpeedFast).toHaveAttribute("aria-checked", "false");
			await passageSpeedSlow.evaluate((element) =>
				(element as HTMLButtonElement).click(),
			);
			await expect(passageSpeedSlow).toHaveAttribute("aria-checked", "true");
			await expect(passageSpeedNormal).toHaveAttribute("aria-checked", "false");
			await expect(passageSpeedFast).toHaveAttribute("aria-checked", "false");
			await passageSpeedSlow.focus();
			await page.keyboard.press("ArrowRight");
			await expect(passageSpeedSlow).toHaveAttribute("aria-checked", "true");
			await expect(passageSpeedNormal).toBeFocused();
			await page.keyboard.press("Space");
			await expect(passageSpeedSlow).toHaveAttribute("aria-checked", "false");
			await expect(passageSpeedNormal).toHaveAttribute("aria-checked", "true");
			const calcTopWhileVisible = await itemCalculatorButton.evaluate(
				(element) => element.getBoundingClientRect().top,
			);
			const promptTopWhileVisible = await itemPromptAnchor.evaluate(
				(element) => element.getBoundingClientRect().top,
			);
			expect(Math.abs(calcTopWhileVisible - calcTopBefore)).toBeLessThanOrEqual(
				2,
			);
			expect(
				Math.abs(promptTopWhileVisible - promptTopBefore),
			).toBeLessThanOrEqual(2);
			await passageSpeedFast.evaluate((element) =>
				(element as HTMLButtonElement).click(),
			);
			await expect(passageSpeedSlow).toHaveAttribute("aria-checked", "false");
			await expect(passageSpeedNormal).toHaveAttribute("aria-checked", "false");
			await expect(passageSpeedFast).toHaveAttribute("aria-checked", "true");
			await passageSpeedFast.evaluate((element) =>
				(element as HTMLButtonElement).click(),
			);
			await expect(passageSpeedSlow).toHaveAttribute("aria-checked", "false");
			await expect(passageSpeedNormal).toHaveAttribute("aria-checked", "false");
			await expect(passageSpeedFast).toHaveAttribute("aria-checked", "true");
			await page.waitForTimeout(TTS_PREVIEW_MS);
			await expect(passagePanel).toBeVisible();
			await passagePanel.getByRole("button", { name: "Stop reading" }).click();
			await expect(passagePanel).toHaveCount(0);
			const calcTopAfterStop = await itemCalculatorButton.evaluate(
				(element) => element.getBoundingClientRect().top,
			);
			const promptTopAfterStop = await itemPromptAnchor.evaluate(
				(element) => element.getBoundingClientRect().top,
			);
			expect(Math.abs(calcTopAfterStop - calcTopBefore)).toBeLessThanOrEqual(2);
			expect(
				Math.abs(promptTopAfterStop - promptTopBefore),
			).toBeLessThanOrEqual(2);

			await sessionPanel.evaluate(async (element) => {
				const coordinator = (element as any).toolkitCoordinator;
				coordinator?.updateToolConfig?.("textToSpeech", {
					enabled: true,
					backend: "browser",
					transportMode: "pie",
					speedOptions: [
						{ rate: 0.8, label: "Slow", ariaLabel: "Slow speed" },
						{ rate: 1.5, label: "Fast", ariaLabel: "Fast speed" },
					],
				});
				await coordinator?.ensureTTSReady?.(
					coordinator?.getToolConfig?.("textToSpeech"),
				);
			});
			await passageTrigger.click();
			await expect(passagePanel).toBeVisible();
			const labeledSpeedGroup = passagePanel.getByRole("radiogroup", {
				name: "Playback speed",
			});
			const labeledSlow = labeledSpeedGroup.getByRole("radio", {
				name: "Slow speed",
			});
			const labeledNormal = labeledSpeedGroup.getByRole("radio", {
				name: "Normal speed",
			});
			const labeledFast = labeledSpeedGroup.getByRole("radio", {
				name: "Fast speed",
			});
			await expect(labeledSlow).toHaveText("Slow");
			await expect(labeledNormal).toHaveText("Normal");
			await expect(labeledFast).toHaveText("Fast");
			await expect(labeledNormal).toHaveAttribute("aria-checked", "true");
			const beforeLabeledSpeedSpeaks = await readBrowserTtsSpeaks(page);
			await labeledFast.click();
			await expect
				.poll(async () => (await readBrowserTtsSpeaks(page)).length)
				.toBeGreaterThan(beforeLabeledSpeedSpeaks.length);
			const afterLabeledSpeedSpeaks = await readBrowserTtsSpeaks(page);
			expect(afterLabeledSpeedSpeaks.at(-1)?.rate).toBe(1.5);
			await expect(labeledSlow).toHaveAttribute("aria-checked", "false");
			await expect(labeledNormal).toHaveAttribute("aria-checked", "false");
			await expect(labeledFast).toHaveAttribute("aria-checked", "true");
			await passagePanel.getByRole("button", { name: "Stop reading" }).click();
			await expect(passagePanel).toHaveCount(0);

			// Host-triggered handoff: collapse/deactivate active controls without toggling stop semantics.
			await passageTrigger.click();
			await expect(passagePanel).toBeVisible();
			const handoffInvoked = await requestTtsControlHandoff(page);
			expect(handoffInvoked).toBe(true);
			await expect(passagePanel).toHaveCount(0);
			await expect
				.poll(async () => {
					return await page
						.locator("pie-section-player-tools-session-debugger")
						.evaluate((element) => {
							const coordinator = (element as any).toolkitCoordinator;
							return String(coordinator?.ttsService?.getState?.() || "");
						});
				})
				.toMatch(/playing|paused|loading/);
			const expandedAfterProgrammaticHandoff = await passageInlineTts.evaluate(
				(host) => {
					const trigger = host.shadowRoot?.querySelector(
						".pie-tool-tts-inline__trigger",
					) as HTMLButtonElement | null;
					return trigger?.getAttribute("aria-expanded") || null;
				},
			);
			expect(expandedAfterProgrammaticHandoff).toBe("false");
			await page
				.locator("pie-section-player-tools-session-debugger")
				.evaluate((element) => {
					const coordinator = (element as any).toolkitCoordinator;
					coordinator?.ttsService?.stop?.();
				});

			// Cross-instance inline flow: switching to another TTS trigger should close the current one first.
			const itemTrigger = itemInlineTts
				.getByRole("button", { name: "Play reading" })
				.first();
			const itemPanel = itemInlineTts.locator(
				'[role="toolbar"][aria-label="Reading controls"]',
			);
			await passageTrigger.click();
			await expect(passagePanel).toBeVisible();
			await page.waitForTimeout(TTS_PREVIEW_MS);
			await itemTrigger.click();
			await expect(itemPanel).toBeVisible({ timeout: 15_000 });
			await expect(passagePanel).toHaveCount(0);

			// Paused-owner handoff: paused session should also be closed before switching.
			await page.waitForTimeout(TTS_PREVIEW_MS);
			const itemPauseButton = itemInlineTts.getByRole("button", {
				name: "Pause reading",
			});
			const itemResumeButton = itemInlineTts.getByRole("button", {
				name: "Resume reading",
			});
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
			await expect(
				passagePanel.getByRole("button", { name: "Fast-forward" }),
			).toBeFocused();
			await page.keyboard.press("ArrowDown");
			await expect(
				passagePanel.getByRole("button", { name: "Stop reading" }),
			).toBeFocused();
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
			const ttsStopButton = passageRegion.getByRole("button", {
				name: "Stop reading",
			});
			await expect(ttsStopButton).toBeVisible({ timeout: 15_000 });
			await ttsStopButton.click();
			await itemTtsButton.click();
			const itemTtsStopButton = q1.getByRole("button", {
				name: "Stop reading",
			});
			await expect(itemTtsStopButton).toBeVisible({ timeout: 15_000 });
			await itemTtsStopButton.click();
		}

		// TTS settings updates should apply to the active browser-backed runtime config.
		const ttsSettingsToggle = page.getByRole("button", {
			name: "Toggle TTS settings panel",
		});
		await ttsSettingsToggle.click();
		const ttsDialog = page.locator(".pie-tts-dialog");
		await expect(
			ttsDialog.getByRole("heading", { name: "TTS settings" }),
		).toBeVisible();
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
		await expect(ttsDialog.locator("#tts-google-endpoint")).toHaveValue(
			"/api/tts",
		);
		await expect(ttsDialog.locator("#tts-google-rate")).toHaveCount(0);

		await ttsDialog.getByRole("button", { name: "Browser" }).click();
		await expect(ttsDialog.locator("#tts-browser-rate")).toHaveCount(0);
		await expect(ttsDialog.locator("#tts-browser-pitch")).toHaveCount(0);
		const layoutModeSelect = ttsDialog.locator("#tts-layout-mode");
		await expect(layoutModeSelect).toBeVisible();
		await layoutModeSelect.selectOption("floating-overlay");
		await expect(
			ttsDialog.getByText("Item header row reservation: Disabled"),
		).toBeVisible();
		await ttsDialog.getByRole("button", { name: "Apply" }).click();
		await expect(ttsDialog).toHaveCount(0);

		const ttsRuntimeSnapshot = await page
			.locator("pie-section-player-tools-session-debugger")
			.evaluate((element) => {
				const coordinator = (element as any).toolkitCoordinator;
				const toolConfig = coordinator?.getToolConfig?.("textToSpeech") || null;
				const serviceConfig =
					(coordinator?.ttsService as any)?.ttsConfig || null;
				return { toolConfig, serviceConfig };
			});
		expect(ttsRuntimeSnapshot.toolConfig?.backend).toBe("browser");
		expect(ttsRuntimeSnapshot.toolConfig?.layoutMode).toBe("floating-overlay");
		expect(ttsRuntimeSnapshot.toolConfig).toBeTruthy();
		expect(ttsRuntimeSnapshot.serviceConfig).toBeTruthy();

		// Calculator is available in items, not in passage.
		await expect(
			passageRegion.getByRole("button", { name: /calculator/i }),
		).toHaveCount(0);
		const itemCalculatorButton = q1.getByRole("button", {
			name: /open .* calculator/i,
		});
		await expect(itemCalculatorButton).toBeVisible();

		// Calculator opens and renders a real Desmos surface (not just a shell/loading state).
		const desmosAuthResponse = page.waitForResponse(
			(response) =>
				response.url().includes("/api/tools/desmos/auth") &&
				response.request().method() === "GET",
		);
		await itemCalculatorButton.click();
		await desmosAuthResponse;
		const calculatorHost = page
			.locator("pie-tool-calculator .pie-tool-calculator")
			.last();
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
		await expect(calculatorHost.getByText(/failed to initialize/i)).toHaveCount(
			0,
		);
		await expect(
			calculatorHost.locator(".pie-tool-calculator__loading"),
		).toHaveCount(0);
		const calculatorShell = page
			.locator('[data-pie-tool-shell="calculator"]')
			.first();
		const calculatorCloseButton = calculatorShell.getByRole("button", {
			name: "Close tool",
		});
		if (await calculatorCloseButton.isVisible()) {
			await calculatorCloseButton.click();
			await expect(calculatorShell).not.toBeVisible();
		}

		// Preferred placement keeps section-level measurement tools and the
		// legacy toolbar-toggle highlighter off item card toolbars.
		await expect(
			q1.getByRole("button", { name: "Open ruler tool" }),
		).toHaveCount(0);
		await expect(
			q1.getByRole("button", { name: "Open protractor tool" }),
		).toHaveCount(0);
		await expect(
			q1.getByRole("button", { name: "Highlighter - Highlight text" }),
		).toHaveCount(0);

		// Answer eliminator is item-level and should render elimination controls when toggled on.
		const answerEliminatorButton = q1.getByRole("button", {
			name: /answer eliminator|strike through choices/i,
		});
		await expect(answerEliminatorButton).toBeVisible();
		await answerEliminatorButton.click();
		await expect(answerEliminatorButton).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await expect(
			q1.getByRole("button", { name: /toggle elimination for/i }).first(),
		).toBeVisible();

		// Annotation toolbar should be owned by the toolkit placement, not by
		// an extra demo-level toolbar mount.
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
		await expect(itemShells).toHaveCount(2);

		// In scorer mode, answers are review-only and include the expected canonical correct option.
		const q1ScorerRadios = q1.getByRole("radio");
		const q1ScorerInputs = q1.locator('input[type="radio"]');
		await expect(q1ScorerRadios).toHaveCount(4);
		await expect(
			q1.getByText(/Factoring, because this equation factors easily/i).first(),
		).toBeVisible();
		await expect(q1ScorerInputs.first()).toBeDisabled();
		await expect(q1ScorerInputs.first()).toHaveAttribute("checked", "");
		const snapshotScorer = await readSessionSnapshot(
			await openSessionPanel(page),
		);
		expect(Object.keys(snapshotScorer.itemSessions || {})).toEqual(
			expect.arrayContaining(Object.keys(snapshotCandidate.itemSessions || {})),
		);

		// Switch back to student mode and verify session state is carried.
		await page.getByRole("link", { name: "Student" }).click();
		await expect(page).toHaveURL(/mode=candidate/);
		await expect(itemShells).toHaveCount(2);
		await expect(q1.getByRole("radio")).toHaveCount(4);
		await expect(
			q1
				.getByText(/The quadratic formula, because it works for all equations/i)
				.first(),
		).toBeVisible();
		await expect(q1.locator('input[type="radio"]').first()).toHaveAttribute(
			"checked",
			"",
		);

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
		await expect(
			ttsDialog.getByRole("heading", { name: "TTS settings" }),
		).toBeVisible();
		await ttsDialog.getByRole("button", { name: "Polly" }).click();
		await ttsDialog.getByRole("button", { name: "Recheck" }).click();
		await expect(ttsDialog.getByText(/AWS Polly available/i)).toBeVisible({
			timeout: 10_000,
		});
		await ttsDialog.getByRole("button", { name: "Apply" }).click();
		await expect(ttsDialog).toHaveCount(0);

		const providerSnapshot = await page
			.locator("pie-section-player-tools-session-debugger")
			.evaluate((element) => {
				const coordinator = (element as any).toolkitCoordinator;
				return {
					backend:
						coordinator?.getToolConfig?.("textToSpeech")?.backend || null,
					providerId:
						coordinator?.ttsService?.currentProvider?.providerId || null,
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
				request.url().includes("/synthesize") && request.method() === "POST",
		);
		await passageInlineTts
			.getByRole("button", { name: "Play reading" })
			.click();
		const passagePanel = passageInlineTts.locator(
			'[role="toolbar"][aria-label="Reading controls"]',
		);
		await expect(passagePanel).toBeVisible();
		await synthRequest;
		await page.waitForTimeout(TTS_PREVIEW_MS);
		const stopButton = passagePanel.getByRole("button", {
			name: "Stop reading",
		});
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

		await page
			.locator("pie-section-player-tools-session-debugger")
			.evaluate(async (element) => {
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
		await passageInlineTts
			.getByRole("button", { name: "Play reading" })
			.click();
		const passagePanel = passageInlineTts.locator(
			'[role="toolbar"][aria-label="Reading controls"]',
		);
		await expect(passagePanel).toBeVisible();
		const speedButtons = passagePanel.locator(
			".pie-tool-tts-inline__control--speed",
		);
		await expect(speedButtons).toHaveCount(4);
		await expect(speedButtons.nth(0)).toContainText("2x");
		await expect(speedButtons.nth(1)).toContainText("1.25x");
		await expect(speedButtons.nth(2)).toContainText("1.5x");
		await expect(speedButtons.nth(3)).toContainText("Normal");
		await expect(speedButtons.nth(3)).toHaveAttribute("aria-checked", "true");
		await passagePanel.getByRole("button", { name: "Stop reading" }).click();
		await expect(passagePanel).toHaveCount(0);

		await page
			.locator("pie-section-player-tools-session-debugger")
			.evaluate(async (element) => {
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
		await passageInlineTts
			.getByRole("button", { name: "Play reading" })
			.click();
		await expect(passagePanel).toBeVisible();
		await expect
			.poll(async () => (await readBrowserTtsSpeaks(page)).at(-1)?.rate)
			.toBe(1);
		await expect(
			passagePanel.locator(".pie-tool-tts-inline__control--speed"),
		).toHaveCount(0);
		await expect(
			passagePanel.getByRole("button", { name: "Rewind" }),
		).toBeVisible();
		await expect(
			passagePanel.getByRole("button", { name: "Fast-forward" }),
		).toBeVisible();
		await expect(
			passagePanel.getByRole("button", { name: "Stop reading" }),
		).toBeVisible();
		await passagePanel.getByRole("button", { name: "Stop reading" }).click();
		await expect(passagePanel).toHaveCount(0);
	});

	test("clears preview word highlight after browser preview ends", async ({
		page,
	}) => {
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
		await page
			.getByRole("button", { name: "Toggle TTS settings panel" })
			.click();
		const ttsDialog = page.locator(".pie-tts-dialog");
		await expect(
			ttsDialog.getByRole("heading", { name: "TTS settings" }),
		).toBeVisible();
		await ttsDialog.getByRole("button", { name: "Browser" }).click();
		await ttsDialog
			.locator("#tts-preview-text")
			.fill("Preview highlight should clear");

		const previewTrack = ttsDialog.locator(".pie-tts-preview-track");
		await ttsDialog.getByRole("button", { name: "Preview voice" }).click();
		await expect(previewTrack.locator(".pie-tts-preview-active")).toHaveCount(
			1,
		);
		await expect(
			ttsDialog.getByRole("button", { name: "Preview voice" }),
		).toBeVisible();
		await expect(previewTrack.locator(".pie-tts-preview-active")).toHaveCount(
			0,
		);
	});

	test("keeps baseline a11y regressions in check", async ({ page }) => {
		await gotoDemo(page);

		// Baseline automated a11y scan (fail on serious / critical issues).
		const axeResults = await new AxeBuilder({ page })
			.disableRules(["region"])
			// vite-error-overlay is the dev-server crash overlay — not product surface.
			.exclude("vite-error-overlay")
			.analyze();
		const seriousOrCritical = axeResults.violations.filter((violation) =>
			["serious", "critical"].includes(violation.impact || ""),
		);
		const unexpectedSeriousOrCritical = seriousOrCritical.filter(
			(violation) => !isKnownA11yBaselineDebt(violation),
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

	test("keeps old toggle speed behavior scoped to the customization demo", async ({
		page,
	}) => {
		await suppressAudibleBrowserTts(page);
		await page.goto("/tts-toggle-speed?mode=candidate&layout=splitpane", {
			waitUntil: "networkidle",
		});
		await expect(page.getByRole("link", { name: "Student" })).toBeVisible();
		await forceBrowserTtsRuntime(page);

		const passageInlineTts = page
			.getByRole("complementary", { name: "Passages" })
			.locator('[data-demo-tts-toggle-speed="true"]:visible')
			.first();
		await expect(passageInlineTts).toBeVisible();
		await passageInlineTts
			.getByRole("button", { name: "Play reading" })
			.click();
		await expect(
			passageInlineTts.getByRole("button", { name: "Pause reading" }),
		).toHaveClass(/pie-tool-tts-inline__trigger--active/);

		const panel = passageInlineTts.locator(
			'[role="toolbar"][aria-label="Reading controls"]',
		);
		await expect(panel).toBeVisible();
		await expect(panel).toHaveClass(/pie-tool-tts-inline__panel/);
		const panelBox = await panel.boundingBox();
		const triggerBox = await passageInlineTts
			.getByRole("button", { name: "Pause reading" })
			.boundingBox();
		expect(panelBox?.x).toBeLessThan(triggerBox?.x ?? 0);
		await expect(panel.getByRole("button", { name: "Rewind" })).toBeVisible();
		await expect(
			panel.getByRole("button", { name: "Fast-forward" }),
		).toBeVisible();
		const slow = panel.getByRole("button", { name: "Slow speed" });
		const fast = panel.getByRole("button", { name: "Fast speed" });
		await expect(slow).toHaveAttribute("aria-pressed", "false");
		await expect(fast).toHaveAttribute("aria-pressed", "false");

		const beforeSlow = await readBrowserTtsSpeaks(page);
		await slow.click();
		await expect
			.poll(async () => (await readBrowserTtsSpeaks(page)).length)
			.toBeGreaterThan(beforeSlow.length);
		expect((await readBrowserTtsSpeaks(page)).at(-1)?.rate).toBeCloseTo(0.8, 2);
		await expect(slow).toHaveAttribute("aria-pressed", "true");
		await expect(fast).toHaveAttribute("aria-pressed", "false");

		const beforeReset = await readBrowserTtsSpeaks(page);
		await slow.click();
		await expect
			.poll(async () => (await readBrowserTtsSpeaks(page)).length)
			.toBeGreaterThan(beforeReset.length);
		expect((await readBrowserTtsSpeaks(page)).at(-1)?.rate).toBeCloseTo(1, 2);
		await expect(slow).toHaveAttribute("aria-pressed", "false");
		await expect(fast).toHaveAttribute("aria-pressed", "false");
	});
});
