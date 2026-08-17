import { expect, test } from "@playwright/test";

/**
 * Interface locale, end to end.
 *
 * Unit tests cover the provider; this covers the wiring the provider cannot see:
 * that a `locale` attribute on the layout element reaches the toolkit, is
 * published on the runtime context, and re-renders the strings a learner and a
 * screen reader actually get.
 *
 * The Dutch expectations are literal on purpose. Asserting "not English" would
 * pass on a raw message key, which is the exact failure the fallback chain exists
 * to prevent.
 */
test.describe("section player interface locale", () => {
	test("renders English chrome when the host supplies no locale", async ({
		page,
	}) => {
		// The behaviour-preservation case. Under fixed lockstep patch-only
		// versioning this adoption reaches every host on their next install, so a
		// host that opts into nothing must see exactly what it saw before — not the
		// browser's locale, and not a message key.
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto("/tabbed-layout/tabbed", { waitUntil: "networkidle" });

		await expect(
			page.getByRole("tablist", { name: "Section content tabs" }),
		).toBeVisible();
		await expect(page.getByRole("tab", { name: "Passage" })).toBeVisible();
		await expect(page.getByRole("tab", { name: "Questions" })).toBeVisible();
	});

	test("a Dutch locale translates tabs, region labels and the toolbar", async ({
		page,
	}) => {
		const pageErrors: string[] = [];
		page.on("pageerror", (error) => {
			pageErrors.push(error.message);
		});
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto("/tabbed-layout/tabbed?locale=nl-NL", {
			waitUntil: "networkidle",
		});

		// The catalog is a dynamic import, so the first paint is English and the
		// Dutch strings arrive a tick later. Nothing here waits on a timer: the
		// assertion itself retries, which is also the proof that the context
		// republish reaches the tab labels.
		await expect(
			page.getByRole("tablist", { name: "Tabbladen van dit onderdeel" }),
		).toBeVisible();
		await expect(page.getByRole("tab", { name: "Tekst" })).toBeVisible();
		await expect(page.getByRole("tab", { name: "Vragen" })).toBeVisible();

		// Two further components, each resolving the context independently: the
		// passage card supplies the card heading, the shell supplies the tools
		// landmark. Both caught a real defect — a component that stores the provider
		// rather than the context has nothing to invalidate on, because a provider's
		// identity survives the catalog load, so its label stays on the English it
		// first rendered.
		await expect(
			page.getByRole("heading", { name: "Tekst", level: 2 }),
		).toBeVisible();
		await expect(
			page.getByRole("complementary", {
				name: "Hulpmiddelen voor dit onderdeel",
			}),
		).toBeAttached();

		expect(pageErrors).toEqual([]);
	});

	test("a toolbar button label follows the locale", async ({ page }) => {
		// A different resolution path from a component's own `t()`: the label comes
		// from `ToolRegistration.nameKey`, resolved by the registry through
		// `ToolbarContext.i18n`. The tabbed-layout demo configures no tools, so this
		// uses the route that does.
		const pageErrors: string[] = [];
		page.on("pageerror", (error) => {
			pageErrors.push(error.message);
		});
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto("/tts-ssml?mode=candidate&layout=splitpane&locale=nl-NL", {
			waitUntil: "networkidle",
		});

		await expect(
			page.getByRole("button", {
				name: "Thema, kleuren en contrast aanpassen",
			}),
		).toBeVisible();
		// And English is gone, not merely joined.
		await expect(
			page.getByRole("button", { name: "Theme, change colors and contrast" }),
		).toHaveCount(0);

		expect(pageErrors).toEqual([]);
	});

	test("POSIX and bare tags resolve to the same catalog", async ({ page }) => {
		// `nl_NL` is what the Learnosity transform emits and `nl` is what a browser
		// sends; both have to reach the `nl-NL` catalog we actually ship.
		await page.setViewportSize({ width: 1280, height: 900 });

		for (const tag of ["nl_NL", "nl"]) {
			await page.goto(`/tabbed-layout/tabbed?locale=${tag}`, {
				waitUntil: "networkidle",
			});
			await expect(page.getByRole("tab", { name: "Tekst" })).toBeVisible();
		}
	});

	test("an unshipped locale renders English rather than message keys", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto("/tabbed-layout/tabbed?locale=cy-GB", {
			waitUntil: "networkidle",
		});

		await expect(page.getByRole("tab", { name: "Passage" })).toBeVisible();
		// A leaked key would render as literal dotted text.
		await expect(page.getByText("player.passage", { exact: true })).toHaveCount(
			0,
		);
	});
});
