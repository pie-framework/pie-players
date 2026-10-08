/**
 * The tree is raw `EventTarget` nodes, as in `shell-scope.test.ts`: happy-dom's
 * `dispatchEvent` rejects pie-context's events whenever another file loaded
 * pie-context first. Reaching a shell through an open shadow root is covered in
 * the browser, by the annotation toolbar's read-aloud spec.
 */
import { describe, expect, test } from "bun:test";
import { ContextProvider } from "@pie-players/pie-context";
import {
	type AssessmentToolkitShellContext,
	assessmentToolkitShellContext,
} from "../src/context/assessment-toolkit-context.js";
import {
	catalogContextForShell,
	catalogContextHolding,
} from "../src/runtime/catalog-context.js";

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

class FakeNode extends EventTarget {
	readonly parentNode: FakeNode | null;
	readonly nodeType: number;

	constructor(parent: FakeNode | null, nodeType = ELEMENT_NODE) {
		super();
		this.parentNode = parent;
		this.nodeType = nodeType;
	}

	get parentElement(): FakeNode | null {
		return this.parentNode;
	}

	override dispatchEvent(event: Event): boolean {
		// Each node is a separate native dispatch, which clears the stop flag when
		// it returns, so the stop is recorded here.
		let stopped = false;
		const stopPropagation = Event.prototype.stopPropagation;
		Object.defineProperty(event, "stopPropagation", {
			configurable: true,
			value: () => {
				stopped = true;
				stopPropagation.call(event);
			},
		});
		let notCanceled = true;
		for (
			let node: FakeNode | null = this;
			node && !stopped;
			node = event.bubbles ? node.parentNode : null
		) {
			notCanceled = EventTarget.prototype.dispatchEvent.call(node, event);
		}
		return notCanceled;
	}
}

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

/** A shell host providing `value`, with a paragraph and its text inside. */
const mountShell = (
	value: AssessmentToolkitShellContext,
	parent: FakeNode | null = null,
): { host: FakeNode; text: FakeNode } => {
	const host = new FakeNode(parent);
	new ContextProvider(host as unknown as Element, {
		context: assessmentToolkitShellContext,
		initialValue: value,
	}).connect();
	const paragraph = new FakeNode(host);
	return { host, text: new FakeNode(paragraph, TEXT_NODE) };
};

const holding = (node: FakeNode) =>
	catalogContextHolding(node as unknown as Node, runtime);

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
		const loose = new FakeNode(new FakeNode(null), TEXT_NODE);

		expect(holding(loose)).toBeUndefined();
	});
});
