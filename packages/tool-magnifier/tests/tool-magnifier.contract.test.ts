import { expect, test } from "bun:test";

const source = await Bun.file(
	new URL("../tool-magnifier.svelte", import.meta.url),
).text();

test("every position write is clamped to the containing block", () => {
	const writes = source.match(/\bposition = (?!\$state)([^\n]*)/g) ?? [];
	expect(writes.length).toBeGreaterThan(0);
	for (const write of writes) {
		expect(write).toInclude("clampToContainingBlock(");
	}
});

test("containment is derived from the containing block", () => {
	expect(source).toInclude("resolveContainingBlockRect(");
	expect(source).not.toInclude("window.innerWidth / 2");
});

test("each size tap pair drives one dimension, as the grip's arrow keys do", () => {
	const steps = [...source.matchAll(/step: \(direction\) => (resize\([^)]*\))/g)].map(
		(match) => match[1],
	);
	expect(steps).toEqual([
		"resize(direction * RESIZE_STEP, 0)",
		"resize(0, direction * RESIZE_STEP)",
	]);
});

test("every lens is left out of the copy a lens shows", () => {
	expect(source).toInclude("exclude: (element) => element.localName === lensTag");
});
