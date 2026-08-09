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
 * The demo bundles a public-domain ASL recording (see
 * `apps/section-demos/static/demo-assets/sign-language/README.md`), so playback
 * is assertable here too: a region that renders a `<video>` no browser can decode
 * looks identical to a working one in every assertion that stops at the DOM.
 */

const CLIP_SRC = "/demo-assets/sign-language/cdc-asl-handwashing.webm";

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
			CLIP_SRC,
		);
	});

	test("decodes and plays the bundled clip", async ({ page }) => {
		await gotoDemo(page, GRANTED_PATH);
		const video = mediaRegion(page, "asl-q1-inline").locator("video");
		await expect(video).toBeVisible();

		// The region sets preload="metadata", so readyState climbs to HAVE_METADATA
		// on its own. Anything less means the browser could not decode what we
		// shipped — wrong container, a codec this Chromium build lacks, or a 404 —
		// and no assertion that stops at the DOM would notice.
		await expect
			.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState), {
				timeout: 30_000,
				message: "video never reached HAVE_METADATA",
			})
			.toBeGreaterThanOrEqual(1);

		const state = await video.evaluate((el: HTMLVideoElement) => ({
			duration: el.duration,
			error: el.error?.code ?? null,
		}));
		expect(state.error).toBeNull();
		expect(state.duration).toBeGreaterThan(0);

		// The element is rendered muted, so programmatic play is not blocked by
		// autoplay policy and needs no synthesized gesture.
		await video.evaluate((el: HTMLVideoElement) => el.play());
		await expect
			.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime), {
				timeout: 15_000,
				message: "playback did not advance",
			})
			.toBeGreaterThan(0);
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

test.describe("sign-language region — reactive stability", () => {
	/**
	 * A guard, not a feature test.
	 *
	 * Resolving a catalog card is driven by a signal from the resolver, and the
	 * resolver's catalogs are registered by the item shell — so a reader that
	 * invalidates on every signal can drive the shell to re-register, which signals
	 * again. That loop shipped once: a thousand register/unregister rounds per item,
	 * ending in Svelte aborting the update at its depth limit with the DOM
	 * half-applied. Every assertion in this file passed while it was happening,
	 * because the region and the divider were in the DOM — only the classes and the
	 * grid columns the aborted update never reached were wrong.
	 *
	 * So this asserts the shape of the *update*, not of the output: each item
	 * registers about once, and the page raises no reactive-loop error. Both are
	 * invisible to any assertion that only reads the finished DOM.
	 */
	test("resolves without driving the item shell into a re-registration loop", async ({
		page,
	}) => {
		await page.addInitScript(() => {
			const counts = { register: 0, unregister: 0 };
			(
				window as Window & { __pieRegistrationCounts?: typeof counts }
			).__pieRegistrationCounts = counts;
			window.addEventListener("pie-register", () => counts.register++, true);
			window.addEventListener(
				"pie-unregister",
				() => counts.unregister++,
				true,
			);
		});
		const pageErrors: string[] = [];
		page.on("pageerror", (error) => pageErrors.push(error.message));

		await gotoDemo(page, GRANTED_PATH);
		await expect(mediaRegion(page, "asl-q1-inline")).toBeVisible();
		// Let any loop run: the depth limit is reached in well under a second, so a
		// settled page stays settled while an unsettled one has already blown up.
		await page.waitForTimeout(3_000);

		const counts = await page.evaluate(
			() =>
				(
					window as Window & {
						__pieRegistrationCounts?: { register: number; unregister: number };
					}
				).__pieRegistrationCounts ?? { register: 0, unregister: 0 },
		);
		const shellCount = await page.locator("pie-item-shell").count();
		expect(shellCount).toBeGreaterThan(0);
		// One per shell, with headroom for a legitimate re-register when an item's
		// content is substituted; a loop overshoots this by three orders of magnitude.
		expect(counts.register).toBeLessThanOrEqual(shellCount * 2);
		// A shell that is still mounted should not have unregistered at all.
		expect(counts.unregister).toBe(0);
		expect(
			pageErrors.filter((message) =>
				message.includes("effect_update_depth_exceeded"),
			),
		).toEqual([]);
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
