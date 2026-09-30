/**
 * The item player's preloaded strategy as a host runs it: item-demos installs
 * pie-elements-ng packages, its bundler resolves their `./browser/*` builds,
 * and `/preloaded-npm` registers them before a player mounts. Nothing the
 * player does may fetch element code.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const PATH = "/preloaded-npm";
const ITEM_DEMOS = join(import.meta.dirname, "../../../apps/item-demos");

function installedSpec(name: string): string {
	const manifest = JSON.parse(
		readFileSync(
			join(ITEM_DEMOS, "node_modules", name, "package.json"),
			"utf8",
		),
	) as { version: string };
	return `${name}@${manifest.version}`;
}

function versionedTag(baseTag: string, spec: string): string {
	const version = spec.slice(spec.lastIndexOf("@") + 1);
	return `${baseTag}--version-${version.replace(/[.+]/g, "-")}`;
}

// Element code or controllers from anywhere but the page's own modules: PITS
// bundles, or npm packages on a CDN.
const ELEMENT_CODE_REQUEST =
	/\/bundles\/|\/(?:npm\/)?@pie-(?:element|lib|elements-ng)\/|esm\.sh\/|unpkg\.com\//;

function recordOffOriginElementRequests(page: Page, baseURL: string): string[] {
	const requests: string[] = [];
	page.on("request", (request) => {
		const url = request.url();
		if (!url.startsWith(`${baseURL}/`) && ELEMENT_CODE_REQUEST.test(url)) {
			requests.push(url);
		}
	});
	return requests;
}

function recordMissingControllerWarnings(page: Page): string[] {
	const warnings: string[] = [];
	page.on("console", (message) => {
		if (message.text().includes("is registered without a controller")) {
			warnings.push(message.text());
		}
	});
	return warnings;
}

test.describe("item player preloaded from npm", () => {
	test("renders and answers host-bundled elements with no element request", async ({
		page,
		baseURL,
	}) => {
		const elementRequests = recordOffOriginElementRequests(
			page,
			baseURL as string,
		);
		const controllerWarnings = recordMissingControllerWarnings(page);
		await page.goto(PATH, { waitUntil: "networkidle" });
		await expect(page.getByRole("alert")).toHaveCount(0);

		const multipleChoice = page.locator('[data-item-id="npm-multiple-choice"]');
		await expect(
			multipleChoice.getByText(
				"Which is the largest planet in our solar system?",
			),
		).toBeVisible({ timeout: 30_000 });
		await multipleChoice.getByRole("radio", { name: /Jupiter/ }).click();
		await expect(multipleChoice.getByTestId("session")).toContainText(
			"jupiter",
		);

		const populatedBlank = page.locator(
			'[data-item-id="npm-mc-populated-blank"]',
		);
		const teapot = populatedBlank.getByRole("radio", { name: "teapot" });
		await expect(teapot).toBeVisible({ timeout: 30_000 });
		await teapot.click();
		await expect(teapot).toBeChecked();
		await expect(populatedBlank.getByTestId("session")).toContainText(
			"distractor_1",
		);

		expect(elementRequests).toEqual([]);
		expect(controllerWarnings).toEqual([]);
	});

	test("registers the installed versions and aligns authored ones to them", async ({
		page,
	}) => {
		const multipleChoice = installedSpec("@pie-element/multiple-choice");
		const populatedBlank = installedSpec("@pie-element/mc-populated-blank");
		await page.goto(PATH, { waitUntil: "networkidle" });
		await expect(
			page.getByText("Which is the largest planet in our solar system?"),
		).toBeVisible({ timeout: 30_000 });

		expect(
			await page.evaluate(
				() =>
					(window as { PIE_PRELOADED_ELEMENTS?: Record<string, string> })
						.PIE_PRELOADED_ELEMENTS,
			),
		).toEqual({
			"@pie-element/multiple-choice": multipleChoice,
			"@pie-element/mc-populated-blank": populatedBlank,
		});
		// Authored as `multiple-choice` at 11.4.3; rendered under the authored
		// base tag at the registered version.
		await expect(
			page.locator(versionedTag("multiple-choice", multipleChoice)),
		).toHaveCount(1);
		await expect(page.locator("multiple-choice--version-11-4-3")).toHaveCount(
			0,
		);
		await expect(
			page.locator(versionedTag("mc-populated-blank", populatedBlank)),
		).toHaveCount(1);
	});
});
