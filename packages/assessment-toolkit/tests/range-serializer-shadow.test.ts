import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";
import { RangeSerializer } from "../src/services/RangeSerializer";

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
});

const serializer = new RangeSerializer();

const mount = (): { root: Element; shadow: ShadowRoot } => {
	document.body.innerHTML =
		"<main><section><p>light one</p><p>light two</p><div class='host'></div></section></main>";
	const root = document.querySelector("main") as Element;
	const host = root.querySelector(".host") as Element;
	const shadow = host.attachShadow({ mode: "open" });
	shadow.innerHTML = "<p>shadow one</p><p>shadow <b>two</b> words</p>";
	return { root, shadow };
};

describe("RangeSerializer across shadow roots", () => {
	test("round-trips a range inside an open shadow root", () => {
		const { root, shadow } = mount();
		const bold = shadow.querySelector("b")?.firstChild as Text;
		const range = document.createRange();
		range.setStart(bold, 0);
		range.setEnd(bold, 3);

		const data = serializer.serialize(range, root);
		expect(data.startContainer).toContain(" >>> ");

		const restored = serializer.deserialize(data, root);
		expect(restored?.startContainer).toBe(bold);
		expect(restored?.toString()).toBe("two");
	});

	test("round-trips a range in a nested shadow root and one in its id'd element", () => {
		const { root, shadow } = mount();
		const innerHost = document.createElement("span");
		innerHost.id = "inner";
		shadow.appendChild(innerHost);
		const inner = innerHost.attachShadow({ mode: "open" });
		inner.innerHTML = "<i>deep</i>";
		const deep = inner.querySelector("i")?.firstChild as Text;

		const range = document.createRange();
		range.setStart(deep, 1);
		range.setEnd(deep, 4);
		const data = serializer.serialize(range, root);
		expect(data.startContainer.split(" >>> ")).toHaveLength(3);
		expect(serializer.deserialize(data, root)?.toString()).toBe("eep");
	});

	test("round-trips a range whose ends are a shadow root's own children", () => {
		const { root, shadow } = mount();
		const range = document.createRange();
		range.setStart(shadow, 0);
		range.setEnd(shadow, 1);

		const restored = serializer.deserialize(
			serializer.serialize(range, root),
			root,
		);
		expect(restored?.startContainer).toBe(shadow);
		expect(restored?.toString()).toBe("shadow one");
	});

	test("keeps light-tree paths as they were", () => {
		const { root } = mount();
		const second = root.querySelectorAll("p")[1]?.firstChild as Text;
		const range = document.createRange();
		range.setStart(second, 0);
		range.setEnd(second, 5);

		const data = serializer.serialize(range, root);
		expect(data.startContainer).toBe("section > p:nth-of-type(2)::text[0]");
		expect(serializer.deserialize(data, root)?.toString()).toBe("light");
	});

	test("returns null when the shadow content changed", () => {
		const { root, shadow } = mount();
		const bold = shadow.querySelector("b")?.firstChild as Text;
		const range = document.createRange();
		range.selectNodeContents(bold);
		const data = serializer.serialize(range, root);

		shadow.innerHTML = "<p>other</p>";
		expect(serializer.deserialize(data, root)).toBeNull();
	});
});
