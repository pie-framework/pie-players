/**
 * Reaching a shell through an open shadow root is covered in the browser, by
 * the annotation toolbar's read-aloud spec.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, describe, expect, test } from "bun:test";
import { ContextProvider } from "@pie-players/pie-context";
import {
	type AssessmentToolkitShellContext,
	assessmentToolkitShellContext,
} from "../src/context/assessment-toolkit-context.js";
import {
	catalogContextForShell,
	catalogContextHolding,
} from "../src/runtime/catalog-context.js";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

afterAll(() => {
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

const shellValue = (
	overrides: Partial<AssessmentToolkitShellContext> = {},
): AssessmentToolkitShellContext => ({
	kind: "item",
	itemId: "item-1-instance",
	canonicalItemId: "item-1",
	contentKind: "item",
	regionPolicy: "default",
	scopeElement: null,
	item: null,
	contextVersion: 1,
	...overrides,
});

/**
 * A shell host providing `value`, with a paragraph and its text inside. Without
 * a `parent` it mounts in a new document.
 */
const mountShell = (
	value: AssessmentToolkitShellContext,
	parent: HTMLElement = document.implementation.createHTMLDocument().body,
): { host: HTMLElement; text: Text } => {
	const doc = parent.ownerDocument;
	const host = parent.appendChild(doc.createElement("div"));
	new ContextProvider(host, {
		context: assessmentToolkitShellContext,
		initialValue: value,
	}).connect();
	const paragraph = host.appendChild(doc.createElement("p"));
	return { host, text: paragraph.appendChild(doc.createTextNode("Read")) };
};

const holding = (node: Node) => catalogContextHolding(node, runtime);

const runtime = { assessmentId: "assessment-1", sectionId: "section-1" };

describe("catalogContextForShell", () => {
	test("names an item shell's owner by its instance and canonical ids", () => {
		expect(catalogContextForShell(shellValue(), runtime)).toEqual({
			ownerKind: "itemModel",
			assessmentId: "assessment-1",
			sectionId: "section-1",
			itemId: "item-1-instance",
			canonicalItemId: "item-1",
		});
	});

	test("names a passage shell's owner by its canonical id", () => {
		expect(
			catalogContextForShell(
				shellValue({ kind: "passage", canonicalItemId: "passage-1" }),
				runtime,
			),
		).toEqual({
			ownerKind: "passage",
			assessmentId: "assessment-1",
			sectionId: "section-1",
			passageId: "passage-1",
		});
	});
});

describe("catalogContextHolding", () => {
	test("reads the context of the shell holding a text node", () => {
		const { text } = mountShell(shellValue());

		expect(holding(text)).toEqual(
			catalogContextForShell(shellValue(), runtime),
		);
	});

	test("reads the nearest shell when shells nest", () => {
		const outer = mountShell(shellValue());
		const inner = mountShell(
			shellValue({ itemId: "item-2-instance", canonicalItemId: "item-2" }),
			outer.host,
		);

		expect(holding(inner.text)).toMatchObject({
			itemId: "item-2-instance",
			canonicalItemId: "item-2",
		});
	});

	test("is undefined outside every shell", () => {
		const loose = document
			.createElement("p")
			.appendChild(document.createTextNode("Loose"));

		expect(holding(loose)).toBeUndefined();
	});
});
