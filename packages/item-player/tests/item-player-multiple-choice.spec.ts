import { expect, test, type Page } from "@playwright/test";

const DELIVERY_PATH = "/demo/multiple-choice/delivery?mode=gather&role=student";
const AUTHOR_PATH = "/demo/multiple-choice/author?mode=gather&role=student";
const SOURCE_PATH = "/demo/multiple-choice/source?mode=gather&role=student";

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

async function selectChoiceByLabel(page: Page, labelText: string) {
	await page
		.locator('label[for^="choice-"]')
		.filter({ hasText: labelText })
		.first()
		.click();
}

async function readSessionState(page: Page): Promise<SessionSnapshot> {
	const sessionJson = page
		.locator("div.card-body")
		.filter({ has: page.getByRole("heading", { name: "Session State" }) })
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
	const q1Entry = session.data?.find((entry) => entry.id === "q1");
	return q1Entry?.value?.[0] ?? null;
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

async function setRole(page: Page, role: "student" | "instructor") {
	await page.getByLabel("Role").selectOption(role);
	await expect(page).toHaveURL(new RegExp(`role=${role}`));
}

async function setMode(page: Page, mode: "gather" | "view" | "evaluate") {
	await page.getByLabel("Mode").selectOption(mode);
	await expect(page).toHaveURL(new RegExp(`mode=${mode}`));
}

function getCheckedChoiceLabel(choiceStates: ChoiceState[]): string | null {
	return choiceStates.find((state) => state.checked)?.text || null;
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
	await editor.click();
	await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
	await page.keyboard.type(nextJson);
}

test.describe("item-player demo multiple-choice", () => {
	test("delivery supports gather/evaluate transitions with carried session state", async ({
		page,
	}) => {
		await gotoRoute(page, DELIVERY_PATH);
		await expect(
			page.getByText("Which planet in our solar system has the most moons?"),
		).toBeVisible();

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

		await setRole(page, "instructor");
		await setMode(page, "evaluate");
		await expect(
			page.getByText("Which planet in our solar system has the most moons?"),
		).toBeVisible({ timeout: 15_000 });

		// Evaluate mode keeps session state and exposes correct-answer affordance.
		const evaluateChoiceStates = await readChoiceStates(page);
		expect(evaluateChoiceStates.some((state) => state.checked && state.disabled)).toBe(true);
		const sessionInEvaluate = await readSessionState(page);
		const selectedInEvaluate = selectedValueFromSession(sessionInEvaluate);
		expect(selectedInEvaluate).toBe(selectedBeforeEvaluate);

		// Switching back to student carries session state from gather.
		await setRole(page, "student");
		if (page.url().includes("mode=evaluate")) {
			await setMode(page, "gather");
		}
		await expect(page).toHaveURL(/mode=gather/);
		await expect(
			page.getByText("Which planet in our solar system has the most moons?"),
		).toBeVisible({ timeout: 15_000 });
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

		const authorPromptEditor = page.getByRole("textbox").first();
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
		await expect(page.getByRole("textbox").first()).toContainText(sourcePrompt);

		await page.getByRole("link", { name: "Source" }).click();
		await expect(page).toHaveURL(/\/source/);
		await expect(page.locator(".ProseMirror").first()).toContainText(sourcePrompt);
	});
});
