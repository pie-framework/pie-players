import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const DEMO_ID = "multiple-choice-radio-simple";
const DELIVERY_PATH = `/demo/${DEMO_ID}/delivery?mode=gather&role=student`;
const AUTHOR_PATH = `/demo/${DEMO_ID}/author?mode=gather&role=student`;
const SOURCE_PATH = `/demo/${DEMO_ID}/source?mode=gather&role=student`;
const DELIVERY_PROMPT = "Which is the largest planet in our solar system?";
const SESSION_ENTRY_ID = "2";
const KNOWN_DELIVERY_ITEM_DEBT = new Set(["aria-allowed-attr"]);

type SessionSnapshot = {
	id?: string;
	data?: Array<{
		id?: string;
		value?: string[];
		selector?: string;
		[key: string]: unknown;
	}>;
	[key: string]: unknown;
};

type ChoiceState = {
	text: string;
	checked: boolean;
	disabled: boolean;
	ariaChecked: string | null;
};

async function gotoRoute(page: Page, path: string) {
	await page.goto(path, { waitUntil: "networkidle" });
	await expect(page.getByRole("link", { name: "Delivery" })).toBeVisible();
}

async function openSessionPanel(page: Page) {
	const panel = page.locator("pie-item-player-session-debugger");
	const sessionTab = page.getByRole("tab", { name: "Session" });
	if (await sessionTab.isVisible().catch(() => false)) {
		return panel;
	}
	await page.getByRole("button", { name: "Toggle item session panel" }).click();
	await expect(sessionTab).toBeVisible();
	return panel;
}

async function openInstrumentationPanel(page: Page) {
	const panel = page.locator("pie-section-player-tools-instrumentation-debugger");
	const firstRow = panel.locator(
		".pie-section-player-tools-instrumentation-debugger__row",
	).first();
	if (await firstRow.isVisible().catch(() => false)) {
		return panel;
	}
	await page.getByRole("button", { name: "Toggle instrumentation panel" }).click();
	await expect(
		panel.locator(".pie-section-player-tools-instrumentation-debugger"),
	).toBeVisible();
	return panel;
}

async function selectChoiceByLabel(page: Page, labelText: string) {
	await page
		.locator('label[for^="choice-"]')
		.filter({ hasText: labelText })
		.first()
		.click();
}

async function readSessionState(page: Page): Promise<SessionSnapshot> {
	const panel = await openSessionPanel(page);
	await panel.getByRole("tab", { name: "Session" }).click();
	const sessionJson = panel
		.locator(".pie-item-player-session-debugger__card")
		.filter({ hasText: "Session Data" })
		.locator("pre")
		.first();
	await expect(sessionJson).toBeVisible();
	for (let attempt = 0; attempt < 30; attempt += 1) {
		const text = (await sessionJson.textContent()) || "";
		try {
			return JSON.parse(text) as SessionSnapshot;
		} catch {
			await page.waitForTimeout(150);
		}
	}
	throw new Error("Session JSON did not become parseable in time");
}

function selectedValueFromSession(session: SessionSnapshot): string | null {
	const entry = session.data?.find((item) => item.id === SESSION_ENTRY_ID);
	const value = entry?.value;
	return Array.isArray(value) ? value[0] ?? null : null;
}

async function readChoiceStates(page: Page): Promise<ChoiceState[]> {
	return await page.evaluate(() => {
		const labels = Array.from(document.querySelectorAll('label[for^="choice-"]'));
		return labels.map((label) => {
			const choiceId = label.getAttribute("for") || "";
			const input = document.getElementById(choiceId) as HTMLInputElement | null;
			return {
				text: (label.textContent || "").replace(/\s+/g, " ").trim(),
				checked: Boolean(input?.checked),
				disabled: Boolean(input?.disabled),
				ariaChecked:
					label.querySelector("[aria-checked]")?.getAttribute("aria-checked") || null,
			};
		});
	});
}

async function setDemoPerspective(page: Page, perspective: "student" | "scorer") {
	await page
		.getByRole("link", { name: perspective === "student" ? "Student" : "Scorer" })
		.click();
	if (perspective === "student") {
		await expect(page).toHaveURL(/mode=gather/);
		await expect(page).toHaveURL(/role=student/);
		return;
	}
	await expect(page).toHaveURL(/mode=evaluate/);
	await expect(page).toHaveURL(/role=instructor/);
}

function getCheckedChoiceLabel(choiceStates: ChoiceState[]): string | null {
	return choiceStates.find((state) => state.checked)?.text || null;
}

function promptEditor(page: Page) {
	return page.getByRole("textbox").nth(1);
}

async function replaceSourcePrompt(page: Page, nextPrompt: string) {
	const editor = page.locator(".ProseMirror").first();
	await expect(editor).toBeVisible();
	const currentConfig = JSON.parse(await editor.innerText()) as {
		models?: Array<{ prompt?: string }>;
	};
	if (!currentConfig.models?.[0]) {
		throw new Error("Source editor JSON does not include models[0]");
	}
	currentConfig.models[0].prompt = nextPrompt;
	const nextJson = JSON.stringify(currentConfig, null, 2);
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
		origin: new URL(page.url()).origin,
	});
	await editor.click();
	await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
	await page.evaluate(async (text) => {
		await navigator.clipboard.writeText(text);
	}, nextJson);
	await page.keyboard.press(process.platform === "darwin" ? "Meta+V" : "Control+V");
	await expect(editor).toContainText(nextPrompt);
}

test.describe("item-player demo multiple-choice", () => {
	test("delivery supports gather/evaluate transitions with carried session state", async ({
		page,
	}) => {
		await gotoRoute(page, DELIVERY_PATH);
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible();

		// Gather mode supports mouse selection.
		await selectChoiceByLabel(page, "Mars");
		const sessionAfterMouse = await readSessionState(page);
		const selectedAfterMouse = selectedValueFromSession(sessionAfterMouse);
		expect(selectedAfterMouse).not.toBeNull();

		// Gather mode supports keyboard selection and session updates dynamically.
		const checkedChoiceBeforeKeyboard = page.locator('input[type="radio"]:checked').first();
		await expect(checkedChoiceBeforeKeyboard).toBeVisible();
		await checkedChoiceBeforeKeyboard.focus();
		await page.keyboard.press("ArrowDown");
		const sessionAfterKeyboard = await readSessionState(page);
		const selectedAfterKeyboard = selectedValueFromSession(sessionAfterKeyboard);
		expect(selectedAfterKeyboard).not.toBeNull();
		expect(selectedAfterKeyboard).not.toBe(selectedAfterMouse);

		// Return to a deterministic wrong selection before evaluate mode assertions.
		await selectChoiceByLabel(page, "Mars");
		const sessionBeforeEvaluate = await readSessionState(page);
		const selectedBeforeEvaluate = selectedValueFromSession(sessionBeforeEvaluate);
		expect(selectedBeforeEvaluate).not.toBeNull();

		await setDemoPerspective(page, "scorer");
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({ timeout: 15_000 });

		// Evaluate mode keeps session state and exposes correct-answer affordance.
		const evaluateChoiceStates = await readChoiceStates(page);
		expect(evaluateChoiceStates.some((state) => state.checked && state.disabled)).toBe(true);
		const sessionInEvaluate = await readSessionState(page);
		const selectedInEvaluate = selectedValueFromSession(sessionInEvaluate);
		expect(selectedInEvaluate).toBe(selectedBeforeEvaluate);

		// Switching back to student carries session state from gather.
		await setDemoPerspective(page, "student");
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({ timeout: 15_000 });
		await expect
			.poll(async () => {
				const states = await readChoiceStates(page);
				return getCheckedChoiceLabel(states);
			})
			.not.toBeNull();
		const gatherStatesAfterSwitchBack = await readChoiceStates(page);
		expect(gatherStatesAfterSwitchBack.some((state) => state.checked)).toBe(true);
		const sessionAfterSwitchBack = await readSessionState(page);
		const selectedAfterSwitchBackValue = selectedValueFromSession(sessionAfterSwitchBack);
		expect(selectedAfterSwitchBackValue).toBe(selectedBeforeEvaluate);
	});

	test("author prompt changes sync to delivery and source", async ({ page }) => {
		const authorPrompt =
			"Author test prompt: Which planet currently has the most confirmed moons?";
		await gotoRoute(page, AUTHOR_PATH);
		await expect(page).toHaveURL(/\/author/);

		const authorPromptEditor = promptEditor(page);
		await authorPromptEditor.click();
		await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
		await page.keyboard.type(authorPrompt);

		await page.getByRole("link", { name: "Delivery" }).click();
		await expect(page).toHaveURL(/\/delivery/);
		await expect(page.getByText(authorPrompt)).toBeVisible();

		await page.getByRole("link", { name: "Source" }).click();
		await expect(page).toHaveURL(/\/source/);
		await expect(page.locator(".ProseMirror").first()).toContainText(authorPrompt);
	});

	test("source edits apply and sync to delivery and author", async ({ page }) => {
		const sourcePrompt = "Source test prompt: Select the planet with the greatest moon count.";
		await gotoRoute(page, SOURCE_PATH);
		await expect(page).toHaveURL(/\/source/);

		await replaceSourcePrompt(page, sourcePrompt);
		await expect(page.getByText("Unsaved changes")).toBeVisible();
		await expect(page.getByRole("button", { name: "Apply" })).toBeEnabled();
		await page.getByRole("button", { name: "Apply" }).click();
		await expect(page.getByText("Changes applied.")).toBeVisible();

		await page.getByRole("link", { name: "Delivery" }).click();
		await expect(page).toHaveURL(/\/delivery/);
		await expect(page.getByText(sourcePrompt)).toBeVisible();

		await page.getByRole("link", { name: "Author" }).click();
		await expect(page).toHaveURL(/\/author/);
		await expect(promptEditor(page)).toContainText(sourcePrompt);

		await page.getByRole("link", { name: "Source" }).click();
		await expect(page).toHaveURL(/\/source/);
		await expect(page.locator(".ProseMirror").first()).toContainText(sourcePrompt);
	});

	test("keeps baseline a11y regressions in check", async ({ page }) => {
		await gotoRoute(page, DELIVERY_PATH);

		// Scope the automated check to the rendered player surface so the baseline
		// stays generic to pie-item-player and does not conflate demo-route chrome
		// with delivery-item accessibility debt.
		const axeResults = await new AxeBuilder({ page })
			.include("pie-item-player")
			.disableRules(["region"])
			.analyze();
		const seriousOrCritical = axeResults.violations.filter((violation) =>
			["serious", "critical"].includes(violation.impact || ""),
		);
		const unexpectedSeriousOrCritical = seriousOrCritical.filter(
			(violation) => !KNOWN_DELIVERY_ITEM_DEBT.has(violation.id),
		);

		expect(
			unexpectedSeriousOrCritical,
			`Unexpected delivery-item axe serious/critical violations in pie-item-player: ${JSON.stringify(
				unexpectedSeriousOrCritical,
				null,
				2,
			)}\nKnown delivery-item blockers (currently upstream, not fixed in pie-players): ${JSON.stringify(
				seriousOrCritical,
				null,
				2,
			)}`,
		).toEqual([]);
	});

	test("renders instrumentation records in instrumentation panel", async ({
		page,
	}) => {
		await gotoRoute(page, DELIVERY_PATH);
		const panel = await openInstrumentationPanel(page);
		await page.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent("pie-instrumentation-debug-record", {
					detail: {
						id: 1,
						kind: "event",
						providerId: "test",
						providerName: "Test Provider",
						timestamp: new Date().toISOString(),
						name: "pie-item-test-event",
						attributes: { component: "pie-item-player" },
					},
				}),
			);
		});
		await expect(
			panel.locator(
				".pie-section-player-tools-instrumentation-debugger__row",
			).first(),
		).toBeVisible({ timeout: 30_000 });
	});
});
