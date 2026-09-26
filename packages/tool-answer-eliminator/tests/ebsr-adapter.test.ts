import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, describe, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

const { EBSRAdapter } = await import("../adapters/ebsr-adapter");

const part = (tag: string, id: string) =>
	`<${tag} id="${id}"><div class="corespring-radio-button"><input type="radio" value="1"><label>One</label></div></${tag}>`;

const mountEbsr = (partTag: string) => {
	const root = document.createElement("div");
	root.innerHTML = part(partTag, "a") + part(partTag, "b");
	document.body.append(root);
	return root;
};

afterEach(() => {
	document.body.replaceChildren();
});

afterAll(() => {
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

describe("EBSRAdapter", () => {
	test.each([
		"ebsr-multiple-choice",
		"ebsr-multiple-choice--version-14-2-2-next-18",
	])("finds the choices of both %s parts", (partTag) => {
		const adapter = new EBSRAdapter();
		const root = mountEbsr(partTag);

		expect(adapter.canHandle(root)).toBe(true);
		const choices = adapter.findChoices(root);
		expect(choices.map((choice) => adapter.getChoiceId(choice))).toEqual([
			"a-1",
			"b-1",
		]);
	});

	test("ignores an element whose base tag only starts with the part tag", () => {
		const adapter = new EBSRAdapter();
		const root = mountEbsr("ebsr-multiple-choice-configure--version-14-2-2");

		expect(adapter.canHandle(root)).toBe(false);
		expect(adapter.findChoices(root)).toEqual([]);
	});
});
