import { expect, test } from "@playwright/test";

/**
 * Interface locale, end to end.
 *
 * Unit tests cover the provider; this covers the wiring the provider cannot see:
 * that a `locale` attribute on the layout element reaches the toolkit, is
 * published on the runtime context, and re-renders the strings a learner and a
 * screen reader actually get.
 *
 * Every case runs against `/interface-locale`, the one demo that supplies a
 * locale. The others deliberately omit the attribute — they are the
 * behaviour-preservation fixture, so a stale `?locale=` carried into one of them
 * has to stay inert.
 *
 * The Dutch expectations are literal on purpose. Asserting "not English" would
 * pass on a raw message key, which is the exact failure the fallback chain exists
 * to prevent.
 */

/** Wide enough that the demo menu bar does not collapse behind its toggle. */
const WIDE = { width: 1500, height: 950 };

test.describe("section player interface locale", () => {
	test("renders English chrome when the host supplies no locale", async ({
		page,
	}) => {
		// Under fixed lockstep patch-only versioning this adoption reaches every host
		// on their next install, so a host that opts into nothing must see exactly
		// what it saw before — not the browser's locale, and not a message key.
		await page.setViewportSize(WIDE);
		await page.goto("/interface-locale", { waitUntil: "networkidle" });

		await expect(
			page.getByRole("heading", { name: "Passage", level: 2 }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Theme, change colors and contrast" }),
		).toBeVisible();
	});

	test("a Dutch locale translates card headings, region labels and the toolbar", async ({
		page,
	}) => {
		const pageErrors: string[] = [];
		page.on("pageerror", (error) => {
			pageErrors.push(error.message);
		});
		await page.setViewportSize(WIDE);
		await page.goto("/interface-locale?locale=nl-NL", {
			waitUntil: "networkidle",
		});

		// The catalog is a dynamic import, so the first paint is English and the
		// Dutch strings arrive a tick later. Nothing here waits on a timer: the
		// assertion itself retries, which is also the proof that the context
		// republish reaches the rendered labels.
		await expect(
			page.getByRole("heading", { name: "Tekst", level: 2 }),
		).toBeVisible();

		// Two further components, each resolving the context independently: the
		// passage card supplies the card heading, the shell supplies the tools
		// landmark. Both caught a real defect — a component that stores the provider
		// rather than the context has nothing to invalidate on, because a provider's
		// identity survives the catalog load, so its label stays on the English it
		// first rendered.
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
		// `ToolbarContext.i18n`.
		const pageErrors: string[] = [];
		page.on("pageerror", (error) => {
			pageErrors.push(error.message);
		});
		await page.setViewportSize(WIDE);
		await page.goto("/interface-locale?locale=nl-NL", {
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

	test("an open tool window and its own chrome follow the locale", async ({
		page,
	}) => {
		// The regression this case exists for: a tool window mounts at
		// `document.body`, so the tool inside it is outside the toolkit's DOM subtree
		// and its context request reaches no provider unless the toolbar re-publishes
		// on the shell. It resolved the English-only default instead and rendered
		// "Selector / Point / Line / Delete" under a Dutch toolbar.
		//
		// The shell's own header is the other half: it is imperative DOM, so its
		// labels move only when something re-reads the catalog for them.
		const pageErrors: string[] = [];
		page.on("pageerror", (error) => {
			pageErrors.push(error.message);
		});
		await page.setViewportSize(WIDE);
		await page.goto("/interface-locale?locale=nl-NL", {
			waitUntil: "networkidle",
		});

		await page.getByRole("button", { name: "Grafiek, assenstelsel" }).click();

		const shell = page.locator('[data-pie-tool-shell="graph"]');
		await expect(shell).toBeVisible();
		// The window title comes from the registration's `nameKey`, not its English
		// `name` field.
		await expect(shell.getByText("Grafiek", { exact: true })).toBeVisible();
		await expect(
			shell.getByRole("button", { name: "Hulpmiddel naar links verplaatsen" }),
		).toBeVisible();
		await expect(
			shell.getByRole("button", { name: "Hulpmiddel sluiten" }),
		).toBeVisible();

		// And the tool's own strings, resolved from the context the shell publishes.
		await expect(
			shell.getByRole("button", { name: "Selecteren" }),
		).toBeVisible();
		await expect(
			shell.getByRole("button", { name: "Verwijderen" }),
		).toBeVisible();
		await expect(shell.getByRole("button", { name: "Selector" })).toHaveCount(0);

		expect(pageErrors).toEqual([]);
	});

	test("POSIX and bare tags resolve to the same catalog", async ({ page }) => {
		// `nl_NL` is what the Learnosity transform emits and `nl` is what a browser
		// sends; both have to reach the `nl-NL` catalog we actually ship.
		await page.setViewportSize(WIDE);

		for (const tag of ["nl_NL", "nl"]) {
			await page.goto(`/interface-locale?locale=${tag}`, {
				waitUntil: "networkidle",
			});
			await expect(
				page.getByRole("heading", { name: "Tekst", level: 2 }),
			).toBeVisible();
		}
	});

	test("the demo locale switcher moves chrome on a live prop change", async ({
		page,
	}) => {
		// The switcher rewrites the `locale` search param through a client-side
		// `goto`, so the layout element's `locale` prop changes on a player that is
		// already mounted. That is the path a host's runtime locale change takes,
		// and the one a full reload would not exercise: the label has to move on the
		// context republish alone.
		const pageErrors: string[] = [];
		page.on("pageerror", (error) => {
			pageErrors.push(error.message);
		});
		await page.setViewportSize(WIDE);
		await page.goto("/interface-locale", { waitUntil: "networkidle" });

		const themeButton = page.getByRole("button", {
			name: "Theme, change colors and contrast",
		});
		await expect(themeButton).toBeVisible();

		const localeSelect = page.getByTestId("demo-locale-select");
		await expect(localeSelect).toBeVisible();
		await localeSelect.selectOption("nl-NL");

		await expect(
			page.getByRole("button", {
				name: "Thema, kleuren en contrast aanpassen",
			}),
		).toBeVisible();
		await expect(themeButton).toHaveCount(0);
		// The choice is in the URL, so the demo stays linkable in that language.
		expect(new URL(page.url()).searchParams.get("locale")).toBe("nl-NL");

		// And back, which is the case a one-way `setLocale` would fail.
		await localeSelect.selectOption("");
		await expect(themeButton).toBeVisible();
		expect(new URL(page.url()).searchParams.get("locale")).toBeNull();

		expect(pageErrors).toEqual([]);
	});

	test("an unshipped locale renders English rather than message keys", async ({
		page,
	}) => {
		// `zz` names no catalog in the bundled or the generated tier — chosen
		// over `cy-GB` and other real languages so the wave of generated
		// catalogs cannot turn this into a translation test.
		await page.setViewportSize(WIDE);
		await page.goto("/interface-locale?locale=zz", {
			waitUntil: "networkidle",
		});

		await expect(
			page.getByRole("heading", { name: "Passage", level: 2 }),
		).toBeVisible();
		// A leaked key would render as literal dotted text.
		await expect(page.getByText("player.passage", { exact: true })).toHaveCount(
			0,
		);
	});

	test("a locale from the generated tier renders through the host's provider", async ({
		page,
	}) => {
		// `th-TH` ships only in `@pie-players/pie-i18n-generated`, which the demo
		// reaches through `runtime.i18n`: the composition the generated tier's
		// README shows, handed to the player instead of built by it. Both
		// expectations are literals from that catalog, for the same reason the
		// Dutch ones are.
		const pageErrors: string[] = [];
		page.on("pageerror", (error) => {
			pageErrors.push(error.message);
		});
		await page.setViewportSize(WIDE);
		await page.goto("/interface-locale?locale=th-TH", {
			waitUntil: "networkidle",
		});

		await expect(
			page.getByRole("heading", { name: "บทอ่าน", level: 2 }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "ธีม เปลี่ยนสีและความเปรียบต่าง" }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Passage", level: 2 }),
		).toHaveCount(0);

		expect(pageErrors).toEqual([]);
	});

	test("the pseudo-locales render through the provider's host messages", async ({
		page,
	}) => {
		// `en-XA` and `ar-XB` are registered on the demo's provider through
		// `customMessages`, which resolve ahead of any catalog. The bracketed,
		// padded text is the point: expansion and externalization are visible in
		// the chrome, and anything still reading plain English was never catalog
		// text.
		await page.setViewportSize(WIDE);

		for (const tag of ["en-XA", "ar-XB"]) {
			await page.goto(`/interface-locale?locale=${tag}`, {
				waitUntil: "networkidle",
			});
			const heading = page.getByRole("heading", { level: 2 }).first();
			await expect(heading).toBeVisible();
			await expect(heading).toHaveText(/^\[/);
			await expect(
				page.getByRole("heading", { name: "Passage", level: 2 }),
			).toHaveCount(0);
			await expect(
				page.getByText("player.passage", { exact: true }),
			).toHaveCount(0);
		}
	});

	test("the chrome stamps the interface locale's lang and dir on its own subtree", async ({
		page,
	}) => {
		// `lang` resolves along the light tree and `direction` inherits through
		// it, so the stamp sits on the shell host — the light-tree ancestor of
		// every pane, card and item player — with the toolkit host, the
		// navigation live region beside it, and each item player carrying their
		// own. The document root is never touched: an embedded player has no
		// business writing it. `ar-XB` makes the `dir` half observable without
		// an Arabic catalog.
		await page.setViewportSize(WIDE);
		await page.goto("/interface-locale?locale=ar-XB", {
			waitUntil: "networkidle",
		});

		const shell = page.locator("pie-section-player-shell");
		await expect(shell).toHaveAttribute("lang", "ar-XB");
		await expect(shell).toHaveAttribute("dir", "rtl");
		await expect(page.locator("pie-assessment-toolkit")).toHaveAttribute(
			"dir",
			"rtl",
		);
		const navStatus = page.locator(".pie-section-player-nav-status");
		await expect(navStatus).toHaveAttribute("lang", "ar-XB");
		await expect(navStatus).toHaveAttribute("dir", "rtl");
		const itemPlayerRoot = page.locator("pie-item-player > .pie-item-player");
		await expect(itemPlayerRoot.first()).toHaveAttribute("lang", "ar-XB");
		await expect(itemPlayerRoot.first()).toHaveAttribute("dir", "rtl");
		await expect(
			page.locator("pie-item-toolbar .item-toolbar").first(),
		).toHaveAttribute("dir", "rtl");
		const root = page.locator("html");
		await expect(root).not.toHaveAttribute("dir");
		const rootLang = await root.getAttribute("lang");

		// A live locale switch moves the stamps with the provider.
		await page.getByTestId("demo-locale-select").selectOption("nl-NL");
		await expect(shell).toHaveAttribute("lang", "nl-NL");
		await expect(shell).toHaveAttribute("dir", "ltr");
		await expect(navStatus).toHaveAttribute("lang", "nl-NL");
		await expect(root).not.toHaveAttribute("dir");
		expect(await root.getAttribute("lang")).toBe(rootLang);
	});

	test("a stale locale param is inert on a demo that supplies no locale", async ({
		page,
	}) => {
		// The switcher is scoped to one demo precisely so a tag chosen there cannot
		// follow the reader. A link carrying the param into another demo has to
		// render the English that demo is there to show.
		await page.setViewportSize(WIDE);
		await page.goto("/question-passage?locale=nl-NL", {
			waitUntil: "networkidle",
		});

		await expect(
			page.getByRole("heading", { name: "Passage", level: 2 }),
		).toBeVisible();
		await expect(page.getByTestId("demo-locale-select")).toHaveCount(0);
	});

	test("the item players answer interfaceLocaleContext with the section's locale", async ({
		page,
	}) => {
		// The host-neutral channel the PIE elements read. The request is
		// dispatched from inside a mounted item player, as an element's bundled
		// copy of `@pie-players/pie-context` would, and the nearest answer is the
		// item player's — whose provider is the section's, forwarded.
		await page.setViewportSize(WIDE);
		await page.goto("/interface-locale?locale=nl-NL", {
			waitUntil: "networkidle",
		});
		await expect(
			page.getByRole("heading", { name: "Tekst", level: 2 }),
		).toBeVisible();

		const content = page.locator("pie-item-player .pie-item-player").first();
		const seen = await content.evaluate((node) => {
			const values: unknown[] = [];
			const from = node.firstElementChild ?? node;
			from.dispatchEvent(
				Object.assign(
					new Event("context-request", { bubbles: true, composed: true }),
					{
						context: Symbol.for("pie.interfaceLocale"),
						contextTarget: from,
						subscribe: false,
						callback: (value: unknown) => values.push(value),
					},
				),
			);
			return values;
		});

		expect(seen).toEqual([{ locale: "nl-NL", direction: "ltr" }]);
	});
});
