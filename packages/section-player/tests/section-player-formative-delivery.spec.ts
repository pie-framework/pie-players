import { expect, test } from "@playwright/test";

/**
 * Formative delivery, end to end.
 *
 * The unit suites cover the reducer, the rollup and the env projection in
 * isolation. What only a browser can show is the round trip: the card calls
 * `provideScore()` on a real item player, the outcomes travel the internal
 * event route to the controller, and the republished composition changes what
 * the card renders and what `env` the player is holding.
 *
 * That round trip has one non-obvious failure mode, which is why this spec
 * exists rather than a third unit test: recording a Try changes neither the
 * renderables nor the item sessions, so the toolkit's composition revision key
 * had to learn about formative state or the emit is coalesced away and the
 * controller silently holds correct state the learner never sees.
 */
const DEMO_PATH = "/formative-delivery?mode=candidate&layout=splitpane";

type CardState = {
	id: string;
	label: string | null;
	status: string;
	envMode: string;
	envRole: string;
};

async function cardStates(
	page: import("@playwright/test").Page,
): Promise<CardState[]> {
	return page.evaluate(() =>
		[...document.querySelectorAll("[data-section-item-card]")].map((card) => {
			const button = card.querySelector("[data-pie-formative-action]");
			const player = card.querySelector("pie-item-player") as
				| (Element & { env?: Record<string, unknown> })
				| null;
			const env = player?.env ?? {};
			return {
				id: card.getAttribute("data-canonical-item-id") || "",
				label: button ? (button.textContent || "").trim() : null,
				status: (
					card.querySelector("[data-pie-formative-status]")?.textContent || ""
				).trim(),
				envMode: String(env.mode || ""),
				envRole: String(env.role || ""),
			};
		}),
	);
}

async function cardFor(page: import("@playwright/test").Page, id: string) {
	const cards = await cardStates(page);
	const card = cards.find((entry) => entry.id === id);
	if (!card) throw new Error(`No card rendered for ${id}. Saw: ${cards.map((c) => c.id).join(", ")}`);
	return card;
}

/**
 * Click the label, not the input.
 *
 * The choice element renders an MUI radio whose `<input>` is visually hidden and
 * driven by React, so `locator.check()` reports "clicking the checkbox did not
 * change its state". The same reason `chooseVisibleUncheckedAnswer` in
 * `section-player-session-hydrate-db.spec.ts` clicks label text.
 */
async function pickChoice(
	page: import("@playwright/test").Page,
	itemId: string,
	label: string,
): Promise<void> {
	const choiceLabel = page
		.locator(`[data-canonical-item-id="${itemId}"]`)
		.getByText(label, { exact: true })
		.first();
	await expect(choiceLabel).toBeVisible({ timeout: 30_000 });
	await choiceLabel.click();
}

function control(page: import("@playwright/test").Page, itemId: string) {
	return page
		.locator(`[data-canonical-item-id="${itemId}"] [data-pie-formative-action]`)
		.first();
}

test.describe("formative delivery", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(DEMO_PATH);
		// Every card mounted, elements registered, controls resolved.
		await expect(control(page, "fd-q1")).toBeVisible({ timeout: 30_000 });
		await expect(control(page, "fd-q3")).toBeVisible();
	});

	test("renders a control only where the resolved policy is enabled", async ({
		page,
	}) => {
		const cards = await cardStates(page);
		expect(cards.map((card) => card.id)).toEqual([
			"fd-q1",
			"fd-q2",
			"fd-q3",
			"fd-q4",
		]);
		expect(cards.slice(0, 3).map((card) => card.label)).toEqual([
			"Check answer",
			"Check answer",
			"Check answer",
		]);
		// `fd-q4` sets `enabled: false`, so it is an ordinary item inside a
		// formative section.
		expect(cards[3].label).toBeNull();
		expect(cards.every((card) => card.envMode === "gather")).toBe(true);
	});

	test("a wrong answer reveals correctness on that item alone and offers a retry", async ({
		page,
	}) => {
		await pickChoice(page, "fd-q1", "Venus");
		await control(page, "fd-q1").click();

		await expect(control(page, "fd-q1")).toHaveText("Try again");
		const checked = await cardFor(page, "fd-q1");
		expect(checked.status).toContain("Not correct");
		// Tries remaining is stated, not only implied by the button.
		expect(checked.status).toContain("2 tries left");
		// Correctness is words, never colour alone.
		expect(checked.status).not.toBe("");
		expect(checked.envMode).toBe("evaluate");
		expect(checked.envRole).toBe("student");

		// The neighbours are untouched: this is the per-item env seam.
		const others = (await cardStates(page)).filter((card) => card.id !== "fd-q1");
		expect(others.every((card) => card.envMode === "gather")).toBe(true);
		expect(others.every((card) => card.status === "")).toBe(true);
	});

	test("a retry reopens the item at the section env", async ({ page }) => {
		await pickChoice(page, "fd-q1", "Venus");
		await control(page, "fd-q1").click();
		await expect(control(page, "fd-q1")).toHaveText("Try again");

		await control(page, "fd-q1").click();
		await expect(control(page, "fd-q1")).toHaveText("Check answer");
		const reopened = await cardFor(page, "fd-q1");
		expect(reopened.envMode).toBe("gather");
	});

	test("a correct answer on a second try reports correct", async ({ page }) => {
		await pickChoice(page, "fd-q1", "Venus");
		await control(page, "fd-q1").click();
		await expect(control(page, "fd-q1")).toHaveText("Try again");
		await control(page, "fd-q1").click();

		await pickChoice(page, "fd-q1", "Mercury");
		await control(page, "fd-q1").click();
		await expect(control(page, "fd-q1")).toHaveText("Try again");
		expect((await cardFor(page, "fd-q1")).status).toContain("Correct.");
	});

	test("a single-try item spends its try and removes the control", async ({
		page,
	}) => {
		await pickChoice(page, "fd-q2", "Oxygen");
		await control(page, "fd-q2").click();

		await expect(control(page, "fd-q2")).toHaveCount(0);
		const spent = await cardFor(page, "fd-q2");
		expect(spent.status).toContain("Not correct");
		// `feedback: "solution"` projects the instructor role, which is the element
		// convention for also revealing the authored correct response.
		expect(spent.envMode).toBe("evaluate");
		expect(spent.envRole).toBe("instructor");
	});

	test("on-final-try records a try and reveals nothing until the last one", async ({
		page,
	}) => {
		await pickChoice(page, "fd-q3", "Atlantic");
		await control(page, "fd-q3").click();
		await expect
			.poll(async () => (await cardFor(page, "fd-q3")).status)
			.toContain("Answer recorded");

		const firstTry = await cardFor(page, "fd-q3");
		// Still checkable, because nothing was revealed to dismiss.
		expect(firstTry.label).toBe("Check answer");
		expect(firstTry.envMode).toBe("gather");
		expect(firstTry.status).not.toContain("Not correct");

		await control(page, "fd-q3").click();
		await control(page, "fd-q3").click();

		await expect
			.poll(async () => (await cardFor(page, "fd-q3")).status)
			.toContain("Not correct");
		expect((await cardFor(page, "fd-q3")).envMode).toBe("evaluate");
	});

	test("the status message lives in a polite live region that exists before it has content", async ({
		page,
	}) => {
		const status = page
			.locator('[data-canonical-item-id="fd-q1"] [data-pie-formative-status]')
			.first();
		// Present and empty before any Try, so the first announcement is not lost
		// to a region that did not yet exist (WCAG 4.1.3).
		await expect(status).toHaveAttribute("aria-live", "polite");
		await expect(status).toHaveText("");

		await pickChoice(page, "fd-q1", "Venus");
		await control(page, "fd-q1").click();
		await expect(status).not.toHaveText("");
	});

	test("the control is reachable and operable from the keyboard", async ({
		page,
	}) => {
		await pickChoice(page, "fd-q1", "Venus");
		const button = control(page, "fd-q1");
		await button.focus();
		await expect(button).toBeFocused();
		await page.keyboard.press("Enter");
		await expect(button).toHaveText("Try again");
		// Focus is held rather than moved to the feedback above it.
		await expect(button).toBeFocused();
	});

	test("mastery rolls up over tries and excludes nothing in this section", async ({
		page,
	}) => {
		await pickChoice(page, "fd-q1", "Mercury");
		await control(page, "fd-q1").click();
		await expect(control(page, "fd-q1")).toHaveText("Try again");

		const mastery = await page.evaluate(async () => {
			const host = document.querySelector("pie-section-player-splitpane") as
				| (HTMLElement & {
						waitForSectionController?: (
							timeoutMs: number,
						) => Promise<{ getFormativeProjection?: () => unknown } | null>;
				  })
				| null;
			const controller = await host?.waitForSectionController?.(5000);
			const projection = controller?.getFormativeProjection?.() as
				| { mastery?: Record<string, unknown> }
				| null
				| undefined;
			return projection?.mastery ?? null;
		});

		expect(mastery).toMatchObject({
			version: 1,
			// `fd-q4` opted out, so it carries no formative state — but it is still
			// one of the section's items.
			totalItems: 4,
			masteredItems: 1,
			triedItems: 1,
			complete: false,
		});
	});
});
