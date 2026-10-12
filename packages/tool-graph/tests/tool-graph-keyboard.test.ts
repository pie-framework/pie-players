import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

// Browsers return a DOMPoint here. happy-dom's SVGPoint has no matrixTransform,
// so without this every pointer position would fail before the tool applies.
SVGSVGElement.prototype.createSVGPoint = () => new DOMPoint();

await import("../tool-graph.svelte");

const settle = async () => {
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
};

const mountGraph = async () => {
	const element = document.createElement("pie-tool-graph");
	element.setAttribute("visible", "true");
	document.body.append(element);
	await settle();
	const root = element.shadowRoot as ShadowRoot;
	const canvas = root.querySelector(
		".pie-tool-graph__canvas-wrapper",
	) as HTMLElement;
	const selectTool = async (label: string) => {
		const button = Array.from(
			root.querySelectorAll<HTMLButtonElement>(".pie-tool-graph__tool-button"),
		).find((candidate) => candidate.textContent?.trim() === label);
		button?.click();
		await settle();
	};
	const press = async (target: Element, key: string) => {
		target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
		await settle();
	};
	const points = () =>
		Array.from(root.querySelectorAll(".pie-tool-graph__user-point")).map(
			(circle) => ({
				x: Number(circle.getAttribute("cx")),
				y: Number(circle.getAttribute("cy")),
			}),
		);
	return { root, canvas, selectTool, press, points };
};

afterEach(() => {
	document.body.replaceChildren();
});

afterAll(async () => {
	document.body.replaceChildren();
	await settle();
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

test("Enter on the canvas adds a point at finite coordinates", async () => {
	const { canvas, selectTool, press, points } = await mountGraph();
	await selectTool("Point");

	await press(canvas, "Enter");

	const placed = points();
	expect(placed).toHaveLength(1);
	expect(Number.isFinite(placed[0].x)).toBe(true);
	expect(Number.isFinite(placed[0].y)).toBe(true);
});

test("arrow keys move the placement one minor grid cell", async () => {
	const { canvas, selectTool, press, points } = await mountGraph();
	await selectTool("Point");

	await press(canvas, "Enter");
	await press(canvas, "ArrowRight");
	await press(canvas, "ArrowDown");
	await press(canvas, " ");

	const [first, second] = points();
	expect(second.x - first.x).toBe(4);
	expect(second.y - first.y).toBe(4);
});

test("the cursor stays inside the grid", async () => {
	const { canvas, selectTool, press, points } = await mountGraph();
	await selectTool("Point");

	for (let i = 0; i < 40; i++) await press(canvas, "ArrowUp");
	await press(canvas, "Enter");

	expect(points()[0].y).toBe(0);
});

test("a click adds a point where the pointer is", async () => {
	const { canvas, selectTool, points } = await mountGraph();
	await selectTool("Point");

	canvas.dispatchEvent(
		new MouseEvent("click", { clientX: 30, clientY: 40, bubbles: true }),
	);
	await settle();

	expect(points()).toEqual([{ x: 30, y: 40 }]);
});

test("Enter on a focused point leaves canvas placement alone", async () => {
	const { root, canvas, selectTool, press, points } = await mountGraph();
	await selectTool("Point");
	await press(canvas, "Enter");
	await selectTool("Line");

	const point = root.querySelector(".pie-tool-graph__user-point") as Element;
	await press(point, "Enter");

	expect(points()).toHaveLength(1);
	expect(point.classList).toContain("pie-tool-graph__user-point--highlight");
});
