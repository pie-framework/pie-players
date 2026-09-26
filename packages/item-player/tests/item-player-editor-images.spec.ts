/**
 * The overwide-image reflow wrap stays out of editors.
 *
 * The render-time pass wraps element-painted images in `pie-image-scroll`.
 * Inside a ProseMirror editor the editor redraws the node without the wrapper
 * and the pass wraps it again, so the two alternate for as long as the editor
 * holds an image: thousands of mutation records a second on an idle page. Author
 * mode runs no pass; delivery leaves editing-host content alone.
 */

import { expect, test, type Page } from "@playwright/test";
import eteDemo from "../../../apps/item-demos/src/lib/content/extended-text-entry-default";
import mcDemo from "../../../apps/item-demos/src/lib/content/multiple-choice-radio-simple";

const MC_MODEL = mcDemo.item.config.models[0] as Record<string, any>;
const ETE_MODEL = eteDemo.item.config.models[0] as Record<string, any>;

const IMAGE_ORIGIN = "https://pie-editor-images.test";
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#8ac"/></svg>`;

// The loop logs over a thousand records a second; an idle editor logs none.
const SETTLE_MS = 1_000;
const IDLE_WINDOW_MS = 2_000;
const IDLE_RECORD_LIMIT = 50;

function image(alt: string): string {
	return `<img alt="${alt}" src="${IMAGE_ORIGIN}/${encodeURIComponent(alt)}.svg"/>`;
}

async function serveImages(page: Page) {
	await page.route(`${IMAGE_ORIGIN}/**`, (route) =>
		route.fulfill({ status: 200, contentType: "image/svg+xml", body: SVG }),
	);
}

async function mountPlayer(
	page: Page,
	props: {
		id: string;
		mode?: "author";
		env: { mode: string; role: string };
		data: Array<Record<string, unknown>>;
		config: Record<string, unknown>;
	},
) {
	await page.evaluate(({ id, mode, env, data, config }) => {
		const player = document.createElement("pie-item-player") as any;
		player.id = id;
		document.body.appendChild(player);
		player.strategy = "iife";
		if (mode) player.mode = mode;
		player.loaderOptions = { bundleHost: "https://proxy.pie-api.com/bundles/" };
		player.env = env;
		player.session = { id: `${id}-session`, data };
		player.config = config;
	}, props);
}

/** childList records under `selector` over an idle window, after a settle. */
async function idleMutations(page: Page, selector: string) {
	await page.waitForTimeout(SETTLE_MS);
	return page.evaluate(
		async ({ selector, windowMs }) => {
			const root = document.querySelector(selector);
			if (!root) throw new Error(`${selector} is not on the page`);
			const isWrapper = (node: Node) =>
				node instanceof Element && node.classList.contains("pie-image-scroll");
			let records = 0;
			let wrapperRecords = 0;
			const observer = new MutationObserver((batch) => {
				for (const record of batch) {
					records += 1;
					if ([...record.addedNodes, ...record.removedNodes].some(isWrapper)) {
						wrapperRecords += 1;
					}
				}
			});
			observer.observe(root, { childList: true, subtree: true });
			await new Promise((resolve) => setTimeout(resolve, windowMs));
			observer.disconnect();
			return { records, wrapperRecords };
		},
		{ selector, windowMs: IDLE_WINDOW_MS },
	);
}

test.describe("item-player editor images", () => {
	test.describe.configure({ timeout: 60_000 });

	test("author mode leaves configure images unwrapped and the editors idle", async ({
		page,
	}) => {
		const id = "author-editor-images-probe";
		const modelId = "mc-probe";
		await serveImages(page);
		await page.goto(`/demo/${mcDemo.id}/author?player=iife`, {
			waitUntil: "domcontentloaded",
		});
		await mountPlayer(page, {
			id,
			mode: "author",
			env: { mode: "author", role: "instructor" },
			data: [],
			config: {
				id,
				markup: `<multiple-choice id="${modelId}"></multiple-choice>`,
				elements: mcDemo.item.config.elements,
				models: [
					{
						...MC_MODEL,
						id: modelId,
						prompt: `<p>Which planet is largest?</p><p>${image("Planet sizes")}</p>`,
						choices: MC_MODEL.choices.map((choice: any, index: number) =>
							index === 1
								? { ...choice, label: `<p>Jupiter ${image("Jupiter")}</p>` }
								: choice,
						),
					},
				],
			},
		});

		const player = page.locator(`#${id}`);
		// The prompt and choice images sit in ProseMirror editors.
		await expect(player.locator("[contenteditable] img")).toHaveCount(2, {
			timeout: 30_000,
		});
		// An image the configure element paints outside its editors.
		await player
			.locator(`[id="${modelId}"]`)
			.evaluate((configure, markup) => {
				configure.insertAdjacentHTML("beforeend", `<figure>${markup}</figure>`);
			}, image("Thumbnail"));

		const idle = await idleMutations(page, `#${id}`);
		expect(idle.wrapperRecords).toBe(0);
		expect(idle.records).toBeLessThan(IDLE_RECORD_LIMIT);
		await expect(player.locator(".pie-image-scroll")).toHaveCount(0);
	});

	test("delivery wraps the prompt image and leaves the response editor's alone", async ({
		page,
	}) => {
		const id = "delivery-editor-images-probe";
		const modelId = "ete-probe";
		await serveImages(page);
		await page.goto(
			`/demo/${eteDemo.id}/delivery?mode=gather&role=student&player=iife`,
			{ waitUntil: "domcontentloaded" },
		);
		await mountPlayer(page, {
			id,
			env: { mode: "gather", role: "student" },
			data: [
				{
					id: modelId,
					element: "extended-text-entry",
					value: `<p>My sketch:</p><p>${image("Response sketch")}</p>`,
				},
			],
			config: {
				id,
				markup: `<extended-text-entry id="${modelId}"></extended-text-entry>`,
				elements: eteDemo.item.config.elements,
				models: [
					{
						...ETE_MODEL,
						id: modelId,
						prompt: `<p>Explain the diagram.</p><p>${image("Diagram")}</p>`,
					},
				],
			},
		});

		const player = page.locator(`#${id}`);
		await expect(player.locator("[contenteditable] img")).toHaveCount(1, {
			timeout: 30_000,
		});
		// The pass is live in this player.
		await expect(
			player.locator('img[alt="Diagram"]').locator(".."),
		).toHaveClass(/pie-image-scroll/);

		const idle = await idleMutations(page, `#${id}`);
		expect(idle.wrapperRecords).toBe(0);
		expect(idle.records).toBeLessThan(IDLE_RECORD_LIMIT);
		await expect(player.locator("[contenteditable] .pie-image-scroll")).toHaveCount(0);
	});
});
