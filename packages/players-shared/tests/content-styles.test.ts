import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";

import { readFileSync } from "node:fs";

import {
	contentStylesOptedOut,
	contentStylesPresent,
	installContentStyles,
	resetContentStylesWarningForTesting,
	auditContentStyles,
} from "../src/ui/content-styles.js";

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

const CSS =
	":root { --pie-content-styles: 1; }\n.numbered-paragraph { margin-left: 36px; }";

afterEach(() => {
	document.head.innerHTML = "";
	document.documentElement.removeAttribute("data-pie-content-styles");
	resetContentStylesWarningForTesting();
});

const COMPONENTS_CSS = readFileSync(
	new URL("../../theme/src/components.css", import.meta.url),
	"utf8",
);

const CONTENT_ROOTS =
	":where(.pie-item-container, .pie-passage-container, pie-print)";

/** Selectors of the installed text's style rules that are not confined. */
const globalSelectors = (text: string): string[] =>
	Array.from(text.matchAll(/(?:^|\n)([^@\n{}][^{}\n]*)\{/g))
		.flatMap(([, prelude]) => (prelude ?? "").split(", "))
		.map((selector) => selector.trim())
		.filter((selector) => selector && !selector.startsWith(CONTENT_ROOTS))
		.filter((selector) => !/^\d+%$/.test(selector));

const installedStyles = () =>
	Array.from(document.querySelectorAll("style[data-pie-content-styles]"));

describe("installContentStyles", () => {
	test("installs the stylesheet and records the installing package", () => {
		expect(installContentStyles(CSS, "pie-item-player")).toBe("installed");

		const styles = installedStyles();
		expect(styles).toHaveLength(1);
		expect(styles[0]?.getAttribute("data-pie-content-styles")).toBe(
			"pie-item-player",
		);
		expect(styles[0]?.textContent).toContain(".numbered-paragraph");
	});

	test("confines the generic rules of the real stylesheet to player content", () => {
		// The bare `table` / `th` / `h1`-`h6` rules and the framework-style names
		// share names with host UI libraries — DaisyUI's and Bootstrap's `.table` —
		// so a document-wide copy restyled the host's own chrome.
		installContentStyles(COMPONENTS_CSS, "pie-item-player");

		const text = installedStyles()[0]?.textContent ?? "";
		for (const selector of [
			"table",
			"th",
			"h1",
			"h6",
			".h5",
			".table",
			".table thead th",
			".table-bordered td",
			".table-striped tbody tr:nth-of-type(odd)",
			".text-center",
			".center",
			".indent",
		]) {
			expect(text).toContain(`${CONTENT_ROOTS} ${selector}`);
			expect(globalSelectors(text)).not.toContain(selector);
		}
	});

	test("keeps content-owned rules global, so portaled content stays styled", () => {
		// Elements portal menus, popovers and modals to <body>, outside every
		// player container; authored choices rendered there still need KDS
		// fractions and the MathJax glyph fixes.
		installContentStyles(COMPONENTS_CSS, "pie-item-player");

		const global = globalSelectors(installedStyles()[0]?.textContent ?? "");
		for (const selector of [
			":root",
			"table.kds-fraction > tbody > tr > td.kds-numerator",
			"table.KdsTable01 > tbody > tr > th",
			".frac .nu",
			".numbered-paragraph",
			".TEX-S1",
			"mjx-c.mjx-c22",
			".pie-answer-eliminator-toggle",
			'[data-pie-answer-eliminated="true"]',
		]) {
			expect(global).toContain(selector);
		}
	});

	test("confines a rule added later unless it names content-owned markup", () => {
		// Confinement is the default: a new rule reaches portaled content only by
		// requiring a PIE, KDS or MathJax name, and a name inside `:is()` or
		// `:not()` does not count because the selector does not require it.
		installContentStyles(
			`${CSS}\n.new-utility { color: red; }\nsection p { margin: 0; }\n` +
				":is(.kds-center, td) { padding: 0; }\n" +
				"td:not(.kds-numerator) { padding: 0; }\n" +
				".kds-new-family td { padding: 0; }",
			"pie-item-player",
		);

		const text = installedStyles()[0]?.textContent ?? "";
		expect(text).toContain(`${CONTENT_ROOTS} .new-utility {`);
		expect(text).toContain(`${CONTENT_ROOTS} section p {`);
		expect(text).toContain(`${CONTENT_ROOTS} :is(.kds-center, td) {`);
		expect(text).toContain(`${CONTENT_ROOTS} td:not(.kds-numerator) {`);
		expect(globalSelectors(text)).toContain(".kds-new-family td");
	});

	test("is idempotent across repeated calls and multiple player packages", () => {
		expect(installContentStyles(CSS, "pie-item-player")).toBe("installed");
		expect(installContentStyles(CSS, "pie-item-player")).toBe(
			"already-installed",
		);
		expect(installContentStyles(CSS, "pie-print-player")).toBe(
			"already-installed",
		);

		expect(installedStyles()).toHaveLength(1);
	});

	test("prepends so later host stylesheets win ties at equal specificity", () => {
		const hostStyle = document.createElement("style");
		hostStyle.id = "host";
		document.head.append(hostStyle);

		installContentStyles(CSS, "pie-item-player");

		// The host's stylesheet must still come last in document order — this is
		// the placement hosts were previously told to set up by hand.
		expect(
			document.head.firstElementChild?.getAttribute("data-pie-content-styles"),
		).toBe("pie-item-player");
		expect(document.head.lastElementChild?.id).toBe("host");
	});

	test("does not install when the host opts out", () => {
		document.documentElement.setAttribute("data-pie-content-styles", "host");

		expect(contentStylesOptedOut()).toBe(true);
		expect(installContentStyles(CSS, "pie-item-player")).toBe("opted-out");
		expect(installedStyles()).toHaveLength(0);
	});

	test("stands down when the host already supplies a scoped copy", () => {
		// A host that confines its copy with `@scope` does so because the bare
		// `h1`-`h6` / `table` / `th` selectors would otherwise reach its own UI; a
		// global copy from the player would reintroduce exactly that.
		const hostStyle = document.createElement("style");
		hostStyle.textContent = `@scope (.item-content) {\n${CSS}\n}`;
		document.head.append(hostStyle);

		expect(installContentStyles(CSS, "pie-item-player")).toBe("host-supplied");
		expect(installedStyles()).toHaveLength(0);
	});

	test("removes its copy when a host copy lands after installation", async () => {
		// The host injects its copy alongside the player import, so either can
		// evaluate first.
		expect(installContentStyles(CSS, "pie-item-player")).toBe("installed");

		const hostStyle = document.createElement("style");
		hostStyle.textContent = `@scope (.item-content) {\n${CSS}\n}`;
		document.head.append(hostStyle);
		await Promise.resolve();

		expect(installedStyles()).toHaveLength(0);
		expect(hostStyle.isConnected).toBe(true);
		expect(installContentStyles(CSS, "pie-print-player")).toBe("host-supplied");
	});

	test("keeps its copy when later stylesheets carry no sentinel", async () => {
		installContentStyles(CSS, "pie-item-player");

		const appStyle = document.createElement("style");
		appStyle.textContent = ".app { color: red; }";
		document.head.append(appStyle);
		await Promise.resolve();

		expect(installedStyles()).toHaveLength(1);
	});

	test("removes its copy when the host opts out after installation", async () => {
		installContentStyles(CSS, "pie-item-player");

		document.documentElement.setAttribute("data-pie-content-styles", "host");
		await Promise.resolve();

		expect(installedStyles()).toHaveLength(0);
	});

	test("treats any other attribute value as not opted out", () => {
		document.documentElement.setAttribute("data-pie-content-styles", "player");

		expect(contentStylesOptedOut()).toBe(false);
		expect(installContentStyles(CSS, "pie-item-player")).toBe("installed");
	});
});

describe("contentStylesPresent", () => {
	test("is false with no stylesheet and true once one is applied", () => {
		expect(contentStylesPresent()).toBe(false);

		installContentStyles(CSS, "pie-item-player");

		expect(contentStylesPresent()).toBe(true);
	});

	test("detects a stylesheet the host loaded itself, not just our injection", () => {
		document.documentElement.setAttribute("data-pie-content-styles", "host");
		const hostStyle = document.createElement("style");
		hostStyle.textContent = CSS;
		document.head.append(hostStyle);

		// No marker attribute anywhere — detection reads the sentinel property the
		// stylesheet itself declares, so the delivery route does not matter.
		expect(installedStyles()).toHaveLength(0);
		expect(contentStylesPresent()).toBe(true);
	});

	test("detects a host copy confined to its player subtree", () => {
		// `@scope (.item-content) { … }` is the documented remedy for the bare
		// `h1`-`h6` / `table` / `th` rules reaching host chrome, so it is the
		// configuration a careful host arrives at. The stylesheet's `:root` rule
		// can never match inside it — `<html>` is not a descendant of the scoping
		// root — so the computed property reads empty and only a sheet scan sees it.
		document.documentElement.setAttribute("data-pie-content-styles", "host");
		const hostStyle = document.createElement("style");
		hostStyle.textContent = `@scope (.item-content) {\n${CSS}\n}`;
		document.head.append(hostStyle);

		expect(
			getComputedStyle(document.documentElement)
				.getPropertyValue("--pie-content-styles")
				.trim(),
		).toBe("");
		expect(contentStylesPresent()).toBe(true);
	});

	test("detects a host copy inside a cascade layer or media block", () => {
		document.documentElement.setAttribute("data-pie-content-styles", "host");
		const hostStyle = document.createElement("style");
		hostStyle.textContent = `@media screen {\n${CSS}\n}`;
		document.head.append(hostStyle);

		expect(contentStylesPresent()).toBe(true);
	});

	test("is not fooled by a grouping rule that carries no sentinel", () => {
		const hostStyle = document.createElement("style");
		hostStyle.textContent =
			"@scope (.item-content) { .numbered-paragraph { margin-left: 36px; } }";
		document.head.append(hostStyle);

		expect(contentStylesPresent()).toBe(false);
	});

	test("ignores a CSS-wide reset of the sentinel nested in a grouping rule", () => {
		const hostStyle = document.createElement("style");
		hostStyle.textContent =
			"@media screen { .svelte-custom-element-reset { --pie-content-styles: unset; } }";
		document.head.append(hostStyle);

		expect(contentStylesPresent()).toBe(false);
	});
});

describe("auditContentStyles", () => {
	const captureWarnings = async (): Promise<string[]> => {
		const warnings: string[] = [];
		const original = console.warn;
		console.warn = (...args: unknown[]) => {
			warnings.push(args.map(String).join(" "));
		};
		try {
			auditContentStyles("pie-item-player");
			// The check is deferred two animation frames to let an async host
			// stylesheet land before it is judged missing.
			await new Promise((resolve) => setTimeout(resolve, 50));
		} finally {
			console.warn = original;
		}
		return warnings;
	};

	test("stays silent when the player installed the only copy", async () => {
		installContentStyles(CSS, "pie-item-player");

		expect(await captureWarnings()).toEqual([]);
	});

	test("ignores scoped CSS-wide resets of the sentinel property", async () => {
		installContentStyles(CSS, "pie-item-player");
		const resetStyle = document.createElement("style");
		resetStyle.textContent =
			".svelte-custom-element-reset { --pie-content-styles: unset; }";
		document.head.append(resetStyle);

		expect(await captureWarnings()).toEqual([]);
	});

	test("stays silent when nothing is loaded and the host did not opt out", async () => {
		// Not a state the players produce — installation precedes the audit — but
		// the audit must not invent a complaint about a stylesheet nobody asked for.
		expect(await captureWarnings()).toEqual([]);
	});

	test("warns when the host opted out but shipped no stylesheet", async () => {
		document.documentElement.setAttribute("data-pie-content-styles", "host");

		const warnings = await captureWarnings();
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("No PIE content stylesheet found");
		expect(warnings[0]).toContain("@pie-players/pie-theme/components.css");
	});

	test("stays silent when an opted-out host did load the stylesheet", async () => {
		document.documentElement.setAttribute("data-pie-content-styles", "host");
		const hostStyle = document.createElement("style");
		hostStyle.textContent = CSS;
		document.head.append(hostStyle);

		expect(await captureWarnings()).toEqual([]);
	});

	test("stays silent when a host copy lands after installation", async () => {
		// The upgrade path that matters: a host that keeps its own copy after
		// moving to a player version that installs the stylesheet itself.
		installContentStyles(CSS, "pie-item-player");
		const hostStyle = document.createElement("style");
		hostStyle.textContent = `@scope (.item-content) {\n${CSS}\n}`;
		document.head.append(hostStyle);

		expect(await captureWarnings()).toEqual([]);
		expect(installedStyles()).toHaveLength(0);
	});

	test("treats an opted-out host's confined copy as correct, not missing", async () => {
		// The regression this pairs with: before grouping rules were walked, this
		// host — opted out, stylesheet present and working, scoped so it cannot
		// bleed — was told on every page load that it had shipped nothing.
		document.documentElement.setAttribute("data-pie-content-styles", "host");
		const hostStyle = document.createElement("style");
		hostStyle.textContent = `@scope (.item-content) {\n${CSS}\n}`;
		document.head.append(hostStyle);

		expect(installContentStyles(CSS, "pie-item-player")).toBe("opted-out");
		expect(await captureWarnings()).toEqual([]);
	});

	test("does not count the installed copy as a duplicate of itself", async () => {
		installContentStyles(CSS, "pie-item-player");
		installContentStyles(CSS, "pie-item-player");

		expect(await captureWarnings()).toEqual([]);
	});

	test("treats an opted-out host's own copy as correct, not duplicated", async () => {
		document.documentElement.setAttribute("data-pie-content-styles", "host");
		const hostStyle = document.createElement("style");
		hostStyle.textContent = CSS;
		document.head.append(hostStyle);

		expect(installContentStyles(CSS, "pie-item-player")).toBe("opted-out");
		expect(await captureWarnings()).toEqual([]);
	});

	test("warns only once per page", async () => {
		document.documentElement.setAttribute("data-pie-content-styles", "host");

		expect(await captureWarnings()).toHaveLength(1);
		expect(await captureWarnings()).toHaveLength(0);
	});
});
