import { expect, type Page, test } from "@playwright/test";

/**
 * The assessment toolkit labels the math inside a control with SRE's speech,
 * which puts that speech in the control's name (PIE-1153). The demo's second
 * choice holds (x - 2)(x - 3), which the IIFE element leaves unlabelled.
 *
 * The ESM element tracks the `next` tag. Its newer builds name a choice from
 * its key and a note with `aria-labelledby` and leave the math to the screen
 * reader, where the toolkit leaves it unlabelled (PIE-1244). The ESM case
 * accepts either, and fails a choice that does the wrong one.
 */
const CHOICE_NAME =
	/factors easily into open paren x minus 2 close paren times open paren x minus 3 close paren$/;
const CHOICE_MATH = "pie-item-scope label mjx-container";

async function gotoDemo(page: Page, player: "iife" | "esm"): Promise<void> {
	await page.goto(
		`/tts-generated-ssml?mode=candidate&layout=splitpane&player=${player}`,
		{ waitUntil: "networkidle" },
	);
}

test.describe("section player math control names", () => {
	test("names the math in a choice with its speech (iife)", async ({
		page,
	}) => {
		await gotoDemo(page, "iife");

		await expect(page.getByRole("radio", { name: CHOICE_NAME })).toBeAttached({
			timeout: 30_000,
		});
	});

	test("names the math in a choice by the element's contract (esm)", async ({
		page,
	}) => {
		await gotoDemo(page, "esm");
		await expect(page.locator(CHOICE_MATH).first()).toBeAttached({
			timeout: 30_000,
		});

		// A choice named from elsewhere keeps its math unlabelled; any other
		// choice carries SRE's speech in its name.
		const misnamed = () =>
			page.locator(CHOICE_MATH).evaluateAll(
				(containers) =>
					containers.filter((container) => {
						const input = (
							container.closest("label") as HTMLLabelElement | null
						)?.control;
						const root = container.getRootNode() as Document | ShadowRoot;
						const labels = (
							input?.getAttribute("aria-labelledby")?.split(/\s+/) ?? []
						)
							.map((id) => (id ? root.getElementById(id) : null))
							.filter((element): element is HTMLElement => element !== null);
						const fromElsewhere =
							labels.length > 0 &&
							!labels.some((element) => element.contains(container));
						const labelled = !!container.getAttribute("aria-label");
						return fromElsewhere ? labelled : !labelled;
					}).length,
			);
		await expect.poll(misnamed, { timeout: 30_000 }).toBe(0);
	});

	test("names the math again when MathJax replaces it", async ({ page }) => {
		await gotoDemo(page, "iife");
		const choice = page.getByRole("radio", { name: CHOICE_NAME });
		await expect(choice).toBeAttached({ timeout: 30_000 });

		await page.locator(CHOICE_MATH).evaluate((container) => {
			const replacement = container.cloneNode(true) as Element;
			replacement.removeAttribute("aria-label");
			container.replaceWith(replacement);
		});

		await expect(page.locator(CHOICE_MATH)).toHaveAttribute(
			"aria-label",
			/open paren x minus 2/,
		);
		await expect(choice).toBeAttached();
	});
});
