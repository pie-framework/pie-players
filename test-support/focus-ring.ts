import type { Page } from "@playwright/test";

/**
 * A dark scheme and a high-contrast scheme, each with the
 * `--pie-button-focus-outline` it sets, as the browser reports the colour. Both
 * differ from every literal the player chrome falls back to, so a ring that
 * matches one came from the scheme.
 */
export const FOCUS_RING_SCHEMES = [
	{ scheme: "yellow-on-navy", outline: "rgb(255, 255, 153)" },
	{ scheme: "white-on-black", outline: "rgb(255, 255, 0)" },
] as const;

/** Apply a scheme the way a host does, on the page's document-scoped `<pie-theme>`. */
export async function setDocumentScheme(page: Page, scheme: string): Promise<void> {
	await page
		.locator('pie-theme[scope="document"]')
		.first()
		.evaluate(async (host, id) => {
			host.setAttribute("scheme", id);
			await new Promise((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(resolve)),
			);
		}, scheme);
}

/**
 * Apply a scheme the stylesheet-only way, for a page that mounts no `<pie-theme>`:
 * the generated scheme rules (`packages/theme/src/color-schemes.css`), keyed on
 * `data-color-scheme` at the root.
 */
export async function setStylesheetScheme(
	page: Page,
	colorSchemesCss: string,
	scheme: string,
): Promise<void> {
	await page.evaluate(
		async ({ css, id }) => {
			if (!document.head.querySelector("style[data-test-color-schemes]")) {
				const sheet = document.createElement("style");
				sheet.dataset.testColorSchemes = "true";
				sheet.textContent = css;
				document.head.append(sheet);
			}
			document.documentElement.setAttribute("data-color-scheme", id);
			await new Promise((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(resolve)),
			);
		},
		{ css: colorSchemesCss, id: scheme },
	);
}
