import { expect, test } from "@playwright/test";

/**
 * The banner carries a fixed red encoding, and the point of collapsing it is that
 * a learner on an accessible palette does not get a pink box in the middle of the
 * palette they chose. So this measures the colours the browser actually paints,
 * per scheme, rather than the declarations: the ink against the banner's own fill,
 * and the edge against that fill, since the fill is a tint of the page and the
 * edge is what makes the banner read as one.
 */
const SCHEME_IDS = [
	"black-on-white",
	"white-on-black",
	"rose-on-green",
	"yellow-on-blue",
	"black-on-rose",
	"light-gray-on-dark-gray",
	"grey-on-light-grey",
	"purple-on-light-green",
	"black-on-violet",
	"yellow-on-navy",
];

test.describe("item player error banner under a colour scheme", () => {
	test("folds its fixed red into every built-in scheme", async ({ page }) => {
		await page.goto("/demo/multiple-choice-radio-simple/delivery", {
			waitUntil: "domcontentloaded",
		});

		// An empty config fails `validate-config` on the spot, which is the cheapest
		// route to the branch a learner meets when an item cannot load. A bad bundle
		// URL is not: the player treats that as a build in progress and retries for
		// two minutes before it ever paints the banner.
		await page.evaluate(async () => {
			const themeHost = document.createElement("pie-theme");
			themeHost.setAttribute("scope", "document");
			themeHost.setAttribute("theme", "light");
			document.body.prepend(themeHost);

			const fixture = document.createElement("div");
			fixture.id = "pie-error-banner-fixture";
			const player = document.createElement("pie-item-player");
			(player as unknown as { config: unknown }).config = {};
			fixture.append(player);
			document.body.append(fixture);
		});

		const banner = page.locator("#pie-error-banner-fixture .pie-player-error");
		await expect(banner).toBeVisible({ timeout: 30_000 });

		const fills = new Set<string>();
		for (const schemeId of SCHEME_IDS) {
			await page.evaluate(async (id) => {
				const host =
					document.querySelector('pie-theme[scope="document"]') ||
					document.querySelector("pie-theme");
				host?.setAttribute("scheme", id);
				await new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve)),
				);
			}, schemeId);
			await page.waitForTimeout(100);

			const measured = await banner.evaluate((element) => {
				const canvas = document.createElement("canvas");
				canvas.width = 1;
				canvas.height = 1;
				const context = canvas.getContext("2d", { willReadFrequently: true });
				if (!context) throw new Error("Canvas color parser unavailable");
				const luminance = (value: string) => {
					context.clearRect(0, 0, 1, 1);
					context.fillStyle = "rgba(1, 2, 3, 0.5)";
					context.fillStyle = value;
					context.fillRect(0, 0, 1, 1);
					const channels = [
						...context.getImageData(0, 0, 1, 1).data.slice(0, 3),
					].map((channel) => {
						const normalized = channel / 255;
						return normalized <= 0.04045
							? normalized / 12.92
							: ((normalized + 0.055) / 1.055) ** 2.4;
					});
					return (
						0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
					);
				};
				const ratio = (foreground: string, background: string) => {
					const a = luminance(foreground);
					const b = luminance(background);
					return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
				};
				const style = getComputedStyle(element);
				return {
					ink: style.color,
					surface: style.backgroundColor,
					edge: style.borderTopColor,
					text: ratio(style.color, style.backgroundColor),
					edgeAgainstSurface: ratio(
						style.borderTopColor,
						style.backgroundColor,
					),
				};
			});

			fills.add(measured.surface);
			expect(
				measured.text,
				`${schemeId} banner text (${measured.ink} on ${measured.surface})`,
			).toBeGreaterThanOrEqual(4.5);
			expect(
				measured.edgeAgainstSurface,
				`${schemeId} banner edge (${measured.edge} on ${measured.surface})`,
			).toBeGreaterThanOrEqual(3);
		}

		// Pinned, every scheme resolved to the same #ffebee. More than one fill is
		// what says the collapse is happening at all, rather than the ratios passing
		// on a literal that happens to be light.
		expect(
			fills.size,
			`distinct banner fills across schemes: ${[...fills]}`,
		).toBeGreaterThan(1);
	});
});
