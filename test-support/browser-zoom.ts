import { chromium, expect, type Page, type TestInfo } from "@playwright/test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

type ZoomTabs = {
	query(query: { active: boolean; currentWindow: boolean }): Promise<Array<{ id: number }>>;
	setZoomSettings(id: number, settings: { mode: "automatic"; scope: "per-tab" }): Promise<void>;
	setZoom(id: number, factor: number): Promise<void>;
	getZoom(id: number): Promise<number>;
};

/** Actual Chromium tab zoom in an isolated profile, with no viewport emulation.
 * https://playwright.dev/docs/chrome-extensions
 * https://developer.chrome.com/docs/extensions/reference/api/tabs#method-setZoom
 */
export async function withBrowserZoom(
	baseURL: string,
	testInfo: TestInfo,
	check: (
		page: Page,
		setZoom: (factor: number) => Promise<void>,
		capture: (name: string) => Promise<void>,
	) => Promise<void>,
) {
	const folder = await mkdtemp(join(tmpdir(), "pie-browser-zoom-"));
	const extension = join(folder, "extension");
	await mkdir(extension);
	await writeFile(join(extension, "manifest.json"), JSON.stringify({
		manifest_version: 3, name: "PIE zoom verification", version: "1.0",
		background: { service_worker: "background.js" },
	}));
	await writeFile(join(extension, "background.js"), "chrome.runtime.onInstalled.addListener(() => {});");
	try {
		const context = await chromium.launchPersistentContext(join(folder, "profile"), {
			baseURL, channel: "chromium", headless: true, viewport: null, deviceScaleFactor: undefined,
			args: ["--window-size=1280,1024", `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
		});
		try {
			const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
			const page = context.pages()[0];
			let zoomFactor: number | null = null;
			const capture = async (name: string) => {
				// Playwright's clip calculation crops a native-zoom screenshot to
				// CSS dimensions. Capture the whole browser surface without a clip.
				const cdp = await context.newCDPSession(page);
				try {
					const { data } = await cdp.send("Page.captureScreenshot", {
						format: "png", fromSurface: true, captureBeyondViewport: false,
					});
					await writeFile(testInfo.outputPath(name), Buffer.from(data, "base64"));
				} finally {
					await cdp.detach();
				}
			};
			try {
				await check(page, async factor => {
					const actual = await worker.evaluate(async zoom => {
						const tabs = (globalThis as unknown as { chrome: { tabs: ZoomTabs } }).chrome.tabs;
						const [tab] = await tabs.query({ active: true, currentWindow: true });
						await tabs.setZoomSettings(tab.id, { mode: "automatic", scope: "per-tab" });
						await tabs.setZoom(tab.id, zoom);
						return tabs.getZoom(tab.id);
					}, factor);
					zoomFactor = actual;
					expect(actual).toBeCloseTo(factor);
					await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1280 / factor);
					await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBe(factor);
					expect(await page.evaluate(() => visualViewport?.scale)).toBe(1);
				}, capture);
			} finally {
				await capture("browser-zoom.png");
				await writeFile(testInfo.outputPath("browser-zoom.json"), JSON.stringify({
					zoomFactor,
					...await page.evaluate(() => ({ outerWidth, innerWidth, innerHeight, devicePixelRatio, visualScale: visualViewport?.scale })),
				}, null, 2));
			}
		} finally {
			await context.close();
		}
	} finally {
		await rm(folder, { recursive: true, force: true });
	}
}
