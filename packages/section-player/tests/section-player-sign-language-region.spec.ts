import { expect, test, type Page } from "@playwright/test";

/**
 * E2E tests for the item card's catalog media region, rendering signed (ASL)
 * alternates.
 *
 * The unit tests cover extraction, payload validation, strict sign-language
 * matching and policy precedence in isolation. What only a browser can prove is
 * the composition: that both halves of availability are enforced together, that
 * the region lands beside the item content without the item player noticing, and
 * that the divider is operable from the keyboard.
 *
 * No signing clip is bundled (see
 * `apps/section-demos/static/demo-assets/sign-language/README.md`), so these
 * tests assert on the region, its sources and its naming rather than on
 * playback.
 */

const GRANTED_PATH =
	"/sign-language?page=signing-granted&mode=candidate&layout=splitpane";
const NOT_GRANTED_PATH =
	"/sign-language?page=signing-not-granted&mode=candidate&layout=splitpane";

const INLINE_PROMPT =
	"A plant absorbs carbon dioxide and releases oxygen. What process is this?";
const NO_SIGNING_PROMPT = "Which gas do plants take in during photosynthesis?";
const AUTHORED_PROMPT =
	"Where in a plant cell does photosynthesis mainly happen?";

async function gotoDemo(page: Page, path: string) {
	await page.goto(path, { waitUntil: "networkidle" });
	await page.waitForSelector("pie-section-player-splitpane", {
		state: "attached",
	});
	// The PIE elements load asynchronously; poll for rendered prompt text.
	await expect(page.getByText(INLINE_PROMPT)).toBeVisible({ timeout: 30_000 });
}

function itemCard(page: Page, itemId: string) {
	return page.locator(
		`pie-section-player-item-card [data-canonical-item-id="${itemId}"]`,
	);
}

function mediaRegion(page: Page, itemId: string) {
	return itemCard(page, itemId).locator('[data-region="media"]');
}

test.describe("sign-language region — availability", () => {
	test("shows the signed alternate for an item that carries one when policy grants signing", async ({
		page,
	}) => {
		await gotoDemo(page, GRANTED_PATH);

		const region = mediaRegion(page, "asl-q1-inline");
		await expect(region).toBeVisible();
		// The accessible name says which language, not "video".
		await expect(
			region.getByLabel("American Sign Language translation"),
		).toBeVisible();
		await expect(region.getByText("American Sign Language")).toBeVisible();
		await expect(region.locator("video source")).toHaveAttribute(
			"src",
			"/demo-assets/sign-language/sample-asl.mp4",
		);
	});

	test("resolves an authored catalog card the same way as extracted markup", async ({
		page,
	}) => {
		await gotoDemo(page, GRANTED_PATH);
		await expect(page.getByText(AUTHORED_PROMPT)).toBeVisible({
			timeout: 30_000,
		});
		await expect(mediaRegion(page, "asl-q3-authored")).toBeVisible();
	});

	test("leaves no dead affordance on an item with no signing content", async ({
		page,
	}) => {
		await gotoDemo(page, GRANTED_PATH);
		await expect(page.getByText(NO_SIGNING_PROMPT)).toBeVisible({
			timeout: 30_000,
		});
		await expect(mediaRegion(page, "asl-q2-none")).toHaveCount(0);
	});

	test("shows nothing at all when policy does not grant signing", async ({
		page,
	}) => {
		await gotoDemo(page, NOT_GRANTED_PATH);
		await expect(page.locator('[data-region="media"]')).toHaveCount(0);
		// And the signing video is not visible as ordinary item content either —
		// extraction moved it into a catalog regardless of eligibility.
		await expect(itemCard(page, "asl-q1-inline").locator("video")).toHaveCount(
			0,
		);
	});

	test("keeps the English content it translates visible alongside the signing", async ({
		page,
	}) => {
		await gotoDemo(page, GRANTED_PATH);
		const card = itemCard(page, "asl-q1-inline");
		await expect(card.locator('[data-region="content"]')).toBeVisible();
		await expect(card.getByText(INLINE_PROMPT)).toBeVisible();
		await expect(
			card.getByText("Photosynthesis", { exact: true }),
		).toBeVisible();
	});
});

test.describe("sign-language region — layout and resize", () => {
	test("sits beside the item content rather than below it", async ({
		page,
	}) => {
		await gotoDemo(page, GRANTED_PATH);
		const card = itemCard(page, "asl-q1-inline");
		const content = await card.locator('[data-region="content"]').boundingBox();
		const media = await mediaRegion(page, "asl-q1-inline").boundingBox();
		expect(content).not.toBeNull();
		expect(media).not.toBeNull();
		// To the right of the content, and vertically overlapping it.
		expect(media!.x).toBeGreaterThan(content!.x);
		expect(media!.y).toBeLessThan(content!.y + content!.height);
	});

	test("divider is a keyboard-operable separator that resizes the region", async ({
		page,
	}) => {
		await gotoDemo(page, GRANTED_PATH);
		const card = itemCard(page, "asl-q1-inline");
		const divider = card.getByRole("separator", {
			name: "Resize question and media panels",
		});
		await expect(divider).toBeVisible();
		await expect(divider).toHaveAttribute("aria-orientation", "vertical");

		const before = Number(await divider.getAttribute("aria-valuenow"));
		const widthBefore = (await mediaRegion(
			page,
			"asl-q1-inline",
		).boundingBox())!.width;

		await divider.focus();
		// Left grows the region, which sits on the right.
		await page.keyboard.press("ArrowLeft");
		const after = Number(await divider.getAttribute("aria-valuenow"));
		expect(after).toBeGreaterThan(before);
		await expect
			.poll(
				async () =>
					(await mediaRegion(page, "asl-q1-inline").boundingBox())!.width,
			)
			.toBeGreaterThan(widthBefore);

		// End clamps to the minimum rather than collapsing the region.
		await page.keyboard.press("End");
		const min = Number(await divider.getAttribute("aria-valuemin"));
		expect(Number(await divider.getAttribute("aria-valuenow"))).toBe(min);
		expect(min).toBeGreaterThan(0);

		await page.keyboard.press("Home");
		const max = Number(await divider.getAttribute("aria-valuemax"));
		expect(Number(await divider.getAttribute("aria-valuenow"))).toBe(max);
	});
});
