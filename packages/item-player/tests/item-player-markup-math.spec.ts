import { expect, type Locator, type Page, test } from "@playwright/test";

// The demo's multiple-choice typesets its own choices. The player mounted
// beside it carries the same model in markup of its own that holds math: TeX
// inline and display, MathML, and TeX in text that shares a parent with the
// element.
const DEMO_ID = "multiple-choice-math-algebra-quadratic";
const ELEMENT = '[id="5"]';
const MARKUP = String.raw`<p class="stem">Solve \(ax^2 + bx + c = 0\) for \(x\).</p><div class="beside">Given \(a \neq 0\): <multiple-choice id="5"></multiple-choice> then \(x_1 x_2 = \frac{c}{a}\).</div><p class="display">\[x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}\]</p><p class="mathml"><math><msqrt><mi>y</mi></msqrt></math></p>`;

async function openDemo(page: Page, strategy: string) {
	await page.goto(
		`/demo/${DEMO_ID}/delivery?mode=gather&role=student&player=${strategy}`,
		{ waitUntil: "domcontentloaded" },
	);
	const demo = page.locator("pie-item-player").first();
	await expect(demo.locator("mjx-container").first()).toBeVisible({
		timeout: 30_000,
	});
	return demo;
}

async function mountBeside(page: Page, strategy: string) {
	await page.evaluate(
		({ markup, strategy }) => {
			const source = document.querySelector("pie-item-player") as any;
			const player = document.createElement("pie-item-player") as any;
			player.id = "markup-math";
			player.strategy = strategy;
			player.env = { mode: "gather", role: "student" };
			player.session = { id: "markup-math", data: [] };
			player.config = { ...source.config, markup };
			document.body.appendChild(player);
		},
		{ markup: MARKUP, strategy },
	);
	return page.locator("#markup-math");
}

/** The markup's own math in `block`: what was typeset, and what is left as text. */
function markupMath(block: Locator) {
	return block.evaluate((node, element) => {
		const typeset = [...node.querySelectorAll("mjx-container")].filter(
			(container) =>
				!container.closest(element) &&
				!container.parentElement?.closest("mjx-container"),
		);
		const copy = node.cloneNode(true) as Element;
		for (const owned of copy.querySelectorAll(`mjx-container, ${element}`)) {
			owned.remove();
		}
		return { typeset: typeset.length, text: copy.textContent ?? "" };
	}, ELEMENT);
}

test("iife typesets math in the item's own markup", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	const demo = await openDemo(page, "iife");
	const player = await mountBeside(page, "iife");
	const element = player.locator(ELEMENT);
	await expect(element.locator("mjx-container").first()).toBeVisible({
		timeout: 30_000,
	});

	const blocks = { ".stem": 2, ".beside": 2, ".display": 1, ".mathml": 1 };
	for (const [selector, count] of Object.entries(blocks)) {
		const block = player.locator(selector);
		await expect
			.poll(async () => (await markupMath(block)).typeset, {
				message: `math typeset in ${selector}`,
			})
			.toBe(count);
		expect((await markupMath(block)).text).not.toMatch(/\\[([]|\\frac/);
	}

	// The element's own math is typeset once, as it is in the demo's item.
	const reference = demo.locator(`${ELEMENT} mjx-container`);
	await expect
		.poll(
			async () =>
				(await element.locator("mjx-container").count()) -
				(await reference.count()),
		)
		.toBe(0);
	await expect(
		player.locator(
			"mjx-container mjx-container, mjx-assistive-mml mjx-container",
		),
	).toHaveCount(0);
	expect(errors).toEqual([]);
});

// ESM elements render with the page's renderer when the host installed one,
// and the markup's math goes to it too: one root per block of markup, and none
// holding the element.
for (const strategy of ["esm", "preloaded"] as const) {
	test(`${strategy} hands the item's own markup to the host's math renderer`, async ({
		page,
	}) => {
		const errors: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));
		await openDemo(page, strategy);
		await page.evaluate(() => {
			const rendered: Element[] = [];
			(window as any).__rendered = rendered;
			(window as any)["@pie-lib/math-rendering"] = {
				renderMath: (root: Element) => {
					rendered.push(root);
				},
			};
		});
		const player = await mountBeside(page, strategy);
		await expect(player.locator(ELEMENT)).toBeAttached({ timeout: 30_000 });

		const markupRoots = () =>
			page.evaluate((selector) => {
				const element = document.querySelector(`#markup-math ${selector}`);
				return ((window as any).__rendered as Element[])
					.filter((root) => root.closest("#markup-math"))
					.filter((root) => !element?.contains(root))
					.map((root) => ({
						block: root.closest("p, div.beside")?.className ?? "",
						holdsElement: element ? root.contains(element) : false,
					}));
			}, ELEMENT);
		await expect
			.poll(async () => (await markupRoots()).length, {
				message: "markup roots rendered",
			})
			.toBe(5);
		const roots = await markupRoots();
		expect(roots.map((root) => root.block).sort()).toEqual([
			"beside",
			"beside",
			"display",
			"mathml",
			"stem",
		]);
		expect(roots.filter((root) => root.holdsElement)).toEqual([]);
		expect(errors).toEqual([]);
	});
}
