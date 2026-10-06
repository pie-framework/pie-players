import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { compile } from "svelte/compiler";

import { coerceBooleanAttribute } from "../src/ui/attribute-coercion.js";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

const moduleDir = mkdtempSync(join(tmpdir(), "pie-attribute-coercion-"));

afterAll(() => {
	rmSync(moduleDir, { recursive: true, force: true });
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

describe("coerceBooleanAttribute", () => {
	test("reads presence as true and absence as false", () => {
		expect(coerceBooleanAttribute("")).toBe(true);
		expect(coerceBooleanAttribute("true")).toBe(true);
		expect(coerceBooleanAttribute("show-bottom-border")).toBe(true);
		expect(coerceBooleanAttribute(null)).toBe(false);
	});

	test("reads the false words as false", () => {
		for (const value of ["false", "FALSE", " false ", "0", "off", "no"]) {
			expect(coerceBooleanAttribute(value)).toBe(false);
		}
	});
});

// A real Svelte custom element, so the hook is exercised against the runtime's
// own attribute handling rather than a model of it.
const TAG = "pie-coercion-sample";

beforeAll(async () => {
	const { js } = compile(
		`<svelte:options customElement={{
			tag: "${TAG}",
			shadow: "none",
			props: {
				flag: { attribute: "flag", type: "Boolean" },
				fallbackOn: { attribute: "fallback-on", type: "Boolean" },
				label: { attribute: "label", type: "String" },
			},
			extend: coerceBooleanAttributes,
		}} />
		<script>
			import { coerceBooleanAttributes } from "@pie-players/pie-players-shared/ui/attribute-coercion";
			let { flag = false, fallbackOn = true, label = "" } = $props();
		</script>
		<span data-flag={String(flag)} data-fallback-on={String(fallbackOn)} data-label={label}></span>`,
		{ customElement: true, filename: "Sample.svelte" },
	);
	const resolved = (specifier: string) =>
		pathToFileURL(Bun.resolveSync(specifier, import.meta.dir)).href;
	const code = js.code
		.replace(
			/(["'])@pie-players\/pie-players-shared\/ui\/attribute-coercion\1/,
			JSON.stringify(
				pathToFileURL(join(import.meta.dir, "../src/ui/attribute-coercion.ts"))
					.href,
			),
		)
		.replace(/(["'])(svelte\/internal\/[\w-]+)\1/g, (_match, _quote, specifier) =>
			JSON.stringify(resolved(specifier)),
		);
	const modulePath = join(moduleDir, "sample.js");
	writeFileSync(modulePath, code);
	await import(pathToFileURL(modulePath).href);
});

const mount = async (markup: string) => {
	const host = document.createElement("div");
	host.innerHTML = markup;
	document.body.append(host);
	await new Promise((resolve) => setTimeout(resolve, 0));
	const span = host.querySelector("span");
	if (!span) throw new Error("component did not render");
	return { host, element: host.firstElementChild as HTMLElement, span };
};

describe("coerceBooleanAttributes", () => {
	test('reads flag="false" as false', async () => {
		const { span, host } = await mount(`<${TAG} flag="false"></${TAG}>`);
		expect(span.dataset.flag).toBe("false");
		host.remove();
	});

	test("keeps presence and absence as they were", async () => {
		const present = await mount(`<${TAG} flag></${TAG}>`);
		expect(present.span.dataset.flag).toBe("true");
		const absent = await mount(`<${TAG}></${TAG}>`);
		expect(absent.span.dataset.flag).toBe("false");
		expect(absent.span.dataset.fallbackOn).toBe("true");
		present.host.remove();
		absent.host.remove();
	});

	test("turns off a prop that defaults to true", async () => {
		const { span, host } = await mount(
			`<${TAG} fallback-on="false"></${TAG}>`,
		);
		expect(span.dataset.fallbackOn).toBe("false");
		host.remove();
	});

	test("follows later attribute changes", async () => {
		const { element, host } = await mount(`<${TAG} flag></${TAG}>`);
		element.setAttribute("flag", "false");
		await Promise.resolve();
		expect(host.querySelector("span")?.dataset.flag).toBe("false");
		element.setAttribute("flag", "true");
		await Promise.resolve();
		expect(host.querySelector("span")?.dataset.flag).toBe("true");
		host.remove();
	});

	test('leaves a String prop set to "false" alone', async () => {
		const { span, host } = await mount(`<${TAG} label="false"></${TAG}>`);
		expect(span.dataset.label).toBe("false");
		host.remove();
	});

	test("leaves property assignment to Svelte", async () => {
		const { element, host } = await mount(`<${TAG}></${TAG}>`);
		(element as HTMLElement & { flag: boolean }).flag = true;
		await Promise.resolve();
		expect(host.querySelector("span")?.dataset.flag).toBe("true");
		host.remove();
	});
});
