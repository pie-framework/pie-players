import { expect, test } from "@playwright/test";

/**
 * The standalone item player's interface locale, end to end.
 *
 * A player mounted inside a section inherits the shell's stamp through the
 * light tree, and the section's interface-locale spec holds that path. This
 * spec covers the path only a standalone player takes: it is the outermost
 * chrome on the page — its error banner renders interface strings — so per
 * the adoption record it stamps its own custom-element host, and nothing
 * above it may be touched. The demo route is any delivery page with a
 * `locale` param; the page composes the host-side provider (bundled catalogs
 * first, the optional generated tier behind them) the element cannot know.
 *
 * The Arabic expectations are literals from the generated `ar` catalog, as
 * the Dutch ones are in the section player's interface-locale spec.
 */

const WIDE = { width: 1280, height: 900 };
const DELIVERY_PATH =
	"/demo/multiple-choice-radio-simple/delivery?mode=gather&role=student";

test.describe("standalone item player interface locale", () => {
	test("a requested locale stamps the chrome host and nothing else", async ({
		page,
	}) => {
		await page.setViewportSize(WIDE);
		await page.goto(`${DELIVERY_PATH}&locale=ar`, {
			waitUntil: "networkidle",
		});
		const contentRoot = page
			.locator("pie-item-player .pie-item-player")
			.first();
		await expect(contentRoot).toBeVisible({ timeout: 30_000 });

		// The chrome host: the stamp the standalone path owes.
		const host = page.locator("pie-item-player");
		await expect(host).toHaveAttribute("lang", "ar");
		await expect(host).toHaveAttribute("dir", "rtl");

		// The content root keeps the undeclared-content claim: no language is
		// invented, direction comes from the content itself.
		await expect(contentRoot).toHaveAttribute("lang", "");
		await expect(contentRoot).toHaveAttribute("dir", "auto");

		// An embedded player has no business writing the document root.
		await expect(page.locator("html")).not.toHaveAttribute("dir");
	});

	test("a host that passes no locale keeps the element's attributes as they were", async ({
		page,
	}) => {
		// Behaviour preservation: the stamp follows a requested locale only, so
		// every existing embedding — the vast majority — renders with the same
		// host attributes it always had. The content root's undeclared-content
		// default names no language at all when there is no interface locale to
		// derive one from, so it carries neither attribute here.
		await page.setViewportSize(WIDE);
		await page.goto(DELIVERY_PATH, { waitUntil: "networkidle" });
		const contentRoot = page
			.locator("pie-item-player .pie-item-player")
			.first();
		await expect(contentRoot).toBeVisible({ timeout: 30_000 });

		const host = page.locator("pie-item-player");
		await expect(host).not.toHaveAttribute("lang");
		await expect(host).not.toHaveAttribute("dir");
		await expect(contentRoot).not.toHaveAttribute("lang");
		await expect(contentRoot).not.toHaveAttribute("dir");
	});

	test("the localized error banner renders right-to-left under a requested locale", async ({
		page,
	}) => {
		await page.setViewportSize(WIDE);
		await page.goto(`${DELIVERY_PATH}&locale=ar`, {
			waitUntil: "networkidle",
		});
		const contentRoot = page
			.locator("pie-item-player .pie-item-player")
			.first();
		await expect(contentRoot).toBeVisible({ timeout: 30_000 });

		// Force the one localized chrome surface the happy path never shows: a
		// model without an element reference fails the config-contract check in
		// the load pipeline — deterministically, before any loader runs. The
		// imperative set sticks; the page only rewrites the props when its own
		// stores move.
		await page.evaluate(() => {
			const el = document.querySelector("pie-item-player");
			const cfg = { ...(el!.config as Record<string, unknown>) };
			cfg.models = [{ id: "probe" }];
			el!.config = cfg;
		});

		// The banner's heading is the catalog's own string, and the banner
		// inherits the chrome's right-to-left direction.
		const bannerHeading = page
			.locator("pie-item-player .pie-player-error h3")
			.first();
		await expect(bannerHeading).toBeVisible({ timeout: 30_000 });
		await expect(bannerHeading).toHaveText("خطأ في الإعداد");
		const direction = await page
			.locator("pie-item-player .pie-player-error")
			.first()
			.evaluate((el) => getComputedStyle(el).direction);
		expect(direction).toBe("rtl");
	});
});
