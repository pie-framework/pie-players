import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const DEMO_PATH = "/demo/tts-ssml?mode=candidate&layout=splitpane";
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
	page: Page,
	sessionPanel: ReturnType<Page["locator"]>,
): Promise<{ itemSessions?: Record<string, unknown> }> {
	const snapshotPre = sessionPanel.locator("pre").first();
	await expect(snapshotPre).toBeVisible();
	for (let attempt = 0; attempt < 25; attempt += 1) {
		const text = (await snapshotPre.textContent()) || "";
		try {
			const parsed = JSON.parse(text) as { itemSessions?: Record<string, unknown> };
			return parsed;
		} catch {
			await page.waitForTimeout(200);
		}
	}
	throw new Error("Session snapshot did not become valid JSON in time");
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
		await expect(q1.getByRole("heading", { name: "Question 1" })).toBeVisible();
		await expect(q2.getByRole("heading", { name: "Question 2" })).toBeVisible();
		await expect(q3.getByRole("heading", { name: "Question 3" })).toBeVisible();

		// Session panel shows and updates dynamically.
		const sessionPanel = await openSessionPanel(page);

		// Q1 mouse interaction (intentionally incorrect choice for scorer visibility checks).
		await q1
			.getByRole("radio", {
				name: /^A\.\s+The quadratic formula, because it works for all equations/i,
			})
			.click();

		// Q2 keyboard interaction.
		const q2FirstRadio = q2.getByRole("radio", { name: /^A\.\s+\(x - 2\)\(x - 3\)/i });
		await expect(q2FirstRadio).toBeVisible();
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
		const snapshotCandidate = await readSessionSnapshot(page, sessionPanel);
		expect(Object.keys(snapshotCandidate.itemSessions || {}).length).toBeGreaterThanOrEqual(2);

		// TTS controls exist for passage and items.
		const passageTtsButton = passageRegion.getByRole("button", { name: "Read aloud" }).first();
		await expect(passageTtsButton).toBeVisible();
		await expect(q1.getByRole("button", { name: "Read aloud" })).toBeVisible();

		// TTS starts reading and can be stopped quickly.
		await passageTtsButton.click();
		const ttsStopButton = passageRegion.getByRole("button", { name: "Stop reading" });
		await expect(ttsStopButton).toBeVisible({ timeout: 15_000 });
		await ttsStopButton.click();
		await expect(passageRegion.getByRole("button", { name: "Read aloud" }).first()).toBeVisible();

		// Calculator is available in items, not in passage.
		await expect(passageRegion.getByRole("button", { name: /calculator/i })).toHaveCount(0);
		const itemCalculatorButton = q1.getByRole("button", { name: /open .* calculator/i });
		await expect(itemCalculatorButton).toBeVisible();

		// Calculator opens and is minimally interactive.
		await itemCalculatorButton.click();
		const calculatorDialog = page.getByRole("dialog", {
			name: "Calculator tool - Drag header to move, Escape to close",
		});
		await expect(calculatorDialog).toBeVisible({ timeout: 20_000 });
		await calculatorDialog.click();
		await expect(calculatorDialog.getByText("Calculator").first()).toBeVisible();

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
		const snapshotScorer = await readSessionSnapshot(page, await openSessionPanel(page));
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
