import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { type Page, expect, test } from "@playwright/test";

/**
 * Pins, in a real browser engine, the two facts the post-render wrap pass in
 * `PieItemPlayer.svelte` relies on to avoid retriggering itself.
 *
 * That pass observes the item subtree with `{ childList: true, subtree: true }`
 * and re-runs `wrapOverwide{Images,Tables}InElement` — each a `querySelectorAll`
 * over the whole subtree — when content lands. The wrap inserts elements, so it
 * queues records of its own; it used to re-run on them and converge only because
 * the wrap is idempotent, which makes a PIE element that re-renders over its own
 * subtree and drops the wrapper a sustained wrap → mutation → wrap loop.
 *
 * Both facts are about record shape and delivery, which is exactly what a DOM
 * emulator is not authority on:
 *
 * - Every record the wrap queues satisfies `isOverwide{Image,Table}WrapMutation`,
 *   so the observer can ignore the batch outright.
 * - Those records arrive in a single callback invocation, which is what lets the
 *   pass arm its "expect my own records next" flag once per pass.
 *
 * `tests/wrap-overwide-mutations.test.ts` covers the predicate's foreign cases
 * under happy-dom, where deterministic `takeRecords()` is enough.
 *
 * Bundles the *compiled* `dist/security/wrap-overwide-{images,tables}.js` for
 * the same reason as `sanitize-item-markup.spec.ts`: the source uses `./foo.js`
 * specifiers for sibling `.ts` files, which resolve only after `tsc` has emitted.
 * Requires `bun run build:e2e:players-shared`, wired into
 * `test:e2e:players-shared` in the root package.json.
 */

const PACKAGE_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const IMAGES_ENTRY = path.join(
	PACKAGE_ROOT,
	"dist/security/wrap-overwide-images.js",
);
const TABLES_ENTRY = path.join(
	PACKAGE_ROOT,
	"dist/security/wrap-overwide-tables.js",
);

let bundledCode: string;

test.beforeAll(async () => {
	for (const entry of [IMAGES_ENTRY, TABLES_ENTRY]) {
		if (!existsSync(entry)) {
			throw new Error(
				`[wrap-overwide-mutations.spec] ${entry} does not exist. Run "bun run build:e2e:players-shared" (or "bun run build") before this suite.`,
			);
		}
	}

	// A stdin entry rather than the security barrel: the barrel pulls DOMPurify
	// in behind it, and nothing here exercises the sanitizer.
	const result = await esbuild.build({
		stdin: {
			contents: `
				export {
					isOverwideImageWrapMutation,
					wrapOverwideImagesInElement,
				} from ${JSON.stringify(IMAGES_ENTRY)};
				export {
					isOverwideTableWrapMutation,
					wrapOverwideTablesInElement,
				} from ${JSON.stringify(TABLES_ENTRY)};
			`,
			resolveDir: PACKAGE_ROOT,
			sourcefile: "wrap-overwide-under-test.js",
		},
		bundle: true,
		platform: "browser",
		format: "iife",
		globalName: "PieOverwideUnderTest",
		target: "es2020",
		write: false,
	});

	bundledCode = result.outputFiles[0].text;
});

async function loadWrappers(page: Page) {
	await page.setContent("<!doctype html><html><body></body></html>");
	await page.addScriptTag({ content: bundledCode });
}

/** The bundle's surface, as it appears on `window` inside the page. */
interface OverwideUnderTest {
	isOverwideImageWrapMutation: (record: MutationRecord) => boolean;
	isOverwideTableWrapMutation: (record: MutationRecord) => boolean;
	wrapOverwideImagesInElement: (root: Element) => number;
	wrapOverwideTablesInElement: (root: Element) => number;
}

declare global {
	interface Window {
		PieOverwideUnderTest: OverwideUnderTest;
	}
}

interface ObservedWrap {
	wrapped: number;
	/** One entry per observer callback; one inner entry per record. */
	batches: boolean[][];
}

/**
 * Wrap `html` under a fresh root while an observer records what the wrap
 * queues, classifying each record as this code's own output or foreign.
 */
function observeWrap(page: Page, html: string): Promise<ObservedWrap> {
	return page.evaluate(async (markup) => {
		const {
			isOverwideImageWrapMutation,
			isOverwideTableWrapMutation,
			wrapOverwideImagesInElement,
			wrapOverwideTablesInElement,
		} = window.PieOverwideUnderTest;

		const root = document.createElement("div");
		root.innerHTML = markup;
		document.body.appendChild(root);

		const batches: boolean[][] = [];
		const observer = new MutationObserver((records) => {
			batches.push(
				records.map(
					(record) =>
						isOverwideImageWrapMutation(record) ||
						isOverwideTableWrapMutation(record),
				),
			);
		});
		observer.observe(root, { childList: true, subtree: true });

		const wrapped =
			wrapOverwideImagesInElement(root) + wrapOverwideTablesInElement(root);
		await new Promise((resolve) => setTimeout(resolve, 50));
		observer.disconnect();

		return { wrapped, batches };
	}, html);
}

test.describe("post-render wrap pass: mutation records it queues", () => {
	test("an image wrap queues only records it recognizes as its own", async ({
		page,
	}) => {
		await loadWrappers(page);
		const { wrapped, batches } = await observeWrap(
			page,
			'<p>See:</p><img src="/x.png" alt="cell">',
		);
		expect(wrapped).toBe(1);
		// Single callback invocation: what lets the pass arm its flag once.
		expect(batches).toHaveLength(1);
		expect(batches[0].length).toBeGreaterThan(0);
		expect(batches[0].every(Boolean)).toBe(true);
	});

	test("a table wrap queues only records it recognizes as its own", async ({
		page,
	}) => {
		await loadWrappers(page);
		const { wrapped, batches } = await observeWrap(
			page,
			"<table><caption>Wide</caption><tbody><tr><td>a</td></tr></tbody></table>",
		);
		expect(wrapped).toBe(1);
		expect(batches).toHaveLength(1);
		expect(batches[0].every(Boolean)).toBe(true);
	});

	test("wrapping images and tables together stays entirely self-recognized", async ({
		page,
	}) => {
		await loadWrappers(page);
		const { wrapped, batches } = await observeWrap(
			page,
			'<img src="/a.png" alt="a"><table><tbody><tr><td>a</td></tr></tbody></table><img src="/b.png" alt="b">',
		);
		expect(wrapped).toBe(3);
		expect(batches).toHaveLength(1);
		expect(batches[0].every(Boolean)).toBe(true);
	});

	test("late element-painted content still costs exactly one pass", async ({
		page,
	}) => {
		await loadWrappers(page);
		const outcome = await page.evaluate(async () => {
			const {
				isOverwideImageWrapMutation,
				isOverwideTableWrapMutation,
				wrapOverwideImagesInElement,
				wrapOverwideTablesInElement,
			} = window.PieOverwideUnderTest;

			const root = document.createElement("div");
			root.innerHTML = '<div class="pie-painted"></div>';
			document.body.appendChild(root);
			const host = root.querySelector(".pie-painted") as Element;

			// The scheduling shape PieItemPlayer.svelte uses: coalesce to one
			// deferred pass, and ignore a batch that is entirely the wrap's own
			// output. Before the record filter this settled at three passes — the
			// initial one, the paint, and the pass the wrap's own records provoked.
			let passes = 0;
			let selfMutationsPending = false;
			let pendingHandle: ReturnType<typeof setTimeout> | null = null;

			const runPass = () => {
				passes += 1;
				const wrapped =
					wrapOverwideImagesInElement(root) + wrapOverwideTablesInElement(root);
				selfMutationsPending = wrapped > 0;
			};

			runPass();

			const observer = new MutationObserver((records) => {
				if (selfMutationsPending) {
					selfMutationsPending = false;
					if (
						records.every(
							(record) =>
								isOverwideImageWrapMutation(record) ||
								isOverwideTableWrapMutation(record),
						)
					) {
						return;
					}
				}
				if (pendingHandle !== null) return;
				pendingHandle = setTimeout(() => {
					pendingHandle = null;
					runPass();
				}, 0);
			});
			observer.observe(root, { childList: true, subtree: true });

			host.innerHTML =
				'<img src="/late.png" alt="late"><table><tbody><tr><td>a</td></tr></tbody></table>';
			await new Promise((resolve) => setTimeout(resolve, 200));
			observer.disconnect();
			if (pendingHandle !== null) clearTimeout(pendingHandle);

			return {
				passes,
				imageWrappers: root.querySelectorAll(".pie-image-scroll").length,
				tableWrappers: root.querySelectorAll(".pie-table-scroll").length,
			};
		});

		expect(outcome).toEqual({
			passes: 2,
			imageWrappers: 1,
			tableWrappers: 1,
		});
	});
});
