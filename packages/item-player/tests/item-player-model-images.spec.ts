/**
 * Model strings reach PIE elements as authored, even when they carry images.
 *
 * Elements copy model strings into the session and resolve offsets against
 * them: image-cloze-association stores the dragged response's markup and scores
 * it against the authored key, select-text slices `text` at authored token
 * offsets. Overwide images still get the `pie-image-scroll` reflow wrapper, in
 * the rendered DOM.
 */

import { expect, test, type Page } from "@playwright/test";
import icaDemo from "../../../apps/item-demos/src/lib/content/image-cloze-association-default";
import selectTextDemo from "../../../apps/item-demos/src/lib/content/select-text-default";

const ICA_MODEL = icaDemo.item.config.models[0] as Record<string, any>;
const ICA_ELEMENT = 'pie-item-player [id="1"]';
const RESPONSE_AREAS = ICA_MODEL.response_containers as Array<{
	x: number;
	y: number;
	width: string;
	height: string;
}>;
// The authored key: container 0 takes one response, container 1 the other.
const KEY = (ICA_MODEL.validation.valid_response.value as Array<{
	images: string[];
}>).map((container) => container.images[0]);

const PROBE_ID = "model-images-probe";
const PROBE_MODEL_ID = "st-probe";
const IMAGE =
	'<img alt="Reading log" src="https://app.fluence.net/ia/image/select-text-reading-log"/>';
const SENTENCES = [
	"Maya reread the chapter before class discussion.",
	"She highlighted two details that showed the narrator was unreliable.",
];
const TEXT = `<p>${IMAGE}</p><p>${SENTENCES.join(" ")}</p>`;
// Selectable tokens; index -1 marks the element's hidden style primers.
const TOKEN = '[data-indexkey]:not([data-indexkey="-1"])';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#8ac"/></svg>`;

declare global {
	interface Window {
		__pieLastSession?: { data?: Array<Record<string, any>> };
	}
}

// The demo content's images live on an external host; any image does here.
async function serveImages(page: Page) {
	await page.route("https://app.fluence.net/**", (route) =>
		route.fulfill({ status: 200, contentType: "image/svg+xml", body: SVG }),
	);
}

async function recordSessions(page: Page, playerSelector: string) {
	await page.evaluate((selector) => {
		window.__pieLastSession = undefined;
		document.querySelector(selector)?.addEventListener("session-changed", (event) => {
			const session = (event as CustomEvent).detail?.session;
			if (session) window.__pieLastSession = structuredClone(session);
		});
	}, playerSelector);
}

function srcOf(markup: string): string {
	const src = /src="([^"]+)"/.exec(markup)?.[1];
	if (!src) throw new Error(`no src in ${markup}`);
	return src;
}

async function dragResponse(page: Page, response: string, areaIndex: number) {
	const draggable = page
		.locator(`${ICA_ELEMENT} [aria-roledescription="draggable"]`, {
			has: page.locator(`img[src="${srcOf(response)}"]`),
		})
		.first();
	await expect(draggable).toBeVisible();
	const from = await draggable.boundingBox();
	const board = await page
		.locator(`${ICA_ELEMENT} img[src="${ICA_MODEL.image.src}"]`)
		.boundingBox();
	if (!from || !board) throw new Error("drag source or board not laid out");
	// The element lays response areas out against the model's image size.
	const area = RESPONSE_AREAS[areaIndex];
	const to = {
		x:
			board.x +
			((area.x + Number.parseFloat(area.width) / 2) / 100) * ICA_MODEL.image.width,
		y:
			board.y +
			((area.y + Number.parseFloat(area.height) / 2) / 100) * ICA_MODEL.image.height,
	};
	const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	// Past the 8px activation distance before heading for the target.
	await page.mouse.move(start.x + 12, start.y - 12, { steps: 4 });
	await page.mouse.move(to.x, to.y, { steps: 16 });
	await page.mouse.up();
}

test.describe("item-player model images", () => {
	test("image-cloze-association stores the authored responses and scores the correct placement 1", async ({
		page,
	}) => {
		await serveImages(page);
		await page.goto(
			"/demo/image-cloze-association-default/delivery?mode=gather&role=student&player=iife",
			{ waitUntil: "domcontentloaded" },
		);
		await expect(
			page.locator(`${ICA_ELEMENT} [aria-roledescription="draggable"]`),
		).toHaveCount(2, { timeout: 30_000 });
		await recordSessions(page, "pie-item-player");

		for (const [areaIndex, response] of KEY.entries()) {
			await dragResponse(page, response, areaIndex);
			await expect
				.poll(
					() =>
						page.evaluate(
							() =>
								window.__pieLastSession?.data?.find((entry) => entry.id === "1")
									?.answers?.length ?? 0,
						),
					{ timeout: 10_000 },
				)
				.toBe(areaIndex + 1);
		}

		const answers = await page.evaluate(
			() =>
				window.__pieLastSession?.data?.find((entry) => entry.id === "1")
					?.answers as Array<{ value: string; containerIndex: number }>,
		);
		expect(
			[...answers]
				.sort((a, b) => a.containerIndex - b.containerIndex)
				.map((answer) => answer.value),
		).toEqual(KEY);

		const results = await page.evaluate(async () => {
			const player = document.querySelector("pie-item-player") as any;
			return player.provideScore();
		});
		expect(results?.[0]?.score).toBe(1);

		// The reflow wrapper still lands, in the DOM.
		await expect(
			page
				.locator(`${ICA_ELEMENT} img[src="${srcOf(KEY[0])}"]`)
				.first()
				.locator(".."),
		).toHaveClass(/pie-image-scroll/);
	});

	test("select-text renders the authored tokens when its text holds an image", async ({
		page,
	}) => {
		await serveImages(page);
		await page.goto(
			"/demo/select-text-default/delivery?mode=gather&role=student&player=iife",
			{ waitUntil: "domcontentloaded" },
		);
		await expect(page.locator(`pie-item-player [id="1"] ${TOKEN}`).first()).toBeVisible({
			timeout: 30_000,
		});

		const model = {
			...(selectTextDemo.item.config.models[0] as Record<string, any>),
			id: PROBE_MODEL_ID,
			maxSelections: 1,
			partialScoring: false,
			prompt: "Select the sentence that shows the narrator is unreliable.",
			text: TEXT,
			tokens: SENTENCES.map((text, index) => ({
				text,
				start: TEXT.indexOf(text),
				end: TEXT.indexOf(text) + text.length,
				correct: index === 1,
			})),
		};
		await page.evaluate(
			({ id, config }) => {
				const player = document.createElement("pie-item-player") as any;
				player.id = id;
				document.body.appendChild(player);
				player.strategy = "iife";
				player.loaderOptions = { bundleHost: "https://proxy.pie-api.com/bundles/" };
				player.env = { mode: "gather", role: "student" };
				player.session = { id: `${id}-session`, data: [] };
				player.config = config;
			},
			{
				id: PROBE_ID,
				config: {
					id: PROBE_ID,
					markup: `<select-text id="${PROBE_MODEL_ID}"></select-text>`,
					elements: { "select-text": "@pie-element/select-text@latest" },
					models: [model],
				},
			},
		);

		const tokens = page.locator(`#${PROBE_ID} ${TOKEN}`);
		await expect(tokens).toHaveCount(SENTENCES.length, { timeout: 30_000 });
		await expect(tokens).toHaveText(SENTENCES);
		await expect(
			page.locator(`#${PROBE_ID} img[alt="Reading log"]`).locator(".."),
		).toHaveClass(/pie-image-scroll/);

		await recordSessions(page, `#${PROBE_ID}`);
		await tokens.filter({ hasText: SENTENCES[1] }).click();
		await expect
			.poll(
				() =>
					page.evaluate(
						(modelId) =>
							window.__pieLastSession?.data?.find((entry) => entry.id === modelId)
								?.selectedTokens?.length ?? 0,
						PROBE_MODEL_ID,
					),
				{ timeout: 10_000 },
			)
			.toBe(1);

		const results = await page.evaluate(async (id) => {
			const player = document.getElementById(id) as any;
			return player.provideScore();
		}, PROBE_ID);
		expect(results?.[0]?.score).toBe(1);
	});
});
