import { expect, test, type Page } from "@playwright/test";

/**
 * PIE-881 integration proof: Learnosity → pie-api-aws transform → PIE item →
 * pie-players render.
 *
 * The sibling spec (`section-player-sign-language-region.spec.ts`) proves the
 * region works against content authored for the demo. What this proves is the
 * thing no single repo can prove alone: that the item an *importer* actually
 * writes resolves, gates and plays. The item under test is the unmodified output
 * of `mapLearnosityItemToPieItem` — nothing here was hand-authored to match the
 * assertions, which is the whole point, since a hand-written fixture only proves
 * we can write the shape we already believe in.
 *
 * The source Learnosity item is synthetic and its signing clip is a public-domain
 * CDC recording, so both the fixture and this spec can be committed. The same
 * transform is covered against a real bank item in pie-api-aws, where the item
 * content can stay.
 *
 * Four properties of the import are load bearing and each is checked:
 *   1. the signing video is carried as a catalog card, docked to the item;
 *   2. it is *not* left in the prompt, where it would render to every learner
 *      ungated — the accommodation model forbids that;
 *   3. the written prompt it accompanies survives intact beside it;
 *   4. it disappears entirely when policy does not grant signing.
 */

const GRANTED_PATH =
	"/sign-language?page=signing-granted&mode=candidate&layout=splitpane";
const NOT_GRANTED_PATH =
	"/sign-language?page=signing-not-granted&mode=candidate&layout=splitpane";

/**
 * The section item ref's identifier. The item's own PIE id is the Learnosity
 * reference verbatim (`asl-demo-scrub-time_v1.0`); the section player keys its
 * cards on the ref identifier, which is what the demo wrapper supplies.
 */
const IMPORTED_ITEM_ID = "asl-imported-demo";
/** Learnosity's own `data-simplefeature_id`, carried byte-for-byte as the catalog id. */
const CATALOG_ID = "00000000-0000-4000-8000-000000000881";
const VIDEO_URL = "/demo-assets/sign-language/cdc-asl-handwashing.webm";
const IMPORTED_PROMPT = "How many seconds does she spend scrubbing in one day?";
const INLINE_PROMPT =
	"A plant absorbs carbon dioxide and releases oxygen. What process is this?";

async function gotoDemo(page: Page, path: string) {
	await page.goto(path, { waitUntil: "networkidle" });
	await page.waitForSelector("pie-section-player-splitpane", {
		state: "attached",
	});
	await expect(page.getByText(INLINE_PROMPT)).toBeVisible({ timeout: 30_000 });
	// The imported item is late in the section and mounts after the earlier ones;
	// scroll it in so its element bundle finishes rendering before assertions.
	await itemCard(page).scrollIntoViewIfNeeded();
	await expect(page.getByText(IMPORTED_PROMPT)).toBeVisible({
		timeout: 60_000,
	});
}

function itemCard(page: Page) {
	// The shell, not the inner content card: both carry the id, and the media
	// region is a sibling of the content card inside the shell.
	return page.locator(
		`pie-item-shell[data-canonical-item-id="${IMPORTED_ITEM_ID}"]`,
	);
}

function mediaRegion(page: Page) {
	return itemCard(page).locator('[data-region="media"]');
}

test.describe("PIE-881 — imported Learnosity ASL item", () => {
	test("renders the signed alternate the importer wrote", async ({ page }) => {
		await gotoDemo(page, GRANTED_PATH);
		const region = mediaRegion(page);
		await expect(region).toBeVisible();

		const video = region.locator("video");
		await expect(video).toBeVisible();
		// The source is the asset URL the transform carried through, unmodified.
		await expect(video.locator("source")).toHaveAttribute("src", VIDEO_URL);

		await itemCard(page).screenshot({
			path: "test-results/pie881-imported-asl-render.png",
		});
	});

	test("plays the clip the import points at", async ({ page }) => {
		await gotoDemo(page, GRANTED_PATH);
		const video = mediaRegion(page).locator("video");
		await expect(video).toBeVisible();

		// readyState >= 1 (HAVE_METADATA) means the browser fetched and decoded
		// enough of the asset to play it — not merely that a URL was rendered.
		await expect
			.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState), {
				timeout: 60_000,
				message: "video never loaded metadata",
			})
			.toBeGreaterThanOrEqual(1);

		const state = await video.evaluate((el: HTMLVideoElement) => ({
			readyState: el.readyState,
			duration: el.duration,
			error: el.error?.code ?? null,
		}));
		expect(state.error).toBeNull();
		expect(state.duration).toBeGreaterThan(0);

		await video.evaluate((el: HTMLVideoElement) => el.play());
		await expect
			.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime), {
				timeout: 15_000,
				message: "playback did not advance",
			})
			.toBeGreaterThan(0);
	});

	test("does not leave the signing video in the prompt", async ({ page }) => {
		await gotoDemo(page, GRANTED_PATH);
		// The transform replaced Learnosity's inline feature span with a hidden
		// docking node, so the item content itself carries no video and no
		// learnosity-feature markup.
		const contentHtml = await itemCard(page)
			.locator('[data-region="content"]')
			.innerHTML();
		expect(contentHtml).not.toContain("learnosity-feature");
		expect(contentHtml).not.toContain(VIDEO_URL);
		expect(contentHtml).not.toContain("videoplayer");
	});

	test("docks the card to the content node via data-catalog-idref", async ({
		page,
	}) => {
		await gotoDemo(page, GRANTED_PATH);
		await expect(
			itemCard(page).locator(`[data-catalog-idref="${CATALOG_ID}"]`),
		).toHaveCount(1);
	});

	test("keeps the written prompt visible alongside the signing", async ({
		page,
	}) => {
		await gotoDemo(page, GRANTED_PATH);
		await expect(mediaRegion(page).locator("video")).toBeVisible();
		// Signing coexists with written text rather than replacing it.
		await expect(page.getByText(IMPORTED_PROMPT)).toBeVisible();
	});

	test("shows nothing when policy does not grant signing", async ({ page }) => {
		await gotoDemo(page, NOT_GRANTED_PATH);
		await expect(mediaRegion(page)).toHaveCount(0);
		// And the video must not fall back to being visible item content.
		const contentHtml = await itemCard(page)
			.locator('[data-region="content"]')
			.innerHTML();
		expect(contentHtml).not.toContain(VIDEO_URL);
	});
});
