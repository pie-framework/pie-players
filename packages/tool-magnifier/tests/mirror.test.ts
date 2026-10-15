import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { serializeDocument } from "../src/mirror.js";

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

beforeEach(() => {
	document.head.innerHTML = "";
	document.body.innerHTML = "";
});

const serialize = (exclude?: (element: Element) => boolean) =>
	serializeDocument(document, { exclude });

describe("serializeDocument", () => {
	test("leaves out scripts, handlers and the excluded element", () => {
		document.body.innerHTML =
			'<p onclick="steal()">Read me</p><script>alert(1)</script><div id="lens">lens</div>';
		const lens = document.getElementById("lens");

		const { html } = serialize((element) => element === lens);

		expect(html).toInclude("<p>Read me</p>");
		expect(html).not.toInclude("onclick");
		expect(html).not.toInclude("alert(1)");
		expect(html).not.toInclude("lens</div>");
	});

	test("keeps pictures but not frames or autoplay", () => {
		document.body.innerHTML =
			'<img src="https://example.test/a.png" alt="A"><iframe src="about:blank"></iframe><video src="https://example.test/v.mp4" autoplay></video>';

		const { html, media } = serialize();

		expect(html).toInclude('<img alt="A" src="https://example.test/a.png">');
		expect(html).toInclude("<iframe></iframe>");
		expect(html).toInclude('src="https://example.test/v.mp4" preload="metadata"');
		expect(html).not.toInclude("autoplay");
		expect(media).toHaveLength(1);
	});

	test("writes an open shadow root as a declarative one", () => {
		const host = document.createElement("x-card");
		host.attachShadow({ mode: "open" }).innerHTML = "<b>inside</b>";
		document.body.append(host);

		const { html, shadowRoots } = serialize();

		expect(html).toInclude(
			'<x-card><template shadowrootmode="open"><b>inside</b></template></x-card>',
		);
		expect(shadowRoots).toEqual([host.shadowRoot as ShadowRoot]);
	});

	test("skips a closed shadow root", () => {
		const host = document.createElement("x-secret");
		host.attachShadow({ mode: "closed" }).innerHTML = "<b>hidden</b>";
		document.body.append(host);

		expect(serialize().html).not.toInclude("hidden");
	});

	test("carries form state the DOM holds as properties", () => {
		document.body.innerHTML =
			'<input id="t" value="old"><input id="c" type="checkbox"><input id="p" type="password"><textarea id="a">old</textarea>';
		(document.getElementById("t") as HTMLInputElement).value = "typed";
		(document.getElementById("c") as HTMLInputElement).checked = true;
		(document.getElementById("p") as HTMLInputElement).value = "secret";
		(document.getElementById("a") as HTMLTextAreaElement).value = "answer";

		const { html } = serialize();

		expect(html).toInclude('<input id="t" value="typed">');
		expect(html).toInclude('<input id="c" type="checkbox" checked>');
		expect(html).not.toInclude("secret");
		expect(html).toInclude('<textarea id="a">answer</textarea>');
	});

	test("escapes text and attribute values", () => {
		document.body.innerHTML = '<p title="a &quot;b&quot;">1 &lt; 2 &amp; 3</p>';

		expect(serialize().html).toInclude('<p title="a &quot;b&quot;">1 &lt; 2 &amp; 3</p>');
	});

	test("writes style sheets from their rules, closed safely", () => {
		const style = document.createElement("style");
		document.head.append(style);
		(style.sheet as CSSStyleSheet).insertRule(".a { color: red; }");

		const { html } = serialize();

		expect(html).toMatch(/<head>.*<style>\.a \{ color: red; \}\n<\/style>.*<\/head>/);
	});

	test("ends the body with the copy's own reset", () => {
		document.body.innerHTML = "<p>x</p>";

		expect(serialize().html).toMatch(/animation:none!important.*<\/style><\/body><\/html>$/);
	});
});
