import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";
import {
	DEFAULT_CONTENT_LANGUAGE,
	findLangAttribute,
	resolveContentLanguage,
} from "../src/runtime/content-language";
import {
	findShellScopeHost,
	resolveContentRegion,
} from "../src/runtime/content-region";

beforeAll(() => {
	if (typeof (globalThis as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

afterEach(() => {
	document.body.innerHTML = "";
	document.documentElement.removeAttribute("lang");
});

/** A card-shaped shell: header, media and content regions. */
const mountShell = (
	contentMarkup = "<p>content</p>",
): {
	shell: Element;
	header: Element;
	media: Element;
	content: Element;
} => {
	document.body.innerHTML = `<pie-item-shell data-pie-shell-root>
		<div class="card">
			<header><h2>Question 1</h2></header>
			<div data-region="media"><p>media</p></div>
			<div data-region="content">${contentMarkup}</div>
		</div>
	</pie-item-shell>`;
	const shell = document.querySelector("[data-pie-shell-root]") as Element;
	return {
		shell,
		header: shell.querySelector("header") as Element,
		media: shell.querySelector("[data-region='media']") as Element,
		content: shell.querySelector("[data-region='content']") as Element,
	};
};

const shadowIn = (
	parent: Element,
	markup: string,
	lang?: string,
): ShadowRoot => {
	const host = document.createElement("div");
	if (lang) host.setAttribute("lang", lang);
	parent.appendChild(host);
	const root = host.attachShadow({ mode: "open" });
	root.innerHTML = markup;
	return root;
};

describe("resolveContentRegion", () => {
	test("resolves a shell to its content region", () => {
		const { shell, content } = mountShell();
		expect(resolveContentRegion(shell)).toBe(content);
	});

	test("resolves a scope that marks no region to the scope itself", () => {
		document.body.innerHTML = "<div id='scope'><p>plain</p></div>";
		const scope = document.getElementById("scope") as Element;
		expect(resolveContentRegion(scope)).toBe(scope);
	});

	test("resolves a content region to itself", () => {
		const { content } = mountShell();
		expect(resolveContentRegion(content)).toBe(content);
	});

	test("with a target, resolves to the region holding it, through shadow roots", () => {
		const { shell, content, header } = mountShell();
		const root = shadowIn(content, "<p>shadow text</p>");
		const shadowText = root.querySelector("p")?.firstChild as Node;

		expect(resolveContentRegion(shell, shadowText)).toBe(content);
		expect(resolveContentRegion(shell, header)).toBe(content);
	});

	test("finds a content region rendered inside a shadow root", () => {
		document.body.innerHTML =
			"<pie-item-scope data-pie-shell-root></pie-item-scope>";
		const scope = document.querySelector("pie-item-scope") as Element;
		const root = scope.attachShadow({ mode: "open" });
		root.innerHTML = "<div data-region='content'><p>inside</p></div>";

		expect(resolveContentRegion(scope)).toBe(
			root.querySelector("[data-region='content']") as Element,
		);
	});

	test("finds the shell scope host above shadow content", () => {
		const { shell, content } = mountShell();
		const root = shadowIn(content, "<p>shadow text</p>");

		expect(findShellScopeHost(root.querySelector("p"))).toBe(shell);
		expect(findShellScopeHost(document.body)).toBeNull();
		expect(findShellScopeHost(null)).toBeNull();
	});
});

describe("resolveContentLanguage", () => {
	test("takes the nearest lang between the target and the shell, through shadow hosts", () => {
		const { content } = mountShell();
		content.setAttribute("lang", "fr-FR");
		const root = shadowIn(content, "<p>texto</p>", "es-MX");
		const shadowText = root.querySelector("p")?.firstChild as Node;

		expect(resolveContentLanguage(shadowText)).toBe("es-MX");
		expect(resolveContentLanguage(content.querySelector("p"))).toBe("fr-FR");
	});

	test("counts the shell host's own lang and stops there", () => {
		const { shell, content } = mountShell();
		document.documentElement.setAttribute("lang", "nl-NL");
		expect(resolveContentLanguage(content)).toBe(DEFAULT_CONTENT_LANGUAGE);

		shell.setAttribute("lang", "de-DE");
		expect(resolveContentLanguage(content)).toBe("de-DE");
	});

	test("falls back to the host input, then en-US", () => {
		const { content } = mountShell();

		expect(
			resolveContentLanguage(content, { contentLanguage: " es-ES " }),
		).toBe("es-ES");
		expect(resolveContentLanguage(content, { contentLanguage: "" })).toBe(
			"en-US",
		);
		expect(resolveContentLanguage(null, { contentLanguage: "es-ES" })).toBe(
			"es-ES",
		);
	});

	test("reads no markup outside a shell unless given a boundary", () => {
		document.body.innerHTML = "<div lang='it-IT'><p id='text'>testo</p></div>";
		const text = document.getElementById("text") as Element;

		expect(resolveContentLanguage(text)).toBe("en-US");
		expect(resolveContentLanguage(text, { boundary: document.body })).toBe(
			"it-IT",
		);
		expect(findLangAttribute(text)).toBe("it-IT");
		expect(findLangAttribute(text, text)).toBeUndefined();
	});
});
