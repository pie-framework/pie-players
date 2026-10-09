import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { expect, test } from "@playwright/test";

/**
 * Measures, in a real engine with the theme's content CSS, that wrapping an
 * image opens no line box below it where the host lays images out as blocks,
 * and keeps an inline image in its line.
 *
 * Bundles the compiled `dist/security/wrap-overwide-images.js`; requires
 * `bun run build:e2e:players-shared` first.
 */

const PACKAGE_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const ENTRY = path.join(PACKAGE_ROOT, "dist/security/wrap-overwide-images.js");
const COMPONENTS_CSS = readFileSync(
	path.join(PACKAGE_ROOT, "../theme/src/components.css"),
	"utf8",
);

let bundledCode: string;

test.beforeAll(async () => {
	if (!existsSync(ENTRY)) {
		throw new Error(
			`[image-scroll-layout.spec] ${ENTRY} does not exist. Run "bun run build:e2e:players-shared" (or "bun run build") before this suite.`,
		);
	}
	const result = await esbuild.build({
		entryPoints: [ENTRY],
		bundle: true,
		platform: "browser",
		format: "iife",
		globalName: "PieImageWrapUnderTest",
		target: "es2020",
		write: false,
	});
	bundledCode = result.outputFiles[0].text;
});

// A 40px square.
const IMAGE =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'/%3E";

test("an image wrapped off-document under a host block reset opens no gap below it", async ({
	page,
}) => {
	await page.setContent(
		`<!doctype html><html><head><style>img { display: block; } .inline-images img { display: inline; }</style></head><body><div data-pie-content id="root"></div></body></html>`,
	);
	await page.addStyleTag({ content: COMPONENTS_CSS });
	await page.addScriptTag({ content: bundledCode });

	const result = await page.evaluate((src) => {
		const { wrapOverwideImages, wrapOverwideImagesInElement } = (
			window as unknown as {
				PieImageWrapUnderTest: {
					wrapOverwideImages: (markup: string) => string;
					wrapOverwideImagesInElement: (root: Element) => number;
				};
			}
		).PieImageWrapUnderTest;
		const root = document.getElementById("root") as HTMLElement;
		root.innerHTML = wrapOverwideImages(
			`<p id="reset"><img src="${src}" width="40" height="40" alt="a"></p>` +
				`<p id="inline" class="inline-images">text <img src="${src}" width="40" height="40" alt="b"> text</p>`,
		);
		wrapOverwideImagesInElement(root);
		const height = (id: string) =>
			(document.getElementById(id) as HTMLElement).getBoundingClientRect()
				.height;
		const img = (id: string) =>
			document.querySelector(`#${id} img`) as HTMLImageElement;
		return {
			resetParagraph: height("reset"),
			resetImage: img("reset").getBoundingClientRect().height,
			inlineWrapperDisplay: getComputedStyle(
				img("inline").parentElement as HTMLElement,
			).display,
		};
	}, IMAGE);

	expect(result.resetImage).toBe(40);
	expect(result.resetParagraph).toBe(result.resetImage);
	expect(result.inlineWrapperDisplay).toBe("inline-block");
});
