import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";

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

const { observeFlattenedTree } = await import("../src/ui/flattened-tree.js");

const stops: Array<() => void> = [];

afterEach(() => {
	for (const stop of stops.splice(0)) stop();
	document.body.innerHTML = "";
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The ids of the elements `root`'s observer reports, each report's subtree included. */
const watch = (root: Element | ShadowRoot, attributeFilter?: string[]) => {
	const seen: string[] = [];
	stops.push(
		observeFlattenedTree(
			root,
			(node) => {
				const element = node as Element;
				if (element.id) seen.push(element.id);
				for (const found of node.querySelectorAll("[id]")) seen.push(found.id);
			},
			{ attributeFilter },
		),
	);
	return seen;
};

/** A host whose shadow root renders `#inner` around a slot, as the section player's base renders the toolkit. */
const slottingHost = (): { host: Element; inner: Element } => {
	document.body.innerHTML = `<div id="host"></div>`;
	const host = document.getElementById("host")!;
	host.attachShadow({
		mode: "open",
	}).innerHTML = `<div id="inner"><slot></slot></div>`;
	return { host, inner: host.shadowRoot!.getElementById("inner")! };
};

describe("observeFlattenedTree", () => {
	it("reports the content slotted into the root, and content added to it later", async () => {
		const { host, inner } = slottingHost();
		host.innerHTML = `<section id="pane"><p id="first"></p></section>`;
		const seen = watch(inner);
		expect(seen).toEqual(["inner", "pane", "first"]);

		document
			.getElementById("pane")!
			.insertAdjacentHTML("beforeend", `<p id="second"></p>`);
		await settle();
		expect(seen).toContain("second");
	});

	it("reports an element a slot is given after observing starts", async () => {
		const { host, inner } = slottingHost();
		const seen = watch(inner);

		host.insertAdjacentHTML("beforeend", `<section id="late"></section>`);
		await settle();
		expect(seen).toContain("late");
	});

	it("enters open shadow roots and reports slotted light content once", async () => {
		document.body.innerHTML = `<div id="root"><div id="shell"><p id="item"></p></div></div>`;
		const shell = document.getElementById("shell")!;
		shell.attachShadow({
			mode: "open",
		}).innerHTML = `<span id="anchor"></span><slot></slot>`;
		const seen = watch(document.getElementById("root")!);

		expect(seen.filter((id) => id === "item")).toHaveLength(1);
		expect(seen).toContain("anchor");
	});

	it("reports an element whose filtered attribute changes", async () => {
		document.body.innerHTML = `<div id="root"><div id="element" lang="en"></div></div>`;
		const seen = watch(document.getElementById("root")!, ["lang"]);
		seen.length = 0;

		document.getElementById("element")!.setAttribute("lang", "es");
		document.getElementById("element")!.setAttribute("title", "ignored");
		await settle();
		expect(seen).toEqual(["element"]);
	});

	it("reports nothing after it stops", async () => {
		const { host, inner } = slottingHost();
		const seen = watch(inner);
		stops.pop()?.();
		seen.length = 0;

		host.insertAdjacentHTML("beforeend", `<section id="late"></section>`);
		await settle();
		expect(seen).toEqual([]);
	});
});
