import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

const { accessibleText } = await import("../accessible-text");
const { own } = await import("../owned-nodes");

afterAll(() => {
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

const content = (html: string) => {
	const element = document.createElement("span");
	element.innerHTML = html;
	return element;
};

test("an expression reads as its spoken name, not its source fragments", () => {
	expect(
		accessibleText(
			content(
				'Solve <mjx-container aria-label="x squared equals 4"><mjx-math>x2=4</mjx-math></mjx-container> for x',
			),
		),
	).toBe("Solve x squared equals 4 for x");
	expect(
		accessibleText(
			content('<span data-pie-math-name="one half"><span>1</span><span>2</span></span>'),
		),
	).toBe("one half");
	expect(accessibleText(content('<svg role="img" aria-label="a triangle"></svg>'))).toBe(
		"a triangle",
	);
});

test("an image reads as its alt text, and a decorative one as nothing", () => {
	expect(accessibleText(content('A <img alt="red apple" src="a.png"> fruit'))).toBe(
		"A red apple fruit",
	);
	expect(accessibleText(content('Fruit<img alt="" src="a.png">'))).toBe("Fruit");
});

test("hidden text and the eliminator's own nodes are left out", () => {
	const element = content(
		'<span aria-hidden="true">A. </span>Alpha<style>.x{}</style><span class="note"> (eliminated)</span>',
	);
	own(element.querySelector(".note") as Element);
	expect(accessibleText(element)).toBe("Alpha");
});
