import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach, describe, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

const { applyPieColorScheme, resolvePieThemeHost } = await import(
	"../src/apply-color-scheme.js"
);

function cleanupDocument(): void {
	document.body.innerHTML = "";
	document.documentElement.removeAttribute("data-color-scheme");
	localStorage.clear();
}

describe("resolvePieThemeHost", () => {
	afterEach(cleanupDocument);

	test("finds a <pie-theme> ancestor in the light DOM", () => {
		const pieTheme = document.createElement("pie-theme");
		const child = document.createElement("div");
		pieTheme.appendChild(child);
		document.body.appendChild(pieTheme);

		expect(resolvePieThemeHost(child)).toBe(pieTheme);
	});

	test("crosses an open shadow-root boundary to find a light-DOM ancestor", () => {
		// Regression test: Element.closest() alone cannot see past a shadow
		// root, so a tool mounted inside its own shadow root would never find
		// a <pie-theme> that wraps it in the light DOM.
		const pieTheme = document.createElement("pie-theme");
		const host = document.createElement("div");
		pieTheme.appendChild(host);
		document.body.appendChild(pieTheme);

		const shadowRoot = host.attachShadow({ mode: "open" });
		const innerNode = document.createElement("div");
		shadowRoot.appendChild(innerNode);

		expect(resolvePieThemeHost(innerNode)).toBe(pieTheme);
	});

	test("falls back to a document-scoped <pie-theme> when no ancestor matches", () => {
		const documentScoped = document.createElement("pie-theme");
		documentScoped.setAttribute("scope", "document");
		document.body.appendChild(documentScoped);

		const unrelated = document.createElement("div");
		document.body.appendChild(unrelated);

		expect(resolvePieThemeHost(unrelated)).toBe(documentScoped);
	});

	test("falls back to any <pie-theme> when none is document-scoped", () => {
		const anyScoped = document.createElement("pie-theme");
		document.body.appendChild(anyScoped);

		const unrelated = document.createElement("div");
		document.body.appendChild(unrelated);

		expect(resolvePieThemeHost(unrelated)).toBe(anyScoped);
	});

	test("returns null when no <pie-theme> exists anywhere", () => {
		const unrelated = document.createElement("div");
		document.body.appendChild(unrelated);

		expect(resolvePieThemeHost(unrelated)).toBeNull();
	});
});

describe("applyPieColorScheme", () => {
	afterEach(cleanupDocument);

	test("sets the scheme attribute on the resolved theme host", () => {
		const pieTheme = document.createElement("pie-theme");
		document.body.appendChild(pieTheme);

		applyPieColorScheme("high-contrast", { from: pieTheme });

		expect(pieTheme.getAttribute("scheme")).toBe("high-contrast");
	});

	test("does not touch the attribute when it already matches", () => {
		const pieTheme = document.createElement("pie-theme");
		pieTheme.setAttribute("scheme", "high-contrast");
		document.body.appendChild(pieTheme);
		let mutationCount = 0;
		const observer = new MutationObserver(() => {
			mutationCount += 1;
		});
		observer.observe(pieTheme, { attributes: true });

		applyPieColorScheme("high-contrast", { from: pieTheme });

		expect(mutationCount).toBe(0);
		observer.disconnect();
	});

	test("falls back to data-color-scheme on documentElement when no host exists", () => {
		applyPieColorScheme("high-contrast");
		expect(document.documentElement.getAttribute("data-color-scheme")).toBe(
			"high-contrast",
		);

		applyPieColorScheme("default");
		expect(
			document.documentElement.hasAttribute("data-color-scheme"),
		).toBe(false);
	});

	test("persists the requested scheme under the default key", () => {
		applyPieColorScheme("high-contrast");
		expect(localStorage.getItem("pie-color-scheme")).toBe("high-contrast");
	});

	test("persists under a caller-supplied key", () => {
		applyPieColorScheme("high-contrast", { persistenceKey: "custom-key" });
		expect(localStorage.getItem("custom-key")).toBe("high-contrast");
		expect(localStorage.getItem("pie-color-scheme")).toBeNull();
	});

	test("skips persistence when persistenceKey is explicitly null", () => {
		applyPieColorScheme("high-contrast", { persistenceKey: null });
		expect(localStorage.getItem("pie-color-scheme")).toBeNull();
	});
});
