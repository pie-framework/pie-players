import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { type Page, expect, test } from "@playwright/test";

/**
 * Runs `installTrustedTypesDefaultPolicy` in Chromium on a page whose CSP
 * enforces Trusted Types: happy-dom has neither Trusted Types nor a DOMPurify
 * that sanitizes (see sanitize-item-markup.spec.ts). Bundles the built
 * `dist/security/index.js`, so `bun run build:e2e:players-shared` runs first.
 *
 * The page is served through `page.route`, with the bundle as a
 * parser-inserted inline script: a script Playwright injects is itself a
 * Trusted Types sink, and the page refuses it before the policy exists.
 */

const PACKAGE_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const ENTRY = path.join(PACKAGE_ROOT, "dist/security/index.js");
const ORIGIN = "https://host.pie.test";
const BUNDLE_HOST = "https://bundles.pie.test/bundles/";

let bundledCode: string;

test.beforeAll(async () => {
	if (!existsSync(ENTRY)) {
		throw new Error(
			`[trusted-types-policy.spec] ${ENTRY} does not exist. Run "bun run build:e2e:players-shared" (or "bun run build") before this suite.`,
		);
	}
	const result = await esbuild.build({
		entryPoints: [ENTRY],
		bundle: true,
		platform: "browser",
		format: "iife",
		globalName: "PieSecurityUnderTest",
		target: "es2020",
		write: false,
	});
	bundledCode = result.outputFiles[0].text;
});

const ENFORCING_CSP =
	"require-trusted-types-for 'script'; trusted-types default dompurify 'allow-duplicates'";

async function openEnforcingPage(
	page: Page,
	options: { csp?: string; install?: string } = {},
) {
	const install =
		options.install ??
		`window.__installed = PieSecurityUnderTest.installTrustedTypesDefaultPolicy({ scriptUrlPrefixes: [${JSON.stringify(BUNDLE_HOST)}] });`;
	await page.route(`${ORIGIN}/**`, (route) =>
		route.fulfill({
			status: 200,
			contentType: "text/html",
			headers: {
				"content-security-policy": options.csp ?? ENFORCING_CSP,
			},
			body: `<!doctype html><html><body><div id="target"></div>
<script>${bundledCode.replaceAll("</script", "<\\/script")}</script>
<script>${install}</script>
</body></html>`,
		}),
	);
	await page.goto(`${ORIGIN}/`);
}

function assignInnerHtml(page: Page, html: string) {
	return page.evaluate((html) => {
		const target = document.getElementById("target") as HTMLElement;
		target.innerHTML = html;
		return target.innerHTML;
	}, html);
}

function trySink(page: Page, sink: "src" | "text", value: string) {
	return page.evaluate(
		({ sink, value }) => {
			const script = document.createElement("script");
			try {
				if (sink === "src") script.src = value;
				else script.textContent = value;
				return "allowed";
			} catch (error) {
				return error instanceof TypeError ? "refused" : String(error);
			}
		},
		{ sink, value },
	);
}

test.describe("installTrustedTypesDefaultPolicy (Chromium, enforcing CSP)", () => {
	test("the page refuses a raw string before the policy exists", async ({
		page,
	}) => {
		await openEnforcingPage(page, { install: "window.__installed = false;" });
		expect(
			await page.evaluate(() => {
				try {
					(document.getElementById("target") as HTMLElement).innerHTML =
						"<p>x</p>";
					return "allowed";
				} catch (error) {
					return error instanceof TypeError ? "refused" : String(error);
				}
			}),
		).toBe("refused");
	});

	test("installs once and refuses a second default policy", async ({ page }) => {
		await openEnforcingPage(page);
		expect(await page.evaluate(() => (window as any).__installed)).toBe(true);
		expect(
			await page.evaluate(
				() =>
					(window as any).PieSecurityUnderTest.installTrustedTypesDefaultPolicy({
							scriptUrlPrefixes: [],
						}) as boolean,
			),
		).toBe(false);
	});

	test("sanitizes a raw innerHTML string", async ({ page }) => {
		await openEnforcingPage(page);
		const out = await assignInnerHtml(
			page,
			'<p>ok</p><img src="x" onerror="window.__ran=1"><a href="javascript:alert(1)">a</a><script>window.__ran=1</script>',
		);
		expect(out).toContain("<p>ok</p>");
		expect(out).toContain("<img");
		expect(out).not.toContain("onerror");
		expect(out).not.toContain("javascript:");
		expect(out).not.toContain("<script");
		expect(await page.evaluate(() => (window as any).__ran)).toBeUndefined();
	});

	test("keeps custom elements, their attributes and MathML, without handlers", async ({
		page,
	}) => {
		await openEnforcingPage(page);
		const out = await assignInnerHtml(
			page,
			'<pie-multiple-choice id="q1" model-id="m1" onclick="x()"></pie-multiple-choice><mjx-container jax="CHTML" display="true"></mjx-container><math><mstack><msrow><mn>1</mn></msrow></mstack></math>',
		);
		expect(out).toContain('<pie-multiple-choice id="q1" model-id="m1">');
		expect(out).not.toContain("onclick");
		expect(out).toContain('<mjx-container jax="CHTML" display="true">');
		expect(out).toContain("<mstack>");
	});

	test("sanitizes without a `dompurify` policy in the CSP", async ({ page }) => {
		await openEnforcingPage(page, {
			csp: "require-trusted-types-for 'script'; trusted-types default",
		});
		expect(await page.evaluate(() => (window as any).__installed)).toBe(true);
		const out = await assignInnerHtml(
			page,
			'<p>ok</p><img src="x" onerror="window.__ran=1">',
		);
		expect(out).toContain("<p>ok</p>");
		expect(out).not.toContain("onerror");
	});

	test("admits script URLs under the prefixes and refuses others", async ({
		page,
	}) => {
		await openEnforcingPage(page);
		expect(
			await trySink(page, "src", `${BUNDLE_HOST}@pie-element/passage@2.10.5/player.js`),
		).toBe("allowed");
		expect(
			await trySink(page, "src", "https://bundles.pie.test.attacker.test/bundles/x.js"),
		).toBe("refused");
		expect(
			await trySink(page, "src", "https://bundles.pie.test/bundlesx/x.js"),
		).toBe("refused");
		expect(await trySink(page, "src", "https://attacker.test/x.js")).toBe(
			"refused",
		);
	});

	test("a file prefix admits its query, and a relative prefix the document's origin", async ({
		page,
	}) => {
		await openEnforcingPage(page, {
			install: `window.__installed = PieSecurityUnderTest.installTrustedTypesDefaultPolicy({ scriptUrlPrefixes: ["https://calc.pie.test/api/v1.11/calculator.js", "/bundles/"] });`,
		});
		expect(
			await trySink(page, "src", "https://calc.pie.test/api/v1.11/calculator.js?apiKey=k"),
		).toBe("allowed");
		expect(
			await trySink(page, "src", "https://calc.pie.test/api/v1.111/x.js"),
		).toBe("refused");
		expect(await trySink(page, "src", `${ORIGIN}/bundles/a.js`)).toBe(
			"allowed",
		);
		expect(
			await trySink(page, "src", `${BUNDLE_HOST}@pie-element/passage@2.10.5/player.js`),
		).toBe("refused");
	});

	test("an empty prefix list refuses every script URL", async ({ page }) => {
		await openEnforcingPage(page, {
			install:
				"window.__installed = PieSecurityUnderTest.installTrustedTypesDefaultPolicy({ scriptUrlPrefixes: [] });",
		});
		expect(await page.evaluate(() => (window as any).__installed)).toBe(true);
		expect(await trySink(page, "src", `${ORIGIN}/a.js`)).toBe("refused");
	});

	test("admits JSON script text only", async ({ page }) => {
		await openEnforcingPage(page);
		expect(
			await trySink(page, "text", '{"imports":{"a":"https://x.test/a.js"}}'),
		).toBe("allowed");
		expect(await trySink(page, "text", "window.__ran = 1")).toBe("refused");
		expect(await trySink(page, "text", '"just a string"')).toBe("refused");
	});

	test("sanitizeItemMarkup still sanitizes under enforcement", async ({
		page,
	}) => {
		await openEnforcingPage(page);
		const out = await page.evaluate(() =>
			(window as any).PieSecurityUnderTest.sanitizeItemMarkup(
				'<p>ok</p><img src="x" onerror="x()"><style>p{}</style>',
				{ wrapOverwideContent: false },
			),
		);
		expect(out).toContain("<p>ok</p>");
		expect(out).not.toContain("onerror");
		expect(out).not.toContain("<style");
	});
});
