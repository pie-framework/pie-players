import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const DEMO_PATH = "/tts-ssml?mode=candidate&layout=splitpane";
const KNOWN_A11Y_BASELINE_DEBT = new Set(["aria-allowed-attr", "aria-roles", "tabindex"]);

async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expect(page.getByRole("link", { name: "Student" })).toBeVisible();
}

async function openSessionPanel(page: Page) {
	await page.getByRole("button", { name: "Toggle session panel" }).click();
	const panel = page.locator("pie-section-player-tools-session-debugger");
	await expect(panel.getByRole("heading", { name: "Session Data" })).toBeVisible();
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

async function setRangeValue(page: Page, selector: string, value: number): Promise<void> {
	await page.locator(selector).evaluate(
		(node, nextValue) => {
			const input = node as HTMLInputElement;
			input.value = String(nextValue);
			input.dispatchEvent(new Event("input", { bubbles: true }));
			input.dispatchEvent(new Event("change", { bubbles: true }));
		},
		value,
	);
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
	test("covers passage, interactions, mode switching, and tools", async ({ page }) => {
		test.setTimeout(180_000);

		await gotoDemo(page);

		const passageRegion = page.getByRole("complementary", { name: "Passages" });
		const itemsRegion = page.getByRole("main", { name: "Items" });
		const itemShells = page.locator('pie-item-shell[data-pie-shell-root="item"]');
		const q1 = itemShells.nth(0);
		const q2 = itemShells.nth(1);
		const q3 = itemShells.nth(2);

		// Passage is rendered and visible.
		await expect(passageRegion).toBeVisible();
		await expect(passageRegion.getByRole("heading", { name: "Understanding Quadratic Equations" })).toBeVisible();
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

		// TTS controls exist for passage and items (toolbar button or inline expanded controls).
		const passageInlineTts = passageRegion.locator("pie-tool-tts-inline:visible");
		const itemInlineTts = q1.locator("pie-tool-tts-inline:visible");
		const hasInlineTts = (await passageInlineTts.count()) > 0;
		if (hasInlineTts) {
			await expect(passageInlineTts.first()).toBeVisible();
			await expect(itemInlineTts.first()).toBeVisible();

			// Expanded panel flow: open controls, read, then stop.
			const passageTrigger = passageInlineTts
				.getByRole("button", { name: "Open reading controls" })
				.first();
			await passageTrigger.click();
			const passagePanel = passageInlineTts.locator(
				'[role="toolbar"][aria-label="Reading controls"]',
			);
			await expect(passagePanel).toBeVisible();
			const passageSpeed15 = passagePanel.getByRole("button", { name: "Speed 1.5x" });
			const passageSpeed2 = passagePanel.getByRole("button", { name: "Speed 2x" });
			await expect(passageSpeed15).toHaveAttribute("aria-pressed", "false");
			await expect(passageSpeed2).toHaveAttribute("aria-pressed", "false");
			await passageSpeed15.click();
			await expect(passageSpeed15).toHaveAttribute("aria-pressed", "true");
			await expect(passageSpeed2).toHaveAttribute("aria-pressed", "false");
			await passageSpeed2.click();
			await expect(passageSpeed15).toHaveAttribute("aria-pressed", "false");
			await expect(passageSpeed2).toHaveAttribute("aria-pressed", "true");
			await passageSpeed2.click();
			await expect(passageSpeed15).toHaveAttribute("aria-pressed", "false");
			await expect(passageSpeed2).toHaveAttribute("aria-pressed", "false");
			await passagePanel.getByRole("button", { name: "Read aloud" }).click();
			await expect(
				passagePanel.getByRole("button", { name: /Pause reading|Resume reading/ }),
			).toBeVisible({ timeout: 15_000 });
			await passagePanel.getByRole("button", { name: "Stop reading" }).click();
			await expect(passagePanel).toHaveCount(0);

			// Item-level inline flow.
			const itemTrigger = itemInlineTts
				.getByRole("button", { name: "Open reading controls" })
				.first();
			await itemTrigger.click();
			const itemPanel = itemInlineTts.locator('[role="toolbar"][aria-label="Reading controls"]');
			await expect(itemPanel).toBeVisible();
			await itemPanel.getByRole("button", { name: "Read aloud" }).click();
			await expect(
				itemPanel.getByRole("button", { name: /Pause reading|Resume reading/ }),
			).toBeVisible({ timeout: 15_000 });
			await itemPanel.getByRole("button", { name: "Stop reading" }).click();
			await expect(itemPanel).toHaveCount(0);

			// Keyboard operability inside expanded controls.
			await passageTrigger.click();
			await expect(passagePanel).toBeVisible();
			await passagePanel.getByRole("button", { name: "Read aloud" }).click();
			const pauseOrResume = passagePanel.getByRole("button", {
				name: /Pause reading|Resume reading/,
			});
			await expect(pauseOrResume).toBeVisible({ timeout: 15_000 });
			await pauseOrResume.focus();
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
		await ttsDialog.getByRole("button", { name: "Browser" }).click();
		await setRangeValue(page, "#tts-browser-rate", 1.35);
		await setRangeValue(page, "#tts-browser-pitch", 1.1);
		await ttsDialog.getByRole("button", { name: "Apply" }).click();
		await expect(ttsDialog).toHaveCount(0);
		const ttsRuntimeSnapshot = await page
			.locator("pie-section-player-tools-session-debugger")
			.evaluate((element) => {
				const coordinator = (element as any).toolkitCoordinator;
				const toolConfig = coordinator?.getToolConfig?.("tts") || null;
				const serviceConfig = (coordinator?.ttsService as any)?.ttsConfig || null;
				return { toolConfig, serviceConfig };
			});
		expect(ttsRuntimeSnapshot.toolConfig?.backend).toBe("browser");
		expect(Number(ttsRuntimeSnapshot.toolConfig?.rate ?? 0)).toBeCloseTo(1.35, 2);
		expect(Number(ttsRuntimeSnapshot.toolConfig?.pitch ?? 0)).toBeCloseTo(1.1, 2);
		expect(Number(ttsRuntimeSnapshot.serviceConfig?.rate ?? 0)).toBeCloseTo(1.35, 2);
		expect(Number(ttsRuntimeSnapshot.serviceConfig?.pitch ?? 0)).toBeCloseTo(1.1, 2);

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
