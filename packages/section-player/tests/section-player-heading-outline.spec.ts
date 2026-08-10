import { type Page, expect, test } from "@playwright/test";

/**
 * The section player's published heading level, end to end.
 *
 * These are element-agnostic on purpose. The per-element arithmetic is the PIE
 * element's business and it moves when a bundle is republished; what has to hold
 * for every element and every future element is the shape of the outline the
 * player composes — levels that descend without skipping, and exactly one
 * heading per item at the item's own level.
 *
 * Both defects these cover were silent. A duplicated level renders fine and a
 * `data-heading` paragraph that was never promoted renders fine; only the
 * structure is wrong. See `docs/architecture/composition-context.md`.
 */

const TWO_PASSAGES = "/two-passages?mode=candidate&layout=splitpane";

type Heading = { level: number; text: string; srOnly: boolean };

async function readOutline(page: Page): Promise<Heading[]> {
	return page.evaluate(() =>
		[...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((node) => {
			const style = getComputedStyle(node as HTMLElement);
			return {
				level: Number.parseInt(node.tagName.slice(1), 10),
				text: (node.textContent || "").trim().slice(0, 60),
				srOnly:
					style.position === "absolute" &&
					Number.parseFloat(style.width) <= 2 &&
					Number.parseFloat(style.height) <= 2,
			};
		}),
	);
}

async function waitForPassageContent(page: Page) {
	await expect(
		page.getByRole("heading", { name: "Sea Turtles in Trouble" }),
	).toBeVisible({ timeout: 30_000 });
}

test.describe("section player heading outline", () => {
	test("levels descend without skipping", async ({ page }) => {
		await page.goto(TWO_PASSAGES, { waitUntil: "networkidle" });
		await waitForPassageContent(page);

		const outline = await readOutline(page);
		expect(outline.length).toBeGreaterThan(2);

		let previous = outline[0].level;
		for (const heading of outline) {
			// Going deeper may only ever be by one. Coming back up may skip freely:
			// leaving a subtree is not a gap in the outline.
			expect(heading.level, `after h${previous}: ${heading.text}`).toBeLessThanOrEqual(
				previous + 1,
			);
			previous = heading.level;
		}
	});

	test("no two headings at one level describe the same item", async ({
		page,
	}) => {
		await page.goto(TWO_PASSAGES, { waitUntil: "networkidle" });
		await waitForPassageContent(page);

		// The card heading is the item's heading; an element-furnished one beside it
		// reads to assistive technology as a sibling of the question rather than a
		// description of it.
		const duplicated = await page.evaluate(() => {
			const cards = [
				...document.querySelectorAll(
					"[data-section-item-card], pie-section-player-passage-card",
				),
			];
			return cards
				.map((card) => {
					const own = card.querySelector("h1,h2,h3,h4,h5,h6");
					if (!own) return null;
					const level = own.tagName;
					const sameLevel = [...card.querySelectorAll(level)].length;
					return sameLevel > 1
						? { level, count: sameLevel, text: (own.textContent || "").trim() }
						: null;
				})
				.filter(Boolean);
		});
		expect(duplicated).toEqual([]);
	});

	test("cards render at the published level and content nests below", async ({
		page,
	}) => {
		await page.goto(TWO_PASSAGES, { waitUntil: "networkidle" });
		await waitForPassageContent(page);

		// Default: cards at h2, passage title one below, authored content below that.
		await expect(
			page.getByRole("heading", { name: "Passage", level: 2 }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Sea Turtles in Trouble", level: 3 }),
		).toBeVisible();

		// PIE-151 markup is promoted only when a level is published; nothing
		// published one before, so these were paragraphs in every host.
		const authored = await page.evaluate(() =>
			[...document.querySelectorAll('[data-heading="heading1"]')].map((node) =>
				node.tagName.toLowerCase(),
			),
		);
		expect(authored.length).toBeGreaterThan(0);
		for (const tag of authored) expect(tag).toBe("h4");
	});

	test("a host-published level moves the whole outline", async ({ page }) => {
		await page.goto(TWO_PASSAGES, { waitUntil: "networkidle" });
		await waitForPassageContent(page);

		await page.evaluate(() => {
			document
				.querySelector("pie-section-player-splitpane")
				?.setAttribute("base-heading-level", "3");
		});

		await expect(
			page.getByRole("heading", { name: "Passage", level: 3 }),
		).toBeVisible({ timeout: 15_000 });
		await expect(
			page.getByRole("heading", { name: "Sea Turtles in Trouble", level: 4 }),
		).toBeVisible({ timeout: 15_000 });
		await expect
			.poll(
				async () =>
					page.evaluate(
						() =>
							document.querySelector('[data-heading="heading1"]')?.tagName ?? null,
					),
				{ timeout: 15_000 },
			)
			.toBe("H5");
	});
});
