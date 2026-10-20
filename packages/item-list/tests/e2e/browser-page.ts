import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

/**
 * The `./browser` build served from a stub origin, for specs that need its lazy chunks to load as
 * they would from a CDN. Elements are preloaded as a stub registration, so no element code is
 * fetched. Requires `bun run build:e2e:item-list`.
 */

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BROWSER_DIR = path.join(PACKAGE_ROOT, "dist/browser");
const ORIGIN = "http://pie-item-list.test";

export const STUB_TAG = "multiple-choice--version-11-0-0";

export function assertBrowserBuild(spec: string): void {
	if (!existsSync(path.join(BROWSER_DIR, "pie-item-list.js"))) {
		throw new Error(
			`[${spec}] ${BROWSER_DIR} has no build. Run "bun run build:e2e:item-list" first.`,
		);
	}
}

export async function openPage(page: Page): Promise<void> {
	await page.route(`${ORIGIN}/**`, async (route) => {
		const { pathname } = new URL(route.request().url());
		if (pathname === "/") {
			await route.fulfill({
				contentType: "text/html",
				body: `<!doctype html><html><body><script type="module" src="./pie-item-list.js"></script></body></html>`,
			});
			return;
		}
		const file = path.join(BROWSER_DIR, pathname);
		if (!file.startsWith(BROWSER_DIR) || !existsSync(file)) {
			await route.fulfill({ status: 404 });
			return;
		}
		await route.fulfill({ contentType: "text/javascript", body: readFileSync(file) });
	});
	await page.goto(`${ORIGIN}/`);
	await page.waitForFunction(() => customElements.get("pie-item-summary") !== undefined);
}

/** Registers a stub for the item's element, so the preloaded player finds it defined. */
export async function preloadStubElement(page: Page): Promise<void> {
	await page.evaluate((tag) => {
		customElements.define(
			tag,
			class extends HTMLElement {
				set model(value: { prompt?: string }) {
					this.textContent = `Rendered: ${value?.prompt ?? ""}`;
				}
			},
		);
	}, STUB_TAG);
}

/** An item with one multiple-choice element, as the stub renders it. */
export function itemConfig(id: string, prompt: string): Record<string, unknown> {
	return {
		id,
		elements: { "multiple-choice": "@pie-element/multiple-choice@11.0.0" },
		models: [{ id: "1", element: "multiple-choice", prompt }],
		markup: '<multiple-choice id="1"></multiple-choice>',
	};
}
