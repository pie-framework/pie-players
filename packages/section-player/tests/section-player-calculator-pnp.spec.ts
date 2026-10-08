import { expect, test, type Page } from "@playwright/test";

// The toolkit composed around one item with no section player. The host's
// resolver reads the calculator's decision, so each option below is a policy change
// the toolbar has to follow without a reload. Tall enough that the open graphing
// shell, anchored bottom-left, leaves the profile controls clickable.
test.use({ viewport: { width: 1280, height: 1100 } });

test("the calculator's visibility and flavor follow a profile change mid-session", async ({
	page,
}) => {
	test.setTimeout(120_000);
	await page.goto("/calculator-pnp", { waitUntil: "networkidle" });

	const toolbar = page.locator(
		'[data-testid="calculator-pnp-item"] pie-item-toolbar',
	);
	const profile = page.getByTestId("calculator-pnp-profile");
	const calculatorButton = toolbar.getByRole("button", {
		name: /calculator$/i,
	});
	const shell = page.locator('[data-pie-tool-shell="calculator"]');
	const container = shell.locator(
		".pie-tool-calculator__container[data-calculator-type]",
	);

	await expect(
		toolbar.getByRole("button", { name: "Scientific Calculator" }),
	).toBeVisible({ timeout: 60_000 });
	await calculatorButton.click();
	await expect(container).toHaveAttribute("data-calculator-type", "scientific");

	await profile.getByLabel("calculator, graphing type").check();
	await expect(
		toolbar.getByRole("button", { name: "Graphing Calculator" }),
	).toBeVisible();
	await expect(container).toHaveAttribute("data-calculator-type", "graphing");
	await expect(shell.locator(".pie-tool-shell__title")).toHaveText(
		"Graphing Calculator",
	);

	await profile.getByLabel("No calculator").check();
	await expect(calculatorButton).toHaveCount(0);
	await expect(shell).toBeHidden();
});

/**
 * Silent stand-in for browser speech synthesis that records what was spoken.
 * Each spec carries its own, as the TTS specs do.
 */
async function recordSpeech(page: Page): Promise<void> {
	await page.addInitScript(() => {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
		const spoken: string[] = [];
		(window as unknown as { __pieSpoken: string[] }).__pieSpoken = spoken;
		const original = window.speechSynthesis;
		let speaking = false;
		let active: SpeechSynthesisUtterance | null = null;
		const fake: SpeechSynthesis = {
			...original,
			getVoices: () => original.getVoices(),
			speak: (utterance: SpeechSynthesisUtterance) => {
				spoken.push(String(utterance.text || ""));
				active = utterance;
				speaking = true;
				utterance.onstart?.(new Event("start") as SpeechSynthesisEvent);
				window.setTimeout(() => {
					speaking = false;
					active?.onend?.(new Event("end") as SpeechSynthesisEvent);
					active = null;
				}, 50);
			},
			cancel: () => {
				active?.onend?.(new Event("end") as SpeechSynthesisEvent);
				active = null;
				speaking = false;
			},
			pause: () => {},
			resume: () => {},
			get speaking() {
				return speaking;
			},
			get paused() {
				return false;
			},
			get pending() {
				return false;
			},
		};
		Object.defineProperty(window, "speechSynthesis", {
			configurable: true,
			value: fake,
		});
	});
}

// `<pie-item-scope>` is what gives read-aloud its region and the item's
// catalogs here; the spoken card standing in for the equation shows both.
test("read-aloud reads the item through its scope, speaking the equation's card", async ({
	page,
}) => {
	test.setTimeout(120_000);
	await recordSpeech(page);
	await page.goto("/calculator-pnp", { waitUntil: "networkidle" });

	const item = page.getByTestId("calculator-pnp-item");
	await expect(item.getByText("What are the coordinates of its vertex?")).toBeVisible({
		timeout: 60_000,
	});
	await item
		.locator("pie-item-toolbar")
		.getByRole("button", { name: "Play reading" })
		.click();

	const spoken = () =>
		page.evaluate(() =>
			((window as unknown as { __pieSpoken?: string[] }).__pieSpoken || []).join(
				" | ",
			),
		);
	await expect
		.poll(spoken, { timeout: 15_000 })
		.toContain("What are the coordinates of its vertex?");
	expect(await spoken()).toContain("y equals x squared, minus 4 x, plus 1");
	expect(await spoken()).not.toContain("x^2");
});

test("a toolkit without a section announces its runtime and ends its stages at engine-ready", async ({
	page,
}) => {
	await page.addInitScript(() => {
		const log = { runtimeReady: [] as string[], stages: [] as string[], compositions: 0 };
		(window as unknown as { __toolkitLog: typeof log }).__toolkitLog = log;
		document.addEventListener("runtime-ready", (event) => {
			log.runtimeReady.push(
				String((event as CustomEvent<{ ownership?: string }>).detail?.ownership),
			);
		});
		document.addEventListener("pie-stage-change", (event) => {
			const detail = (event as CustomEvent<{ stage: string; status: string }>).detail;
			log.stages.push(`${detail.stage}:${detail.status}`);
		});
		document.addEventListener("composition-changed", () => {
			log.compositions += 1;
		});
	});
	await page.goto("/calculator-pnp", { waitUntil: "networkidle" });

	const readLog = () =>
		page.evaluate(
			() =>
				(
					window as unknown as {
						__toolkitLog: { runtimeReady: string[]; stages: string[]; compositions: number };
					}
				).__toolkitLog,
		);
	await expect.poll(async () => (await readLog()).stages).toEqual([
		"composed:skipped",
		"engine-ready:entered",
	]);
	const log = await readLog();
	expect(log.runtimeReady).toEqual(["owned"]);
	expect(log.compositions).toBe(0);
});
